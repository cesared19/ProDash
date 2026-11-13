// Daily bug report: open bugs now against the end of the previous working
// day, what came in and what was closed since, by priority, and the trend.
// Past counts are rebuilt from each bug's created and closed dates, so the
// comparison works from the first day without stored history.

const MAX_LISTED = 50
const TREND_DAYS = 15

// Calendar date ("YYYY-MM-DD") of an instant in a time zone.
export function dayKey(ts, timeZone) {
	const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
		.formatToParts(new Date(ts))
		.reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {})
	return `${parts.year}-${parts.month}-${parts.day}`
}

// Milliseconds the time zone is ahead of UTC at an instant.
function offset(ts, timeZone) {
	const p = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
	})
		.formatToParts(new Date(ts))
		.reduce((acc, x) => ({ ...acc, [x.type]: Number(x.value) }), {})
	return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000
}

// The instant a calendar day starts in the time zone.
export function startOfDay(key, timeZone) {
	const [y, m, d] = key.split('-').map(Number)
	const guess = Date.UTC(y, m - 1, d)
	const first = guess - offset(guess, timeZone)
	// Once more in case the offset changes that day (daylight saving).
	return guess - offset(first, timeZone)
}

const addDays = (key, n) => {
	const [y, m, d] = key.split('-').map(Number)
	return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const weekday = (key) => new Date(`${key}T12:00:00Z`).getUTCDay()
const isWorkday = (key) => weekday(key) !== 0 && weekday(key) !== 6

export function previousWorkday(key) {
	let day = addDays(key, -1)
	while (!isWorkday(day)) day = addDays(day, -1)
	return day
}

const endOfDay = (key, timeZone) => startOfDay(addDays(key, 1), timeZone)

function item(bug) {
	return {
		key: bug.key,
		summary: bug.summary,
		status: bug.status,
		category: bug.category,
		priority: bug.priority?.name ?? null,
		priorityRank: Number(bug.priority?.id) || null,
	}
}

const byPriorityThenKey = (a, b) =>
	(a.priorityRank ?? Infinity) - (b.priorityRank ?? Infinity) || a.key.localeCompare(b.key, 'en', { numeric: true })

/**
 * open: bugs not closed. closed: bugs closed recently enough to matter for
 * the trend. A bug counts as open at an instant when it was created by then
 * and not yet closed. Priorities are today's (Jira's history of priority
 * changes is not read).
 */
export function buildBugReport({ open, closed, now = Date.now(), timeZone }) {
	const all = [...open, ...closed.filter((b) => b.closedAt != null)]
	const openAt = (t) => all.filter((b) => b.created <= t && (b.closedAt == null || b.closedAt > t))
	const createdIn = (from, to) => all.filter((b) => b.created > from && b.created <= to)
	const closedIn = (from, to) => all.filter((b) => b.closedAt != null && b.closedAt > from && b.closedAt <= to)

	const today = dayKey(now, timeZone)
	// Compared with the end of the previous working day: on Monday, Friday.
	const previousDay = previousWorkday(today)
	const since = endOfDay(previousDay, timeZone)
	const beforeSince = endOfDay(previousWorkday(previousDay), timeZone)

	const openNow = openAt(now)
	const openBefore = openAt(since)

	const priorities = new Map()
	for (const [bugs, field] of [
		[openNow, 'now'],
		[openBefore, 'before'],
	]) {
		for (const bug of bugs) {
			const name = bug.priority?.name ?? null
			const entry = priorities.get(name) ?? { name, rank: Number(bug.priority?.id) || null, now: 0, before: 0 }
			entry[field]++
			priorities.set(name, entry)
		}
	}

	const days = []
	for (let day = isWorkday(today) ? today : previousDay; days.length < TREND_DAYS; day = previousWorkday(day)) {
		days.unshift(day)
	}
	if (!isWorkday(today)) days.push(today)
	const trend = days.map((day) => ({ day, open: openAt(day === today ? now : endOfDay(day, timeZone)).length }))

	const added = createdIn(since, now).map(item).sort(byPriorityThenKey)
	const removed = closedIn(since, now).map(item).sort(byPriorityThenKey)
	return {
		timeZone,
		today,
		previousDay,
		openNow: openNow.length,
		openBefore: openBefore.length,
		added: { count: added.length, before: createdIn(beforeSince, since).length, items: added.slice(0, MAX_LISTED) },
		closed: { count: removed.length, before: closedIn(beforeSince, since).length, items: removed.slice(0, MAX_LISTED) },
		byPriority: [...priorities.values()].sort(
			(a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (a.name ?? '').localeCompare(b.name ?? ''),
		),
		trend,
	}
}
