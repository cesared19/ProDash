import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { loadEnvFile, readConfig } from './env.js'
import { createJiraClient, JiraError } from './jira.js'
import { createMockClient } from './mock.js'
import { applyDueDates, buildSummary, isBugType, normalizeIssue, summarizeBugs } from './metrics.js'
import { messages } from './messages.js'
import { createViewStore, selectionMatcher, ViewError, viewJql } from './views.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(path.join(root, '.env'))
const { config, missing } = readConfig()
if (missing.length) {
	console.error(`Faltan variables en .env: ${missing.join(', ')}`)
	console.error('Copia .env.example a .env y complétalo.')
	process.exit(1)
}

const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const jira = config.mock ? createMockClient() : createJiraClient(config.jira)
const views = createViewStore(process.env.DATA_DIR || path.join(root, 'data'))
const MAX_ISSUES = 5000
const COOKIE = 'jd_session'
const SESSION_DAYS = 30
// Derived from the configured secrets, so sessions survive restarts and
// are invalidated when the password or token changes.
const secret = crypto
	.createHash('sha256')
	.update(`${config.password}\0${config.jira.token}\0prodash`)
	.digest()

function sign(value) {
	return crypto.createHmac('sha256', secret).update(value).digest('base64url')
}

function sessionValid(req) {
	const cookie = (req.headers.cookie ?? '')
		.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${COOKIE}=`))
	if (!cookie) return false
	const [expires, signature] = cookie.slice(COOKIE.length + 1).split('.')
	if (!expires || !signature) return false
	const expected = Buffer.from(sign(expires))
	const given = Buffer.from(signature)
	return expected.length === given.length && crypto.timingSafeEqual(expected, given) && Number(expires) > Date.now()
}

function safeEqual(a, b) {
	const ha = crypto.createHash('sha256').update(a).digest()
	const hb = crypto.createHash('sha256').update(b).digest()
	return crypto.timingSafeEqual(ha, hb)
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

app.get('/api/session', (req, res) => {
	res.json({ authenticated: sessionValid(req), mock: config.mock, version })
})

app.post('/api/login', async (req, res) => {
	const password = typeof req.body?.password === 'string' ? req.body.password : ''
	if (!safeEqual(password, config.password)) {
		await new Promise((r) => setTimeout(r, 600))
		return res.status(401).json({ error: messages(req).wrongPassword })
	}
	const expires = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
	res.setHeader(
		'Set-Cookie',
		`${COOKIE}=${expires}.${sign(expires)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`,
	)
	res.json({ ok: true })
})

app.post('/api/logout', (_req, res) => {
	res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
	res.json({ ok: true })
})

app.use('/api', (req, res, next) => {
	if (!sessionValid(req)) return res.status(401).json({ error: messages(req).sessionExpired })
	next()
})

const PROJECT_KEY = /^[A-Za-z][A-Za-z0-9_]{0,49}$/

function projectKey(req, res) {
	const key = req.params.key
	if (!PROJECT_KEY.test(key)) {
		res.status(400).json({ error: messages(req).invalidKey })
		return null
	}
	return key.toUpperCase()
}

app.get('/api/projects', async (req, res, next) => {
	try {
		const projects = await jira.projects()
		if (projects.length === 0) {
			try {
				await jira.myself()
			} catch (e) {
				if (e instanceof JiraError && e.status === 401) {
					return res.status(502).json({ error: messages(req).anonymous })
				}
				throw e
			}
		}
		res.json(projects)
	} catch (e) {
		next(e)
	}
})

app.get('/api/projects/:key/issue-types', async (req, res, next) => {
	const key = projectKey(req, res)
	if (!key) return
	try {
		res.json(await jira.issueTypes(key))
	} catch (e) {
		next(e)
	}
})

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/

// Reading the changelog makes the Jira searches heavier, so a summary is
// reused for a short while (Refresh asks for a fresh one).
const CACHE_MS = 2 * 60 * 1000
const summaryCache = new Map()

// Days typed by the user per status in Customize: {"Waiting for build": 2}.
function parseStatusDays(raw) {
	if (!raw) return {}
	try {
		const parsed = JSON.parse(String(raw))
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
		return Object.fromEntries(
			Object.entries(parsed)
				.slice(0, 100)
				.filter(([name, days]) => name.length <= 200 && Number.isFinite(days) && days >= 0 && days <= 3650),
		)
	} catch {
		return {}
	}
}

// The parent field on child issues has no due date, so the epics are read
// separately. Without due dates the dashboard still works, so errors are
// logged and ignored.
async function epicDueDates(epics) {
	const keys = epics.map((e) => e.key).filter((k) => k && ISSUE_KEY.test(k))
	const dueByKey = new Map()
	try {
		for (let i = 0; i < keys.length; i += 100) {
			const chunk = keys.slice(i, i + 100)
			const { issues } = await jira.search(`key in (${chunk.join(',')})`, ['duedate'], chunk.length)
			for (const issue of issues) if (issue.fields?.duedate) dueByKey.set(issue.key, issue.fields.duedate)
		}
	} catch (e) {
		console.error(`[jira] No se pudieron leer las fechas de entrega de las epics: ${e.message}`)
	}
	return dueByKey
}

app.get('/api/projects/:key/summary', async (req, res, next) => {
	const key = projectKey(req, res)
	if (!key) return
	const days = req.query.days === 'all' ? null : Math.min(Math.max(Number(req.query.days) || 90, 1), 3650)
	const exclude = String(req.query.exclude ?? '')
		.split(',')
		.filter((id) => /^\d+$/.test(id))
	const statusDays = parseStatusDays(req.query.statusDays)
	const view = req.query.view ? views.get(String(req.query.view)) : null
	if (req.query.view && (!view || view.projectKey !== key)) {
		return res.status(404).json({ error: messages(req).viewNotFound })
	}
	const estimateScope = req.query.scope === 'selection' || req.query.scope === 'project' ? req.query.scope : view?.estimateScope
	// Bug breakdown: set per view, or asked for by the General dashboard.
	const withBugs = view ? Boolean(view.bugBreakdown) : req.query.bugs === '1'
	const cacheKey = JSON.stringify([key, days, exclude, statusDays, view?.id, view?.updatedAt, estimateScope, withBugs])
	const cached = summaryCache.get(cacheKey)
	if (cached && cached.until > Date.now() && req.query.fresh !== '1') return res.json(cached.body)
	try {
		let base = `project = "${key}"`
		if (exclude.length) base += ` AND issuetype not in (${exclude.join(',')})`
		const fields = ['summary', 'status', 'created', 'resolutiondate', 'statuscategorychangedate', 'parent', 'labels', 'components']
		// `updated` is a cheap superset filter: closing an issue updates it.
		// The exact close date is checked in buildSummary.
		const closedJql = `${base} AND statusCategory = Done${days ? ` AND updated >= -${days}d` : ''} ORDER BY updated DESC`
		// The changelog gives the status history used by the forecast by status.
		const [open, closed] = await Promise.all([
			jira.search(`${base} AND statusCategory != Done ORDER BY created ASC`, fields, MAX_ISSUES, 'changelog'),
			jira.search(closedJql, fields, MAX_ISSUES, 'changelog'),
		])
		const openIssues = open.issues.map(normalizeIssue)
		const closedIssues = closed.issues.map(normalizeIssue)
		// Open bugs are read on their own: their type is usually excluded from the other blocks.
		let bugIssues = null
		if (withBugs) {
			const bugTypes = (await jira.issueTypes(key)).filter(isBugType).map((t) => t.id)
			bugIssues = bugTypes.length
				? (
						await jira.search(
							`project = "${key}" AND issuetype in (${bugTypes.join(',')}) AND statusCategory != Done`,
							['summary', 'status', 'priority', 'parent', 'labels', 'components'],
							MAX_ISSUES,
						)
					).issues.map(normalizeIssue)
				: []
		}
		let selection = null
		if (view) {
			let jqlKeys
			if (view.jql) {
				try {
					const found = await jira.search(viewJql(key, view.jql), ['summary'], MAX_ISSUES)
					jqlKeys = new Set(found.issues.map((i) => i.key))
				} catch (e) {
					if (e instanceof JiraError && e.status === 400) {
						return res.status(400).json({ error: messages(req).jqlInvalid(e.detail) })
					}
					throw e
				}
			}
			selection = selectionMatcher(view, [...openIssues, ...closedIssues, ...(bugIssues ?? [])], jqlKeys)
		}
		const summary = buildSummary({
			open: openIssues,
			closed: closedIssues,
			days,
			statusDays,
			selection,
			estimateScope,
		})
		summary.epics = applyDueDates(summary.epics, await epicDueDates(summary.epics), Date.now())
		const body = {
			...summary,
			projectKey: key,
			view: view ? { id: view.id, name: view.name } : null,
			bugs: bugIssues ? summarizeBugs(selection ? bugIssues.filter(selection) : bugIssues) : null,
			jiraBaseUrl: config.mock ? null : config.jira.baseUrl,
			truncated: open.truncated || closed.truncated,
		}
		summaryCache.set(cacheKey, { until: Date.now() + CACHE_MS, body })
		for (const [k, v] of summaryCache) if (v.until < Date.now()) summaryCache.delete(k)
		res.json(body)
	} catch (e) {
		next(e)
	}
})

// ---------- Saved views ----------

function viewError(req, res, e) {
	if (!(e instanceof ViewError)) throw e
	const m = messages(req)
	res.status(400).json({ error: m.view[e.message] ?? m.view.invalid })
}

app.get('/api/projects/:key/views', (req, res) => {
	const key = projectKey(req, res)
	if (!key) return
	res.json(views.list(key))
})

app.post('/api/projects/:key/views', (req, res) => {
	const key = projectKey(req, res)
	if (!key) return
	try {
		res.status(201).json(views.create(key, req.body))
	} catch (e) {
		viewError(req, res, e)
	}
})

app.put('/api/views/:id', (req, res) => {
	try {
		const view = views.update(req.params.id, req.body)
		if (!view) return res.status(404).json({ error: messages(req).viewNotFound })
		res.json(view)
	} catch (e) {
		viewError(req, res, e)
	}
})

app.delete('/api/views/:id', (req, res) => {
	if (!views.remove(req.params.id)) return res.status(404).json({ error: messages(req).viewNotFound })
	res.json({ ok: true })
})

// ---------- Pickers for the view editor ----------

const pick = (issue) => ({
	key: issue.key,
	summary: issue.fields?.summary ?? '',
	status: issue.fields?.status?.name ?? '',
	type: issue.fields?.issuetype?.name ?? '',
})

app.get('/api/projects/:key/epics', async (req, res, next) => {
	const key = projectKey(req, res)
	if (!key) return
	try {
		const types = (await jira.issueTypes(key)).filter((t) => t.hierarchyLevel >= 1).map((t) => t.id)
		if (!types.length) return res.json([])
		const { issues } = await jira.search(
			`project = "${key}" AND issuetype in (${types.join(',')}) ORDER BY created DESC`,
			['summary', 'status', 'issuetype'],
			500,
		)
		res.json(issues.map(pick))
	} catch (e) {
		next(e)
	}
})

app.get('/api/projects/:key/issues', async (req, res, next) => {
	const key = projectKey(req, res)
	if (!key) return
	const q = String(req.query.q ?? '').trim().slice(0, 100)
	if (!q) return res.json([])
	// A key (SCRUM-12) is looked up directly; anything else is a text search.
	const jql = ISSUE_KEY.test(q.toUpperCase())
		? `project = "${key}" AND key = "${q.toUpperCase()}"`
		: `project = "${key}" AND text ~ "${q.replace(/["\\]/g, ' ')}*" ORDER BY updated DESC`
	try {
		const { issues } = await jira.search(jql, ['summary', 'status', 'issuetype'], 20)
		res.json(issues.map(pick))
	} catch (e) {
		if (e instanceof JiraError && (e.status === 400 || e.status === 404)) return res.json([])
		next(e)
	}
})

app.get('/api/projects/:key/labels', async (_req, res, next) => {
	try {
		res.json(await jira.labels())
	} catch (e) {
		next(e)
	}
})

app.get('/api/projects/:key/components', async (req, res, next) => {
	const key = projectKey(req, res)
	if (!key) return
	try {
		res.json(await jira.components(key))
	} catch (e) {
		next(e)
	}
})

// How many tickets a view's JQL finds, to try it before saving.
app.get('/api/projects/:key/jql-count', async (req, res, next) => {
	const key = projectKey(req, res)
	if (!key) return
	const jql = String(req.query.jql ?? '').trim()
	if (!jql || jql.length > 2000) return res.status(400).json({ error: messages(req).view.jql })
	try {
		const { issues, truncated } = await jira.search(viewJql(key, jql), ['summary'], 1000)
		res.json({ count: issues.length, truncated })
	} catch (e) {
		if (e instanceof JiraError && e.status === 400) return res.status(400).json({ error: messages(req).jqlInvalid(e.detail) })
		next(e)
	}
})

app.use('/api', (req, res) => res.status(404).json({ error: messages(req).notFound }))

const dist = path.join(root, 'dist')
if (fs.existsSync(dist)) {
	app.use(express.static(dist, { index: false, maxAge: '1h' }))
	app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
} else {
	app.get('/', (_req, res) => res.send('Ejecuta "npm run build" antes de "npm start".'))
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
	const m = messages(req)
	if (err instanceof JiraError) {
		const status = err.status === 401 || err.status === 403 ? 502 : err.status === 404 ? 404 : 502
		const message = err.captcha
			? m.captcha
			: err.status === 401
				? m.rejected
				: err.status === 403
					? `${m.forbidden}${err.detail ? ` (Jira: ${err.detail})` : ''}`
					: err.status === 404
						? m.projectNotFound
						: `${m.jiraStatus(err.status)}${err.detail ? `: ${err.detail}` : ''}`
		return res.status(status).json({ error: message })
	}
	console.error(err)
	res.status(502).json({ error: m.unreachable })
})

app.listen(config.port, '0.0.0.0', () => {
	const lan = Object.values(os.networkInterfaces())
		.flat()
		.filter((i) => i && i.family === 'IPv4' && !i.internal)
		.map((i) => `http://${i.address}:${config.port}`)
	console.log(`\nProDash ${version}${config.mock ? ' (modo demo)' : ''} listo:`)
	console.log(`  En este Mac:  http://localhost:${config.port}`)
	for (const url of lan) console.log(`  En el móvil:  ${url}  (misma Wi‑Fi)`)
	console.log('')
})
