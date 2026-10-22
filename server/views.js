// Saved views: named selections of tickets, shared by everyone, stored in a
// JSON file under DATA_DIR (a Docker volume in production).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/
const MAX_ITEMS = 200

export class ViewError extends Error {}

export function createViewStore(dir) {
	const file = path.join(dir, 'views.json')

	function readAll() {
		try {
			const data = JSON.parse(fs.readFileSync(file, 'utf8'))
			return Array.isArray(data.views) ? data.views : []
		} catch (e) {
			if (e.code === 'ENOENT') return []
			throw e
		}
	}

	// Write to a temporary file and rename it, so a crash never leaves half a file.
	function writeAll(views) {
		fs.mkdirSync(dir, { recursive: true })
		const tmp = `${file}.${process.pid}.tmp`
		fs.writeFileSync(tmp, JSON.stringify({ views }, null, 2))
		fs.renameSync(tmp, file)
	}

	return {
		list(projectKey) {
			return readAll().filter((v) => v.projectKey === projectKey)
		},
		get(id) {
			return readAll().find((v) => v.id === id) ?? null
		},
		create(projectKey, input) {
			const view = { id: crypto.randomUUID(), projectKey, ...validateView(input), updatedAt: new Date().toISOString() }
			writeAll([...readAll(), view])
			return view
		},
		update(id, input) {
			const views = readAll()
			const index = views.findIndex((v) => v.id === id)
			if (index === -1) return null
			views[index] = { ...views[index], ...validateView(input), updatedAt: new Date().toISOString() }
			writeAll(views)
			return views[index]
		},
		remove(id) {
			const views = readAll()
			const next = views.filter((v) => v.id !== id)
			if (next.length === views.length) return false
			writeAll(next)
			return true
		},
	}
}

function stringList(value, { max = MAX_ITEMS, maxLength = 100, pattern } = {}) {
	if (value == null) return []
	if (!Array.isArray(value)) throw new ViewError('list')
	const items = [...new Set(value.map((v) => String(v).trim()).filter(Boolean))]
	if (items.length > max || items.some((v) => v.length > maxLength || (pattern && !pattern.test(v)))) {
		throw new ViewError('list')
	}
	return items
}

// Keeps only known fields with safe values; throws ViewError otherwise.
export function validateView(input) {
	if (!input || typeof input !== 'object') throw new ViewError('invalid')
	const name = String(input.name ?? '').trim()
	if (!name || name.length > 60) throw new ViewError('name')
	const view = {
		name,
		epics: stringList(input.epics, { pattern: ISSUE_KEY }),
		issues: stringList(input.issues, { pattern: ISSUE_KEY }),
		labels: stringList(input.labels),
		components: stringList(input.components),
		jql: String(input.jql ?? '').trim(),
		estimateScope: input.estimateScope === 'selection' ? 'selection' : 'project',
	}
	if (view.jql.length > 2000) throw new ViewError('jql')
	if (!view.epics.length && !view.issues.length && !view.labels.length && !view.components.length && !view.jql) {
		throw new ViewError('empty')
	}
	return view
}

// The JQL of a view is run inside its project; an ORDER BY would break that.
export function viewJql(projectKey, jql) {
	return `project = "${projectKey}" AND (${jql.replace(/\s+order\s+by\s+[\s\S]*$/i, '')})`
}

/**
 * Builds the test for "is this ticket in the view": any of the criteria.
 * all: every loaded ticket (to find a subtask's epic through its parent).
 * jqlKeys: keys returned by the view's JQL, if it has one.
 */
export function selectionMatcher(view, all, jqlKeys = new Set()) {
	const byKey = new Map(all.map((i) => [i.key, i]))
	const epics = new Set(view.epics)
	const issues = new Set(view.issues)
	const labels = new Set(view.labels)
	const components = new Set(view.components)
	return (issue) => {
		const epic = issue.epic?.key ?? (issue.parentKey ? byKey.get(issue.parentKey)?.epic?.key : null)
		return (
			(epic != null && epics.has(epic)) ||
			epics.has(issue.key) ||
			issues.has(issue.key) ||
			(issue.parentKey != null && issues.has(issue.parentKey)) ||
			(issue.labels ?? []).some((l) => labels.has(l)) ||
			(issue.components ?? []).some((c) => components.has(c)) ||
			jqlKeys.has(issue.key)
		)
	}
}
