import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSummary, normalizeIssue } from './metrics.js'

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse('2026-10-21T12:00:00Z')
const at = (daysAgo) => new Date(now - daysAgo * DAY).toISOString()
const epic = (key) => ({ key, fields: { summary: key, issuetype: { hierarchyLevel: 1 }, status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } } } })
const CATEGORY = { 'To Do': 'new', 'In Progress': 'indeterminate', 'Waiting for build': 'indeterminate', Done: 'done' }

// path: [[status, daysAgo], ...] starting with the creation status.
function issue(key, path, parent) {
	const [first, ...rest] = path
	const current = path.at(-1)[0]
	let from = first[0]
	const histories = rest.map(([to, daysAgo]) => {
		const h = { created: at(daysAgo), items: [{ field: 'status', fromString: from, toString: to }] }
		from = to
		return h
	})
	return normalizeIssue({
		key,
		changelog: { histories },
		fields: {
			status: { name: current, statusCategory: { key: CATEGORY[current] } },
			created: at(first[1]),
			resolutiondate: current === 'Done' ? at(path.at(-1)[1]) : null,
			parent,
		},
	})
}

// The team's history: tickets spend ~20 days in progress and ~2 in "Waiting for build".
const history = Array.from({ length: 8 }, (_, n) =>
	issue(`H-${n}`, [['To Do', 60 - n], ['In Progress', 40 - n], ['Waiting for build', 20 - n], ['Done', 18 - n]]),
)

test('tickets waiting for build count as almost closed', () => {
	const open = [
		...Array.from({ length: 5 }, (_, n) => issue(`W-${n}`, [['To Do', 50], ['In Progress', 30], ['Waiting for build', 1]], epic('E-1'))),
		issue('P-1', [['To Do', 30], ['In Progress', 5]], epic('E-1')),
	]
	const closed = [...history, issue('C-1', [['To Do', 60], ['In Progress', 40], ['Waiting for build', 25], ['Done', 24]], epic('E-1'))]
	const s = buildSummary({ open, closed, days: 90, now })
	const e1 = s.epics.find((e) => e.key === 'E-1')

	// One closure in 90 days: the pace says 6 tickets take ~77 weeks.
	assert.ok(e1.etaWeeks > 70)
	// By status: 5 tickets need ~1 more day, the one in progress ~15 more days.
	assert.ok(e1.statusEtaWeeks < 3, `expected under 3 weeks, got ${e1.statusEtaWeeks}`)
	assert.ok(e1.workUnits < 2.5, `expected under 2.5 tickets of work, got ${e1.workUnits}`)
	const waiting = s.statusForecast.statuses.find((x) => x.name === 'Waiting for build')
	assert.equal(waiting.source, 'history')
	assert.equal(waiting.typicalDays, 2)
	assert.equal(s.statusForecast.basedOn, 9)
})

test('a typed number of days replaces the measured one', () => {
	const open = [issue('W-1', [['To Do', 50], ['Waiting for build', 1]], epic('E-1'))]
	const s = buildSummary({ open, closed: history, days: 90, now, statusDays: { 'Waiting for build': 30 } })
	const waiting = s.statusForecast.statuses.find((x) => x.name === 'Waiting for build')
	assert.equal(waiting.source, 'override')
	assert.ok(Math.abs(s.epics[0].statusEtaWeeks - 29 / 7) < 1e-9)
})

test('statuses without enough history fall back to their category, and nothing closed means no forecast', () => {
	const open = [issue('R-1', [['To Do', 10], ['In Progress', 2]])]
	const s = buildSummary({ open, closed: history, days: 90, now })
	assert.equal(s.statusForecast.statuses[0].source, 'history')
	const none = buildSummary({ open, closed: [], days: 90, now })
	assert.equal(none.statusForecast, null)
	assert.equal(none.epics[0].statusEtaWeeks, null)
})
