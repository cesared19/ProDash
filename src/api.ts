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

export type EpicGroup = {
	// null groups the tickets without an epic.
	key: string | null
	name: string | null
	status: string | null
	category: StatusCount['category'] | null
	open: number
	closed: number
	byStatus: StatusCount[]
	issueCount: number
	issues: { key: string; summary: string; status: string; category: StatusCount['category'] }[]
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
	jiraBaseUrl: string | null
	truncated: boolean
}

export class UnauthorizedError extends Error {}

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
	if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
	return data as T
}

export const api = {
	session: () => request<{ authenticated: boolean; mock: boolean }>('/api/session'),
	login: (password: string) =>
		request<{ ok: true }>('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),
	logout: () => request<{ ok: true }>('/api/logout', { method: 'POST' }),
	projects: () => request<Project[]>('/api/projects'),
	issueTypes: (key: string) => request<IssueType[]>(`/api/projects/${encodeURIComponent(key)}/issue-types`),
	summary: (key: string, days: number | 'all', exclude: string[]) =>
		request<Summary>(
			`/api/projects/${encodeURIComponent(key)}/summary?days=${days}&exclude=${exclude.join(',')}`,
		),
}

// Bugs/errors and epics are excluded unless the user changes it.
export function defaultExcluded(types: IssueType[]): string[] {
	return types
		.filter((t) => t.hierarchyLevel >= 1 || /(?<!\p{L})(bug|error|defect|defecto|epic|épica|epica)(?!\p{L})/iu.test(t.name))
		.map((t) => t.id)
}
