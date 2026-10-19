const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY
const CATEGORY_ORDER = { new: 0, indeterminate: 1, done: 2 }

// Flattens a Jira issue into the few fields the dashboard needs.
export function normalizeIssue(issue) {
	const f = issue.fields ?? {}
	const done = f.status?.statusCategory?.key === 'done'
	const closedRaw = done ? (f.resolutiondate ?? f.statuscategorychangedate) : null
	return {
		key: issue.key,
		status: f.status?.name ?? 'Sin estado',
		category: f.status?.statusCategory?.key ?? 'new',
		created: Date.parse(f.created),
		closedAt: closedRaw ? Date.parse(closedRaw) : null,
	}
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
export function buildSummary({ open, closed, days, now = Date.now() }) {
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
	}
}
