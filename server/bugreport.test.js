import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBugReport, dayKey, previousWorkday, startOfDay } from './bugreport.js'

const TZ = 'America/Mexico_City' // UTC−6, no daylight saving

test('days are cut in the report time zone, and Monday compares with Friday', () => {
	// 05:30 UTC on Friday the 13th is still Thursday the 12th in Mexico City.
	assert.equal(dayKey(Date.parse('2026-11-13T05:30:00Z'), TZ), '2026-11-12')
	assert.equal(startOfDay('2026-11-13', TZ), Date.parse('2026-11-13T06:00:00Z'))
	assert.equal(previousWorkday('2026-11-16'), '2026-11-13') // Monday → Friday
	assert.equal(previousWorkday('2026-11-13'), '2026-11-12') // Friday → Thursday
	assert.equal(previousWorkday('2026-11-15'), '2026-11-13') // Sunday → Friday
})

const at = (iso) => Date.parse(iso)
function bug(key, created, { closed = null, priority = ['3', 'Medium'] } = {}) {
	return {
		key,
		summary: `Bug ${key}`,
		status: closed ? 'Done' : 'To Do',
		category: closed ? 'done' : 'new',
		created: at(created),
		closedAt: closed ? at(closed) : null,
		priority: priority ? { id: priority[0], name: priority[1] } : null,
	}
}

test('compares open bugs now with the end of the previous working day', () => {
	// Monday 16 Nov 2026, 10:00 in Mexico City (16:00 UTC).
	const now = at('2026-11-16T16:00:00Z')
	const open = [
		bug('B-1', '2026-11-01T15:00:00Z', { priority: ['1', 'Highest'] }),
		bug('B-2', '2026-11-12T15:00:00Z'), // Thursday
		bug('B-3', '2026-11-15T18:00:00Z', { priority: ['1', 'Highest'] }), // Sunday: after Friday's close
		bug('B-4', '2026-11-16T15:00:00Z'), // this morning
	]
	const closed = [
		bug('B-5', '2026-11-05T15:00:00Z', { closed: '2026-11-16T15:30:00Z' }), // closed this morning
		bug('B-6', '2026-11-05T15:00:00Z', { closed: '2026-11-13T17:00:00Z', priority: ['4', 'Low'] }), // closed Friday
	]
	const r = buildBugReport({ open, closed, now, timeZone: TZ })

	assert.equal(r.today, '2026-11-16')
	assert.equal(r.previousDay, '2026-11-13')
	assert.equal(r.openNow, 4)
	assert.equal(r.openBefore, 3) // B-1, B-2, B-5 at the end of Friday
	assert.deepEqual(r.added.items.map((i) => i.key), ['B-3', 'B-4']) // Highest first
	assert.deepEqual(r.closed.items.map((i) => i.key), ['B-5'])
	assert.equal(r.closed.before, 1) // B-6 closed on Friday
	assert.deepEqual(
		r.byPriority.map((p) => [p.name, p.now, p.before]),
		[
			['Highest', 2, 1],
			['Medium', 2, 2],
		],
	)
	// Trend: working days only, ending today; Thursday had B-1, B-2, B-5, B-6.
	assert.equal(r.trend.at(-1).day, '2026-11-16')
	assert.equal(r.trend.at(-1).open, 4)
	assert.equal(r.trend.find((p) => p.day === '2026-11-12').open, 4)
	assert.ok(r.trend.every((p) => ![0, 6].includes(new Date(`${p.day}T12:00:00Z`).getUTCDay())))
})

test('on a weekend the report still compares with Friday and shows today last', () => {
	const now = at('2026-11-15T18:00:00Z') // Sunday
	const r = buildBugReport({ open: [bug('B-1', '2026-11-14T15:00:00Z')], closed: [], now, timeZone: TZ })
	assert.equal(r.previousDay, '2026-11-13')
	assert.equal(r.openBefore, 0)
	assert.equal(r.openNow, 1)
	assert.equal(r.trend.at(-1).day, '2026-11-15')
	assert.equal(r.trend.at(-2).day, '2026-11-13')
})
