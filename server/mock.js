// Demo data (JIRA_MOCK=true) to try the dashboard without a Jira account.
const DAY = 24 * 60 * 60 * 1000

const PROJECTS = [
	{ key: 'APP', name: 'App Móvil' },
	{ key: 'WEB', name: 'Portal Web' },
	{ key: 'OPS', name: 'Operaciones' },
]

const TYPES = [
	{ id: '10001', name: 'Historia', subtask: false, hierarchyLevel: 0 },
	{ id: '10002', name: 'Tarea', subtask: false, hierarchyLevel: 0 },
	{ id: '10003', name: 'Subtarea', subtask: true, hierarchyLevel: -1 },
	{ id: '10004', name: 'Error', subtask: false, hierarchyLevel: 0 },
	{ id: '10005', name: 'Epic', subtask: false, hierarchyLevel: 1 },
]

const OPEN_STATUSES = [
	{ name: 'Por hacer', category: 'new', weight: 5 },
	{ name: 'En curso', category: 'indeterminate', weight: 4 },
	{ name: 'En revisión', category: 'indeterminate', weight: 2 },
	{ name: 'Bloqueado', category: 'indeterminate', weight: 1 },
]

function seeded(seed) {
	let s = seed
	return () => {
		s = (s * 1664525 + 1013904223) % 4294967296
		return s / 4294967296
	}
}

function generate(projectKey) {
	const rand = seeded([...projectKey].reduce((a, c) => a + c.charCodeAt(0), 0) * 97)
	const now = Date.now()
	const issues = []
	const total = 160 + Math.floor(rand() * 80)
	for (let n = 1; n <= total; n++) {
		const type = TYPES[Math.floor(rand() * TYPES.length)]
		const created = now - rand() * 200 * DAY
		const isDone = rand() < 0.62
		const status = isDone
			? { name: 'Hecho', category: 'done' }
			: (() => {
					let r = rand() * OPEN_STATUSES.reduce((a, s) => a + s.weight, 0)
					return OPEN_STATUSES.find((s) => (r -= s.weight) < 0) ?? OPEN_STATUSES[0]
				})()
		const closed = isDone ? Math.min(now, created + (2 + rand() * 30) * DAY) : null
		issues.push({
			key: `${projectKey}-${n}`,
			typeId: type.id,
			fields: {
				created: new Date(created).toISOString(),
				resolutiondate: closed ? new Date(closed).toISOString() : null,
				statuscategorychangedate: new Date(closed ?? created).toISOString(),
				updated: new Date(closed ?? now - rand() * 10 * DAY).toISOString(),
				status: { name: status.name, statusCategory: { key: status.category } },
				issuetype: { id: type.id, name: type.name },
			},
		})
	}
	return issues
}

export function createMockClient() {
	return {
		async myself() {
			return { emailAddress: 'demo@example.com' }
		},
		async projects() {
			return PROJECTS
		},
		async issueTypes() {
			return TYPES
		},
		// Understands only the JQL shapes built in index.js.
		async search(jql) {
			const key = jql.match(/project = "([^"]+)"/)?.[1] ?? 'APP'
			const excluded = jql.match(/issuetype not in \(([^)]*)\)/)?.[1]?.split(',') ?? []
			const wantDone = /statusCategory = Done/.test(jql)
			const days = Number(jql.match(/updated >= -(\d+)d/)?.[1]) || null
			const since = days ? Date.now() - days * DAY : 0
			const issues = generate(key).filter(
				(i) =>
					!excluded.includes(i.typeId) &&
					(i.fields.status.statusCategory.key === 'done') === wantDone &&
					Date.parse(i.fields.updated) >= since,
			)
			return { issues, truncated: false }
		},
	}
}
