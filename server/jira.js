export class JiraError extends Error {
	constructor(status, message) {
		super(message)
		this.status = status
	}
}

const PAGE_SIZE = 100

export function createJiraClient({ baseUrl, email, token }) {
	const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64')

	async function request(method, path, body) {
		const res = await fetch(baseUrl + path, {
			method,
			headers: {
				Authorization: auth,
				Accept: 'application/json',
				...(body ? { 'Content-Type': 'application/json' } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		})
		if (!res.ok) {
			let message = `Jira respondió ${res.status}`
			try {
				const data = await res.json()
				const detail = [...(data.errorMessages ?? []), ...Object.values(data.errors ?? {})]
				if (detail.length) message += `: ${detail.join(' ')}`
			} catch {
				// Not JSON; keep the status-only message.
			}
			throw new JiraError(res.status, message)
		}
		return res.json()
	}

	return {
		// Jira Cloud treats bad credentials as an anonymous visitor instead of
		// failing, so an empty project list is checked against /myself.
		async myself() {
			return request('GET', '/rest/api/3/myself')
		},

		async projects() {
			const projects = []
			let startAt = 0
			for (;;) {
				const page = await request(
					'GET',
					`/rest/api/3/project/search?orderBy=name&maxResults=50&startAt=${startAt}`,
				)
				projects.push(...page.values.map((p) => ({ key: p.key, name: p.name })))
				if (page.isLast || page.values.length === 0) break
				startAt += page.values.length
			}
			return projects
		},

		async issueTypes(projectKey) {
			const project = await request('GET', `/rest/api/3/project/${encodeURIComponent(projectKey)}`)
			return (project.issueTypes ?? []).map((t) => ({
				id: t.id,
				name: t.name,
				subtask: Boolean(t.subtask),
				hierarchyLevel: t.hierarchyLevel ?? 0,
			}))
		},

		// Uses the enhanced search endpoint (the old /search was retired in 2025).
		async search(jql, fields, limit) {
			const issues = []
			let nextPageToken
			do {
				const page = await request('POST', '/rest/api/3/search/jql', {
					jql,
					fields,
					maxResults: PAGE_SIZE,
					...(nextPageToken ? { nextPageToken } : {}),
				})
				issues.push(...page.issues)
				nextPageToken = page.nextPageToken
			} while (nextPageToken && issues.length < limit)
			return { issues: issues.slice(0, limit), truncated: Boolean(nextPageToken) || issues.length > limit }
		},
	}
}
