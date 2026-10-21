// Forecast based on how long tickets take to close from each status, measured
// on the tickets closed in the period (from their Jira changelog).

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY
// A status needs this many measurements before its own numbers are trusted.
const MIN_SAMPLES = 3

function median(values) {
	if (!values.length) return null
	const sorted = [...values].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Every status an issue was in, with the moment it entered it.
function statusVisits(issue) {
	const visits = [{ status: issue.initialStatus ?? issue.status, at: issue.created }]
	for (const t of issue.transitions ?? []) visits.push({ status: t.to, at: t.at })
	return visits
}

/**
 * open, closedInPeriod: normalized issues (with `transitions`).
 * closeRatePerWeek: the project's closing pace in the period.
 * overrides: { [status]: days } typed by the user; they replace the measured value.
 * Returns null when nothing was closed in the period (nothing to learn from).
 */
export function statusForecast({ open, closedInPeriod, closeRatePerWeek, now, overrides = {} }) {
	const closed = closedInPeriod.filter((i) => i.closedAt != null && i.closedAt >= i.created)
	if (!closed.length) return null

	const categoryOf = new Map()
	for (const issue of [...open, ...closed]) categoryOf.set(issue.status, issue.category)
	const category = (status) => categoryOf.get(status) ?? 'indeterminate'

	// Days from entering a status until the ticket closed.
	const byStatus = new Map()
	const byCategory = new Map()
	for (const issue of closed) {
		for (const visit of statusVisits(issue)) {
			if (category(visit.status) === 'done' || visit.at > issue.closedAt) continue
			const days = (issue.closedAt - visit.at) / DAY
			for (const [map, key] of [
				[byStatus, visit.status],
				[byCategory, category(visit.status)],
			]) {
				if (!map.has(key)) map.set(key, [])
				map.get(key).push(days)
			}
		}
	}
	const cycleDays = median(closed.map((i) => (i.closedAt - i.created) / DAY))

	// Measurements for a status, falling back to its category, then to the
	// whole cycle (to do) or half of it (in progress).
	function source(status) {
		const override = overrides[status]
		if (typeof override === 'number') return { kind: 'override', samples: null, typical: override }
		const own = byStatus.get(status) ?? []
		if (own.length >= MIN_SAMPLES) return { kind: 'history', samples: own, typical: median(own) }
		const cat = byCategory.get(category(status)) ?? []
		if (cat.length >= MIN_SAMPLES) return { kind: 'category', samples: cat, typical: median(cat) }
		return { kind: 'default', samples: null, typical: category(status) === 'new' ? cycleDays : cycleDays / 2 }
	}

	// Expected days left for a ticket that has been `age` days in `status`:
	// among the measured tickets that stayed longer than that, how much more
	// they needed. A ticket older than all of them is close to leaving.
	function remaining(status, age) {
		const s = source(status)
		if (s.samples) {
			const longer = s.samples.filter((d) => d > age).map((d) => d - age)
			if (longer.length) return median(longer)
		} else if (s.typical > age) {
			return s.typical - age
		}
		return s.typical * 0.25
	}

	const perIssue = new Map()
	for (const issue of open) {
		const age = Math.max(0, (now - (issue.statusSince ?? issue.created)) / DAY)
		const days = remaining(issue.status, age)
		perIssue.set(issue.key, { days, work: cycleDays > 0 ? Math.min(days / cycleDays, 1) : 1 })
	}

	// A group of tickets is done when its slowest ticket is, but never faster
	// than the team closes that much work at its pace.
	function eta(keys) {
		const items = keys.map((k) => perIssue.get(k)).filter(Boolean)
		if (!items.length) return { etaWeeks: 0, etaDate: new Date(now).toISOString(), workUnits: 0 }
		const workUnits = items.reduce((sum, i) => sum + i.work, 0)
		const slowest = Math.max(...items.map((i) => i.days)) / 7
		const byPace = closeRatePerWeek > 0 ? workUnits / closeRatePerWeek : 0
		const etaWeeks = Math.max(slowest, byPace)
		return { etaWeeks, etaDate: new Date(now + etaWeeks * WEEK).toISOString(), workUnits }
	}

	const statusNames = [...new Set(open.map((i) => i.status))]
	return {
		basedOn: closed.length,
		cycleDays,
		statuses: statusNames.map((name) => {
			const s = source(name)
			return {
				name,
				category: category(name),
				typicalDays: s.typical,
				samples: byStatus.get(name)?.length ?? 0,
				source: s.kind,
			}
		}),
		...eta(open.map((i) => i.key)),
		eta,
	}
}
