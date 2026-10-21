export class JiraError extends Error {
	// `detail` is Jira's own explanation, if it gave one; `reason` comes from
	// its authentication headers (for example a CAPTCHA lockout).
	constructor(status, detail, reason = '') {
		super(`Jira ${status}${detail ? `: ${detail}` : ''}${reason ? ` [${reason}]` : ''}`)
		this.status = status
		this.detail = detail
		this.reason = reason
	}

	get captcha() {
		return /captcha|authentication_denied/i.test(this.reason)
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
			let detail = ''
			const text = await res.text()
			try {
				const data = JSON.parse(text)
				detail = [...(data.errorMessages ?? []), ...Object.values(data.errors ?? {})].join(' ')
			} catch {
				// Not JSON (often an HTML page); keep it out of the message.
			}
			const reason = [res.headers.get('x-authentication-denied-reason'), res.headers.get('x-seraph-loginreason')]
				.filter(Boolean)
				.join('; ')
			const error = new JiraError(res.status, detail, reason)
			if (res.status === 401 || res.status === 403) {
				console.error(`[jira] ${method} ${path} → ${error.message}${detail ? '' : ` ${text.slice(0, 200).replace(/\s+/g, ' ')}`}`)
			}
			throw error
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
		// `expand` can be 'changelog' to include each issue's history.
		async search(jql, fields, limit, expand) {
			const issues = []
			let nextPageToken
			do {
				const page = await request('POST', '/rest/api/3/search/jql', {
					jql,
					fields,
					maxResults: PAGE_SIZE,
					...(expand ? { expand } : {}),
					...(nextPageToken ? { nextPageToken } : {}),
				})
				issues.push(...page.issues)
				nextPageToken = page.nextPageToken
			} while (nextPageToken && issues.length < limit)
			return { issues: issues.slice(0, limit), truncated: Boolean(nextPageToken) || issues.length > limit }
		},
	}
}
