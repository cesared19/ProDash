import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSummary, normalizeIssue } from './metrics.js'

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse('2026-10-19T12:00:00Z')
const ago = (days) => new Date(now - days * DAY).toISOString()

function issue(status, category, created, closed) {
	return normalizeIssue({
		key: 'X-1',
		fields: {
			status: { name: status, statusCategory: { key: category } },
			created: ago(created),
			resolutiondate: closed != null ? ago(closed) : null,
			statuscategorychangedate: ago(closed ?? created),
		},
	})
}

test('counts open issues by status and closed issues inside the period', () => {
	const open = [issue('Por hacer', 'new', 10), issue('En curso', 'indeterminate', 20), issue('En curso', 'indeterminate', 5)]
	const closed = [issue('Hecho', 'done', 40, 30), issue('Hecho', 'done', 50, 35), issue('Hecho', 'done', 200, 120)]
	const s = buildSummary({ open, closed, days: 90, now })

	assert.equal(s.openCount, 3)
	assert.equal(s.closedCount, 2)
	assert.deepEqual(
		s.byStatus.map((b) => [b.name, b.count]),
		[
			['Por hacer', 1],
			['En curso', 2],
		],
	)
	assert.equal(s.trajectory.avgLeadTimeDays, 12.5)
	assert.ok(Math.abs(s.trajectory.avgOpenAgeDays - 35 / 3) < 1e-9)
	// 2 closed in 90 days → 3 open take 3 / (2 / (90/7)) weeks.
	assert.ok(Math.abs(s.trajectory.etaWeeks - 3 / (2 / (90 / 7))) < 1e-9)
	assert.equal(s.trajectory.health, 'good')
})

test('falls back to the status change date when there is no resolution', () => {
	const i = normalizeIssue({
		key: 'X-2',
		fields: {
			status: { name: 'Hecho', statusCategory: { key: 'done' } },
			created: ago(10),
			resolutiondate: null,
			statuscategorychangedate: ago(3),
		},
	})
	assert.equal(i.closedAt, now - 3 * DAY)
})

test('cannot estimate without closures and reconstructs the open history', () => {
	const open = [issue('Por hacer', 'new', 60), issue('Por hacer', 'new', 2)]
	const s = buildSummary({ open, closed: [], days: 30, now })
	assert.equal(s.trajectory.etaWeeks, null)
	assert.equal(s.trajectory.health, 'bad')
	assert.equal(s.history[0].open, 1)
	assert.equal(s.history.at(-1).open, 2)
})

test('an empty backlog is done', () => {
	const s = buildSummary({ open: [], closed: [issue('Hecho', 'done', 9, 1)], days: 30, now })
	assert.equal(s.trajectory.etaWeeks, 0)
	assert.equal(s.trajectory.health, 'good')
})
