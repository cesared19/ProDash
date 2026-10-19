import fs from 'node:fs'

// Minimal .env loader so the app runs on any Node 18+ without extra packages.
// Variables already set in the environment win over the file.
export function loadEnvFile(file) {
	if (!fs.existsSync(file)) return
	for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
		const line = raw.trim()
		if (!line || line.startsWith('#')) continue
		const eq = line.indexOf('=')
		if (eq === -1) continue
		const key = line.slice(0, eq).trim()
		let value = line.slice(eq + 1).trim()
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1)
		}
		if (process.env[key] === undefined) process.env[key] = value
	}
}

export function readConfig() {
	const mock = /^(1|true|yes)$/i.test(process.env.JIRA_MOCK ?? '')
	const config = {
		port: Number(process.env.PORT) || 3100,
		password: process.env.DASHBOARD_PASSWORD ?? '',
		mock,
		jira: {
			baseUrl: (process.env.JIRA_BASE_URL ?? '').replace(/\/+$/, ''),
			email: process.env.JIRA_EMAIL ?? '',
			token: process.env.JIRA_API_TOKEN ?? '',
		},
	}
	const missing = []
	if (!config.password) missing.push('DASHBOARD_PASSWORD')
	if (!mock) {
		if (!config.jira.baseUrl) missing.push('JIRA_BASE_URL')
		if (!config.jira.email) missing.push('JIRA_EMAIL')
		if (!config.jira.token) missing.push('JIRA_API_TOKEN')
	}
	return { config, missing }
}
