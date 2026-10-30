export type Project = { key: string; name: string }

export type IssueType = {
	id: string
	name: string
	subtask: boolean
	hierarchyLevel: number
}

export type StatusCount = {
	name: string
	category: 'new' | 'indeterminate' | 'done'
	count: number
}

export type Health = 'good' | 'warning' | 'bad' | 'unknown'

export type StatusForecast = {
	// Tickets closed in the period that the forecast learned from.
	basedOn: number
	cycleDays: number
	statuses: {
		name: string
		category: StatusCount['category']
		typicalDays: number
		samples: number
		source: 'history' | 'category' | 'default' | 'override'
	}[]
	etaWeeks: number
	etaDate: string
	workUnits: number
}

export type StuckLevel = 'warning' | 'severe'

// Tickets in progress for more than twice the usual time in their status.
export type StuckTicket = {
	key: string
	summary: string
	status: string
	category: StatusCount['category']
	days: number
	usualDays: number
	times: number
	level: StuckLevel
}

export type Delivery = 'done' | 'onTrack' | 'late' | 'overdue' | 'unknown' | 'noDate'

export type EpicGroup = {
	// null groups the tickets without an epic.
	key: string | null
	name: string | null
	status: string | null
	category: StatusCount['category'] | null
	open: number
	closed: number
	closeRatePerWeek: number
	etaWeeks: number | null
	etaDate: string | null
	// Jira due date of the epic, "YYYY-MM-DD".
	statusEtaWeeks: number | null
	statusEtaDate: string | null
	workUnits: number | null
	dueDate: string | null
	// Compared with the pace (delivery) or with the forecast by status (statusDelivery).
	delivery: Delivery
	statusDelivery: Delivery
	byStatus: StatusCount[]
	issueCount: number
	issues: {
		key: string
		summary: string
		status: string
		category: StatusCount['category']
		stuck: StuckLevel | null
	}[]
}

export type Summary = {
	projectKey: string
	generatedAt: string
	periodDays: number | null
	periodStart: string
	openCount: number
	closedCount: number
	byStatus: StatusCount[]
	trajectory: {
		remaining: number
		closeRatePerWeek: number
		createRatePerWeek: number
		etaWeeks: number | null
		etaDate: string | null
		avgLeadTimeDays: number | null
		medianLeadTimeDays: number | null
		avgOpenAgeDays: number | null
		medianOpenAgeDays: number | null
		health: Health
	}
	history: { date: string; open: number }[]
	epics: EpicGroup[]
	statusForecast: StatusForecast | null
	stuck: { count: number; items: StuckTicket[] }
	view: { id: string; name: string } | null
	estimateScope: EstimateScope
	bugs: BugSummary | null
	jiraBaseUrl: string | null
	truncated: boolean
}

export type Session = { authenticated: boolean; mock: boolean; version?: string }

export type EstimateScope = 'project' | 'selection'

// Open bugs; priorities in Jira order (name null = no priority).
export type BugSummary = {
	total: number
	todo: number
	inProgress: number
	byPriority: { name: string | null; rank: number | null; count: number }[]
}

export type SavedView = {
	id: string
	projectKey: string
	name: string
	epics: string[]
	issues: string[]
	labels: string[]
	components: string[]
	jql: string
	estimateScope: EstimateScope
	bugBreakdown: boolean
	updatedAt: string
}

export type ViewInput = Omit<SavedView, 'id' | 'projectKey' | 'updatedAt'>

export type PickedIssue = { key: string; summary: string; status: string; type: string }

export class UnauthorizedError extends Error {}

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message)
	}
}

// The server answers its error messages in this language.
let lang = 'es'
export function setApiLang(value: string) {
	lang = value
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		...init,
		headers: { 'Content-Type': 'application/json', 'X-Lang': lang, ...init?.headers },
		credentials: 'same-origin',
	})
	if (res.status === 401 && path !== '/api/login') throw new UnauthorizedError()
	const data = await res.json().catch(() => ({}))
	if (!res.ok) throw new ApiError(data.error ?? `Error ${res.status}`, res.status)
	return data as T
}

export const api = {
	session: () => request<Session>('/api/session'),
	login: (password: string) =>
		request<{ ok: true }>('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),
	logout: () => request<{ ok: true }>('/api/logout', { method: 'POST' }),
	projects: () => request<Project[]>('/api/projects'),
	issueTypes: (key: string) => request<IssueType[]>(`/api/projects/${encodeURIComponent(key)}/issue-types`),
	summary: (
		key: string,
		days: number | 'all',
		exclude: string[],
		statusDays: Record<string, number>,
		fresh: boolean,
		view: { id: string; scope?: EstimateScope } | null,
		bugs = false,
	) =>
		request<Summary>(
			`/api/projects/${encodeURIComponent(key)}/summary?days=${days}&exclude=${exclude.join(',')}` +
				`&statusDays=${encodeURIComponent(JSON.stringify(statusDays))}${fresh ? '&fresh=1' : ''}` +
				(view ? `&view=${encodeURIComponent(view.id)}${view.scope ? `&scope=${view.scope}` : ''}` : '') +
				(bugs ? '&bugs=1' : ''),
		),
	views: (key: string) => request<SavedView[]>(`/api/projects/${encodeURIComponent(key)}/views`),
	createView: (key: string, view: ViewInput) =>
		request<SavedView>(`/api/projects/${encodeURIComponent(key)}/views`, { method: 'POST', body: JSON.stringify(view) }),
	updateView: (id: string, view: ViewInput) =>
		request<SavedView>(`/api/views/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(view) }),
	deleteView: (id: string) => request<{ ok: true }>(`/api/views/${encodeURIComponent(id)}`, { method: 'DELETE' }),
	epics: (key: string) => request<PickedIssue[]>(`/api/projects/${encodeURIComponent(key)}/epics`),
	searchIssues: (key: string, q: string) =>
		request<PickedIssue[]>(`/api/projects/${encodeURIComponent(key)}/issues?q=${encodeURIComponent(q)}`),
	labels: (key: string) => request<string[]>(`/api/projects/${encodeURIComponent(key)}/labels`),
	components: (key: string) => request<string[]>(`/api/projects/${encodeURIComponent(key)}/components`),
	jqlCount: (key: string, jql: string) =>
		request<{ count: number; truncated: boolean }>(
			`/api/projects/${encodeURIComponent(key)}/jql-count?jql=${encodeURIComponent(jql)}`,
		),
}

// Bugs/errors and epics are excluded unless the user changes it.
export function defaultExcluded(types: IssueType[]): string[] {
	return types
		.filter((t) => t.hierarchyLevel >= 1 || /(?<!\p{L})(bug|error|defect|defecto|epic|épica|epica)(?!\p{L})/iu.test(t.name))
		.map((t) => t.id)
}
