// Server error messages; the client picks the language with the X-Lang header.
const MESSAGES = {
	es: {
		wrongPassword: 'Contraseña incorrecta',
		sessionExpired: 'Sesión expirada',
		invalidKey: 'Clave de proyecto inválida',
		notFound: 'No encontrado',
		anonymous:
			'Jira no aceptó las credenciales y respondió como visitante anónimo. Revisa en .env que JIRA_EMAIL sea el email de la cuenta que creó el token, que JIRA_API_TOKEN esté completo y que JIRA_BASE_URL sea tu sitio (https://tu-empresa.atlassian.net). Después reinicia ProDash. Para más detalle, ejecuta npm run check.',
		rejected: 'Jira rechazó las credenciales. Revisa JIRA_EMAIL y JIRA_API_TOKEN en .env (o ejecuta npm run check).',
		projectNotFound: 'Jira no encontró el proyecto o no tienes acceso.',
		jiraStatus: (status) => `Jira respondió ${status}`,
		unreachable: 'No se pudo conectar con Jira. Revisa la conexión y JIRA_BASE_URL.',
	},
	en: {
		wrongPassword: 'Wrong password',
		sessionExpired: 'Session expired',
		invalidKey: 'Invalid project key',
		notFound: 'Not found',
		anonymous:
			'Jira did not accept the credentials and answered as an anonymous visitor. Check in .env that JIRA_EMAIL is the email of the account that created the token, that JIRA_API_TOKEN is complete and that JIRA_BASE_URL is your site (https://your-company.atlassian.net). Then restart ProDash. For details, run npm run check.',
		rejected: 'Jira rejected the credentials. Check JIRA_EMAIL and JIRA_API_TOKEN in .env (or run npm run check).',
		projectNotFound: 'Jira did not find the project or you do not have access.',
		jiraStatus: (status) => `Jira answered ${status}`,
		unreachable: 'Could not connect to Jira. Check the connection and JIRA_BASE_URL.',
	},
}

export function messages(req) {
	return req.get('x-lang') === 'en' ? MESSAGES.en : MESSAGES.es
}
