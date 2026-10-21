import { statusForecast } from './forecast.js'

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY
const CATEGORY_ORDER = { new: 0, indeterminate: 1, done: 2 }

// Flattens a Jira issue into the few fields the dashboard needs.
export function normalizeIssue(issue) {
	const f = issue.fields ?? {}
	const done = f.status?.statusCategory?.key === 'done'
	const closedRaw = done ? (f.resolutiondate ?? f.statuscategorychangedate) : null
	// `parent` is the epic for standard issues and the parent issue for subtasks
	// (Jira Cloud uses it for both company- and team-managed projects).
	const parent = f.parent
	const parentIsEpic = (parent?.fields?.issuetype?.hierarchyLevel ?? 0) >= 1
	const created = Date.parse(f.created)
	// Status changes from the changelog, oldest first.
	const transitions = (issue.changelog?.histories ?? [])
		.flatMap((h) =>
			(h.items ?? [])
				.filter((item) => item.field === 'status')
				.map((item) => ({ at: Date.parse(h.created), from: item.fromString, to: item.toString })),
		)
		.filter((t) => !Number.isNaN(t.at))
		.sort((a, b) => a.at - b.at)
	return {
		key: issue.key,
		summary: f.summary ?? '',
		status: f.status?.name ?? 'Sin estado',
		category: f.status?.statusCategory?.key ?? 'new',
		created,
		closedAt: closedRaw ? Date.parse(closedRaw) : null,
		transitions,
		initialStatus: transitions[0]?.from ?? f.status?.name ?? 'Sin estado',
		statusSince: transitions.at(-1)?.at ?? created,
		parentKey: parent?.key ?? null,
		epic: parentIsEpic
			? {
					key: parent.key,
					name: parent.fields?.summary ?? parent.key,
					status: parent.fields?.status?.name ?? '',
					category: parent.fields?.status?.statusCategory?.key ?? 'new',
				}
			: null,
	}
}

const MAX_ISSUES_PER_EPIC = 200

/**
 * Groups open issues and those closed in the period by epic. Subtasks take
 * the epic of their parent when the parent is among the loaded issues.
 * Issues without an epic go to a last group with key null.
 * Each group gets its own pace: closed in the period ÷ `weeks`.
 */
export function buildEpics(open, closedInPeriod, { weeks = 1, now = Date.now(), forecast = null } = {}) {
	const all = [...open, ...closedInPeriod]
	const byKey = new Map(all.map((i) => [i.key, i]))
	const groups = new Map()
	for (const issue of all) {
		const epic = issue.epic ?? (issue.parentKey ? byKey.get(issue.parentKey)?.epic : null) ?? null
		const id = epic?.key ?? null
		let group = groups.get(id)
		if (!group) {
			group = { key: id, name: epic?.name ?? null, status: epic?.status ?? null, category: epic?.category ?? null, open: 0, closed: 0, byStatus: new Map(), issues: [] }
			groups.set(id, group)
		}
		if (issue.category === 'done') group.closed++
		else {
			group.open++
			const entry = group.byStatus.get(issue.status) ?? { name: issue.status, category: issue.category, count: 0 }
			entry.count++
			group.byStatus.set(issue.status, entry)
		}
		group.issues.push(issue)
	}
	const rank = (i) => (CATEGORY_ORDER[i.category] ?? 1)
	return [...groups.values()]
		.sort((a, b) => (a.key === null) - (b.key === null) || b.open - a.open || b.closed - a.closed)
		.map((g) => {
			const issues = g.issues.sort(
				(a, b) => rank(a) - rank(b) || (b.closedAt ?? 0) - (a.closedAt ?? 0) || a.created - b.created,
			)
			const closeRatePerWeek = g.closed / weeks
			const byStatus = forecast?.eta(issues.filter((i) => i.category !== 'done').map((i) => i.key))
			const etaWeeks = g.open === 0 ? 0 : closeRatePerWeek > 0 ? g.open / closeRatePerWeek : null
			return {
				key: g.key,
				name: g.name,
				status: g.status,
				category: g.category,
				open: g.open,
				closed: g.closed,
				closeRatePerWeek,
				etaWeeks,
				etaDate: etaWeeks != null ? new Date(now + etaWeeks * WEEK).toISOString() : null,
				statusEtaWeeks: byStatus?.etaWeeks ?? null,
				statusEtaDate: byStatus?.etaDate ?? null,
				workUnits: byStatus?.workUnits ?? null,
				dueDate: null,
				delivery: g.open === 0 ? 'done' : 'noDate',
				statusDelivery: g.open === 0 ? 'done' : 'noDate',
				byStatus: [...g.byStatus.values()].sort((a, b) => rank(a) - rank(b) || b.count - a.count),
				issueCount: issues.length,
				issues: issues.slice(0, MAX_ISSUES_PER_EPIC).map((i) => ({
					key: i.key,
					summary: i.summary,
					status: i.status,
					category: i.category,
				})),
			}
		})
}

function average(values) {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

function median(values) {
	if (!values.length) return null
	const sorted = [...values].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Builds the dashboard summary.
 * open: issues not in the Done category. closed: Done issues, possibly
 * including some closed before the period (the JQL filters on `updated`).
 * days: period length, or null for the whole history.
 */
export function buildSummary({ open, closed, days, now = Date.now(), statusDays = {} }) {
	const allClosed = closed.filter((i) => i.closedAt != null && !Number.isNaN(i.closedAt))
	const earliest = Math.min(
		now - WEEK,
		...allClosed.map((i) => i.closedAt),
		...open.map((i) => i.created).filter((t) => !Number.isNaN(t)),
	)
	const since = days ? now - days * DAY : earliest
	const closedInPeriod = allClosed.filter((i) => i.closedAt >= since)
	const weeks = Math.max((now - since) / WEEK, 1)

	const byStatusMap = new Map()
	for (const issue of open) {
		const entry = byStatusMap.get(issue.status) ?? { name: issue.status, category: issue.category, count: 0 }
		entry.count++
		byStatusMap.set(issue.status, entry)
	}
	const byStatus = [...byStatusMap.values()].sort(
		(a, b) => (CATEGORY_ORDER[a.category] ?? 1) - (CATEGORY_ORDER[b.category] ?? 1) || b.count - a.count,
	)

	const leadTimes = closedInPeriod.map((i) => (i.closedAt - i.created) / DAY).filter((d) => d >= 0)
	const openAges = open.map((i) => (now - i.created) / DAY).filter((d) => d >= 0)

	const closeRate = closedInPeriod.length / weeks
	const createdInPeriod =
		open.filter((i) => i.created >= since).length + closedInPeriod.filter((i) => i.created >= since).length
	const createRate = createdInPeriod / weeks
	const etaWeeks = open.length === 0 ? 0 : closeRate > 0 ? open.length / closeRate : null
	const forecast = statusForecast({ open, closedInPeriod, closeRatePerWeek: closeRate, now, overrides: statusDays })

	const avgLead = average(leadTimes)
	const avgAge = average(openAges)
	let health = 'unknown'
	if (open.length === 0) health = 'good'
	else if (avgLead != null && avgAge != null) {
		const ratio = avgAge / Math.max(avgLead, 0.5)
		health = ratio <= 1 ? 'good' : ratio <= 1.5 ? 'warning' : 'bad'
	} else if (closeRate === 0) health = 'bad'

	// Open count at each weekly mark: created by then and not yet closed.
	// Only issues closed after `since` can be open inside the window.
	const historyStart = Math.max(since, now - 52 * WEEK)
	const step = Math.max(WEEK, Math.ceil((now - historyStart) / 26 / DAY) * DAY)
	const history = []
	for (let t = historyStart; ; t += step) {
		const at = Math.min(t, now)
		const count =
			open.filter((i) => i.created <= at).length +
			closedInPeriod.filter((i) => i.created <= at && i.closedAt > at).length
		history.push({ date: new Date(at).toISOString(), open: count })
		if (at === now) break
	}

	return {
		generatedAt: new Date(now).toISOString(),
		periodDays: days,
		periodStart: new Date(since).toISOString(),
		openCount: open.length,
		closedCount: closedInPeriod.length,
		byStatus,
		trajectory: {
			remaining: open.length,
			closeRatePerWeek: closeRate,
			createRatePerWeek: createRate,
			etaWeeks,
			etaDate: etaWeeks != null ? new Date(now + etaWeeks * WEEK).toISOString() : null,
			avgLeadTimeDays: avgLead,
			medianLeadTimeDays: median(leadTimes),
			avgOpenAgeDays: avgAge,
			medianOpenAgeDays: median(openAges),
			health,
		},
		history,
		epics: buildEpics(open, closedInPeriod, { weeks, now, forecast }),
		statusForecast: forecast ? { ...forecast, eta: undefined } : null,
	}
}

/**
 * Adds each epic's Jira due date ("YYYY-MM-DD") and whether, at its pace,
 * it closes by then: done, onTrack, late, overdue (date already passed),
 * unknown (no closures to estimate from) or noDate.
 */
export function applyDueDates(epics, dueByKey, now = Date.now()) {
	return epics.map((epic) => {
		const dueDate = (epic.key && dueByKey.get(epic.key)) || null
		// The due date counts until the end of that day.
		const dueEnd = dueDate ? Date.parse(`${dueDate}T23:59:59`) : null
		const compare = (etaDate, current) => {
			if (epic.open === 0 || dueEnd == null) return current
			if (dueEnd < now) return 'overdue'
			if (etaDate == null) return 'unknown'
			return Date.parse(etaDate) <= dueEnd ? 'onTrack' : 'late'
		}
		return {
			...epic,
			dueDate,
			delivery: compare(epic.etaDate, epic.delivery),
			statusDelivery: compare(epic.statusEtaDate, epic.statusDelivery),
		}
	})
}
