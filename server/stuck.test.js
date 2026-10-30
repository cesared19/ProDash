import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSummary, normalizeIssue } from './metrics.js'
import { findStuck } from './stuck.js'

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse('2026-10-30T12:00:00Z')
const at = (daysAgo) => new Date(now - daysAgo * DAY).toISOString()
const CATEGORY = { 'To Do': 'new', 'In Progress': 'indeterminate', 'Waiting for build': 'indeterminate', QA: 'indeterminate', Done: 'done' }

// path: [[status, daysAgo], ...] starting with the creation status.
function issue(key, path) {
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
			summary: `Ticket ${key}`,
			status: { name: current, statusCategory: { key: CATEGORY[current] } },
			created: at(first[1]),
			resolutiondate: current === 'Done' ? at(path.at(-1)[1]) : null,
		},
	})
}

// History: tickets stay ~10 days in progress and ~2 days waiting for build.
const history = Array.from({ length: 5 }, (_, n) =>
	issue(`H-${n}`, [['To Do', 60 - n], ['In Progress', 40 - n], ['Waiting for build', 30 - n], ['Done', 28 - n]]),
)

test('flags tickets in progress that stay more than twice the usual time, most stuck first', () => {
	const open = [
		issue('W-1', [['To Do', 50], ['In Progress', 40], ['Waiting for build', 19]]), // 19 / 2 = ×9.5 → severe
		issue('W-2', [['To Do', 50], ['In Progress', 40], ['Waiting for build', 5]]), // ×2.5 → warning
		issue('W-3', [['To Do', 50], ['In Progress', 40], ['Waiting for build', 3]]), // ×1.5 → fine
		issue('P-1', [['To Do', 50], ['In Progress', 25]]), // ×2.5 → warning
		issue('T-1', [['To Do', 200]]), // to do: never stuck
	]
	const { count, items, levelByKey } = findStuck({ open, learnFrom: history, now })
	assert.equal(count, 3)
	assert.deepEqual(
		items.map((i) => [i.key, i.level]),
		[
			['W-1', 'severe'],
			['W-2', 'warning'],
			['P-1', 'warning'],
		],
	)
	assert.equal(items[0].usualDays, 2)
	assert.equal(items[0].times, 9.5)
	assert.equal(levelByKey.get('W-3'), undefined)
})

test('a status with little history uses its kind of status; with none at all, nothing is flagged', () => {
	// QA has no history of its own: it uses the in-progress median (10 and 2 days → 6).
	const qa = issue('Q-1', [['To Do', 50], ['QA', 20]])
	const { items } = findStuck({ open: [qa], learnFrom: history, now })
	assert.equal(items[0].usualDays, 6)
	assert.equal(findStuck({ open: [qa], learnFrom: [], now }).count, 0)
})

test('the summary lists stuck tickets and marks them in their epic', () => {
	const stuck = issue('W-1', [['To Do', 50], ['In Progress', 40], ['Waiting for build', 19]])
	stuck.epic = { key: 'E-1', name: 'E', status: 'In Progress', category: 'indeterminate' }
	const s = buildSummary({ open: [stuck], closed: history, days: 90, now })
	assert.equal(s.stuck.count, 1)
	assert.equal(s.epics.find((e) => e.key === 'E-1').issues[0].stuck, 'severe')
})
