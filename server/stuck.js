// Tickets stuck in their current status: in progress for much longer than
// tickets usually stay in that status, measured on the Jira changelog.

const DAY = 24 * 60 * 60 * 1000
// A status needs this many measured stays before its own numbers are trusted.
const MIN_SAMPLES = 3
export const WARNING_TIMES = 2
export const SEVERE_TIMES = 3

function median(values) {
	if (!values.length) return null
	const sorted = [...values].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Finished stays of an issue: [status, days] for every status it entered and
// later left. The status it is in now has no end yet, so it is not counted.
function finishedStays(issue) {
	const visits = [{ status: issue.initialStatus ?? issue.status, at: issue.created }]
	for (const t of issue.transitions ?? []) visits.push({ status: t.to, at: t.at })
	const stays = []
	for (let i = 0; i < visits.length - 1; i++) {
		const days = (visits[i + 1].at - visits[i].at) / DAY
		if (days >= 0) stays.push([visits[i].status, days])
	}
	return stays
}

/**
 * open: the tickets to check. learnFrom: tickets whose past stays define
 * "usual" (closed and open ones). Only tickets in an in-progress status
 * count; to-do tickets have not started, so they are never stuck.
 * Returns the stuck tickets, most stuck first, and a key → level map.
 */
export function findStuck({ open, learnFrom, now }) {
	const categoryOf = new Map()
	for (const issue of [...open, ...learnFrom]) categoryOf.set(issue.status, issue.category)
	// A status seen only in the history: the one tickets are created in is a
	// to-do status, so its waiting time never counts as work in progress.
	for (const issue of [...open, ...learnFrom]) {
		if (issue.initialStatus && !categoryOf.has(issue.initialStatus)) categoryOf.set(issue.initialStatus, 'new')
	}
	const category = (status) => categoryOf.get(status) ?? 'indeterminate'

	const byStatus = new Map()
	const byCategory = new Map()
	for (const issue of learnFrom) {
		for (const [status, days] of finishedStays(issue)) {
			if (category(status) === 'done') continue
			for (const [map, key] of [
				[byStatus, status],
				[byCategory, category(status)],
			]) {
				if (!map.has(key)) map.set(key, [])
				map.get(key).push(days)
			}
		}
	}
	function usualDays(status) {
		const own = byStatus.get(status) ?? []
		if (own.length >= MIN_SAMPLES) return median(own)
		const cat = byCategory.get(category(status)) ?? []
		return cat.length >= MIN_SAMPLES ? median(cat) : null
	}

	const items = []
	for (const issue of open) {
		if (issue.category !== 'indeterminate') continue
		const usual = usualDays(issue.status)
		// Under half a day "usual" is too noisy to call anything stuck.
		if (usual == null || usual < 0.5) continue
		const days = Math.max(0, (now - (issue.statusSince ?? issue.created)) / DAY)
		const times = days / usual
		if (times <= WARNING_TIMES) continue
		items.push({
			key: issue.key,
			summary: issue.summary,
			status: issue.status,
			category: issue.category,
			days,
			usualDays: usual,
			times,
			level: times > SEVERE_TIMES ? 'severe' : 'warning',
		})
	}
	items.sort((a, b) => b.times - a.times)
	return { count: items.length, items, levelByKey: new Map(items.map((i) => [i.key, i.level])) }
}
