import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildSummary, normalizeIssue } from './metrics.js'
import { createViewStore, selectionMatcher, validateView, ViewError, viewJql } from './views.js'

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse('2026-10-22T12:00:00Z')
const at = (daysAgo) => new Date(now - daysAgo * DAY).toISOString()
const epic = (key) => ({ key, fields: { summary: key, issuetype: { hierarchyLevel: 1 }, status: { name: 'En curso', statusCategory: { key: 'indeterminate' } } } })

function issue(key, { done = false, parent, labels = [], components = [], created = 30, closed = 2 } = {}) {
	return normalizeIssue({
		key,
		fields: {
			status: done ? { name: 'Hecho', statusCategory: { key: 'done' } } : { name: 'En curso', statusCategory: { key: 'indeterminate' } },
			created: at(created),
			resolutiondate: done ? at(closed) : null,
			parent,
			labels,
			components: components.map((name) => ({ name })),
		},
	})
}

test('validates views and rejects empty or broken ones', () => {
	const v = validateView({ name: '  Producto A ', epics: ['SCRUM-1', 'SCRUM-1'], labels: ['a'], extra: 'x' })
	assert.deepEqual(v, { name: 'Producto A', epics: ['SCRUM-1'], issues: [], labels: ['a'], components: [], jql: '', estimateScope: 'project' })
	assert.throws(() => validateView({ name: 'Vacía' }), (e) => e instanceof ViewError && e.message === 'empty')
	assert.throws(() => validateView({ name: '', labels: ['a'] }), (e) => e.message === 'name')
	assert.throws(() => validateView({ name: 'X', epics: ['not a key'] }), (e) => e.message === 'list')
	assert.equal(viewJql('SCRUM', 'labels = a ORDER BY created DESC'), 'project = "SCRUM" AND (labels = a)')
})

test('stores, updates and deletes views in a JSON file', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prodash-views-'))
	const store = createViewStore(dir)
	const created = store.create('SCRUM', { name: 'A', labels: ['a'] })
	assert.equal(store.list('SCRUM').length, 1)
	assert.equal(store.list('OTHER').length, 0)
	assert.equal(store.update(created.id, { name: 'A2', labels: ['a'], estimateScope: 'selection' }).name, 'A2')
	assert.equal(createViewStore(dir).get(created.id).estimateScope, 'selection')
	assert.equal(store.remove(created.id), true)
	assert.equal(store.remove(created.id), false)
	fs.rmSync(dir, { recursive: true })
})

test('a ticket is in the view when it matches any criterion', () => {
	const all = [
		issue('S-1', { parent: epic('S-90') }),
		issue('S-2', { parent: { key: 'S-1', fields: { issuetype: { hierarchyLevel: -1 } } } }), // subtask of S-1
		issue('S-3', { labels: ['producto-a'] }),
		issue('S-4', { components: ['Web'] }),
		issue('S-5'),
		issue('S-6'),
	]
	const matches = selectionMatcher(
		{ epics: ['S-90'], issues: ['S-5'], labels: ['producto-a'], components: ['Web'] },
		all,
		new Set(['S-6']),
	)
	assert.deepEqual(all.filter(matches).map((i) => i.key), ['S-1', 'S-2', 'S-3', 'S-4', 'S-5', 'S-6'])
	const onlyEpic = selectionMatcher({ epics: ['S-90'], issues: [], labels: [], components: [] }, all)
	assert.deepEqual(all.filter(onlyEpic).map((i) => i.key), ['S-1', 'S-2'])
})

test('blocks show the selection; estimates come from the project or from the selection', () => {
	// Product A: 2 open, 1 closed. The rest of the project closed 7 more.
	const open = [issue('A-1', { labels: ['a'] }), issue('A-2', { labels: ['a'] }), issue('B-1', { labels: ['b'] })]
	const closed = [issue('A-3', { labels: ['a'], done: true }), ...Array.from({ length: 7 }, (_, n) => issue(`B-${n + 2}`, { labels: ['b'], done: true }))]
	const selection = selectionMatcher({ epics: [], issues: [], labels: ['a'], components: [] }, [...open, ...closed])

	const project = buildSummary({ open, closed, days: 28, now, selection, estimateScope: 'project' })
	assert.equal(project.openCount, 2)
	assert.equal(project.closedCount, 1)
	assert.equal(project.estimateScope, 'project')
	assert.equal(project.trajectory.closeRatePerWeek, 2) // 8 closed in 4 weeks

	const own = buildSummary({ open, closed, days: 28, now, selection, estimateScope: 'selection' })
	assert.equal(own.openCount, 2)
	assert.equal(own.trajectory.closeRatePerWeek, 0.25) // 1 closed in 4 weeks
	assert.equal(own.trajectory.etaWeeks, 8)
	assert.equal(own.statusForecast.basedOn, 1)
	assert.equal(project.statusForecast.basedOn, 8)
})
