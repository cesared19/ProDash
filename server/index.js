import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { loadEnvFile, readConfig } from './env.js'
import { createJiraClient, JiraError } from './jira.js'
import { createMockClient } from './mock.js'
import { buildSummary, normalizeIssue } from './metrics.js'
import { messages } from './messages.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(path.join(root, '.env'))
const { config, missing } = readConfig()
if (missing.length) {
	console.error(`Faltan variables en .env: ${missing.join(', ')}`)
	console.error('Copia .env.example a .env y complétalo.')
	process.exit(1)
}

const jira = config.mock ? createMockClient() : createJiraClient(config.jira)
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
app.use(express.json({ limit: '10kb' }))

app.get('/api/session', (req, res) => {
	res.json({ authenticated: sessionValid(req), mock: config.mock })
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

app.get('/api/projects/:key/summary', async (req, res, next) => {
	const key = projectKey(req, res)
	if (!key) return
	const days = req.query.days === 'all' ? null : Math.min(Math.max(Number(req.query.days) || 90, 1), 3650)
	const exclude = String(req.query.exclude ?? '')
		.split(',')
		.filter((id) => /^\d+$/.test(id))
	try {
		let base = `project = "${key}"`
		if (exclude.length) base += ` AND issuetype not in (${exclude.join(',')})`
		const fields = ['summary', 'status', 'created', 'resolutiondate', 'statuscategorychangedate', 'parent']
		// `updated` is a cheap superset filter: closing an issue updates it.
		// The exact close date is checked in buildSummary.
		const closedJql = `${base} AND statusCategory = Done${days ? ` AND updated >= -${days}d` : ''} ORDER BY updated DESC`
		const [open, closed] = await Promise.all([
			jira.search(`${base} AND statusCategory != Done ORDER BY created ASC`, fields, MAX_ISSUES),
			jira.search(closedJql, fields, MAX_ISSUES),
		])
		const summary = buildSummary({
			open: open.issues.map(normalizeIssue),
			closed: closed.issues.map(normalizeIssue),
			days,
		})
		res.json({
			...summary,
			projectKey: key,
			jiraBaseUrl: config.mock ? null : config.jira.baseUrl,
			truncated: open.truncated || closed.truncated,
		})
	} catch (e) {
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
		const message =
			err.status === 401
				? m.rejected
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
	console.log(`\nProDash${config.mock ? ' (modo demo)' : ''} listo:`)
	console.log(`  En este Mac:  http://localhost:${config.port}`)
	for (const url of lan) console.log(`  En el móvil:  ${url}  (misma Wi‑Fi)`)
	console.log('')
})
