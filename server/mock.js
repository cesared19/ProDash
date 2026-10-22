import { JiraError } from './jira.js'

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

// Epic keys are numbered after the issues, as in Jira (APP-901…).
const EPIC_KEY_BASE = 900

// dueInDays: due date relative to today (null = no due date).
const EPICS = [
	{ name: 'Registro y login', status: 'En curso', category: 'indeterminate', dueInDays: 120 },
	{ name: 'Pagos con tarjeta', status: 'En curso', category: 'indeterminate', dueInDays: 21 },
	{ name: 'Notificaciones', status: 'Por hacer', category: 'new', dueInDays: -3 },
	{ name: 'Rediseño del perfil', status: 'En curso', category: 'indeterminate', dueInDays: null },
]

const SUMMARIES = [
	'Pantalla de inicio de sesión',
	'Validar formulario',
	'Ajustar textos',
	'Conectar con la API',
	'Revisar accesibilidad',
	'Mejorar rendimiento',
	'Corregir diseño en móvil',
	'Agregar pruebas',
	'Actualizar iconos',
	'Guardar preferencias',
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

// Status changes along Por hacer → En curso → En revisión → Hecho (Bloqueado
// hangs from En curso). Review is the short last step, as in real teams.
function history(current, created, end, isDone, rand) {
	const span = end - created
	const steps = isDone
		? [['En curso', 0.3], ['En revisión', 0.88], ['Hecho', 1]]
		: {
				'Por hacer': [],
				'En curso': [['En curso', 0.4 + rand() * 0.4]],
				'En revisión': [['En curso', 0.3], ['En revisión', 0.8 + rand() * 0.15]],
				Bloqueado: [['En curso', 0.3], ['Bloqueado', 0.6]],
			}[current] ?? []
	let from = 'Por hacer'
	return steps.map(([to, at]) => {
		const h = {
			created: new Date(created + span * at).toISOString(),
			items: [{ field: 'status', fromString: from, toString: to }],
		}
		from = to
		return h
	})
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
		// Subtasks hang from an earlier issue; the rest from an epic (or none).
		const epicIndex = Math.floor(rand() * (EPICS.length + 1))
		const parentN = type.subtask && n > 1 ? 1 + Math.floor(rand() * (n - 1)) : null
		const parent = parentN
			? { key: `${projectKey}-${parentN}`, fields: { summary: '', issuetype: { hierarchyLevel: 0 } } }
			: epicIndex < EPICS.length
				? {
						key: `${projectKey}-${EPIC_KEY_BASE + epicIndex + 1}`,
						fields: {
							summary: EPICS[epicIndex].name,
							issuetype: { hierarchyLevel: 1 },
							status: { name: EPICS[epicIndex].status, statusCategory: { key: EPICS[epicIndex].category } },
						},
					}
				: undefined
		issues.push({
			key: `${projectKey}-${n}`,
			typeId: type.id,
			changelog: { histories: history(status.name, created, closed ?? now, Boolean(closed), rand) },
			fields: {
				summary: SUMMARIES[Math.floor(rand() * SUMMARIES.length)],
				labels: rand() < 0.5 ? ['producto-a'] : rand() < 0.8 ? ['producto-b'] : ['producto-b', 'urgente'],
				components: [{ name: COMPONENTS[Math.floor(rand() * COMPONENTS.length)] }],
				priority: PRIORITIES[Math.min(4, Math.floor(rand() * rand() * 6))],
				parent,
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

// Two products sharing one Jira project, told apart by label and component.
const LABELS = ['producto-a', 'producto-b', 'urgente']
const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((name, i) => ({ id: String(i + 1), name }))
const COMPONENTS = ['App', 'Backend', 'Web']

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
		async labels() {
			return LABELS
		},
		async components() {
			return COMPONENTS
		},
		// Understands only the JQL shapes built in index.js.
		async search(jql) {
			const keys = jql.match(/^key in \(([^)]*)\)/)?.[1]?.split(',')
			if (keys) {
				const issues = keys.flatMap((k) => {
					const epic = EPICS[Number(k.split('-')[1]) - EPIC_KEY_BASE - 1]
					if (!epic) return []
					const due = epic.dueInDays == null ? null : new Date(Date.now() + epic.dueInDays * DAY).toISOString().slice(0, 10)
					return [{ key: k, fields: { duedate: due } }]
				})
				return { issues, truncated: false }
			}
			const key = jql.match(/project = "([^"]+)"/)?.[1] ?? 'APP'
			// Pickers of the view editor.
			const typeIds = jql.match(/issuetype in \(([^)]*)\)/)?.[1]?.split(',')
			if (typeIds && !typeIds.includes('10005')) {
				const issues = generate(key).filter(
					(i) => typeIds.includes(i.typeId) && i.fields.status.statusCategory.key !== 'done',
				)
				return { issues, truncated: false }
			}
			if (typeIds) {
				return {
					issues: EPICS.map((e, i) => ({
						key: `${key}-${EPIC_KEY_BASE + i + 1}`,
						fields: { summary: e.name, status: { name: e.status }, issuetype: { name: 'Epic' } },
					})),
					truncated: false,
				}
			}
			const byKey = jql.match(/key = "([^"]+)"/)?.[1]
			const text = jql.match(/text ~ "([^"*]*)\*?"/)?.[1]?.trim().toLowerCase()
			// A view's JQL: understands labels = x and component = x; anything with INVALID fails.
			const viewQuery = jql.match(/AND \((.*)\)$/)?.[1]
			if (byKey || text != null || viewQuery != null) {
				if (viewQuery && /invalid/i.test(viewQuery)) throw new JiraError(400, `Error en la consulta: ${viewQuery}`)
				const label = viewQuery?.match(/labels\s*=\s*"?([\w-]+)/i)?.[1]
				const component = viewQuery?.match(/component\s*=\s*"?([\w-]+)/i)?.[1]
				const issues = generate(key).filter((i) =>
					byKey
						? i.key === byKey
						: text != null
							? i.fields.summary.toLowerCase().includes(text)
							: label
								? i.fields.labels.includes(label)
								: component
									? i.fields.components.some((c) => c.name === component)
									: i.fields.issuetype.name === 'Historia',
				)
				return { issues: issues.slice(0, 1000), truncated: false }
			}
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
