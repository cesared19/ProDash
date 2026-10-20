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
		captcha:
			'Jira bloqueó el acceso por API con un CAPTCHA (suele pasar tras varios intentos fallidos). Abre Jira en el navegador, cierra sesión, vuelve a entrar resolviendo el CAPTCHA y pulsa Actualizar.',
		forbidden:
			'Jira denegó el acceso (403). Si ayer funcionaba: entra a Jira en el navegador por si pide un CAPTCHA; revisa si estás en otra red o sin la VPN de tu empresa (algunas empresas solo permiten Jira desde su red), y que el token no se haya revocado. Para más detalle, ejecuta npm run check.',
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
		captcha:
			'Jira blocked API access with a CAPTCHA (usually after several failed attempts). Open Jira in the browser, sign out, sign in again solving the CAPTCHA and press Refresh.',
		forbidden:
			'Jira denied access (403). If it worked before: open Jira in the browser in case it asks for a CAPTCHA; check whether you are on another network or off your company VPN (some companies only allow Jira from their network), and that the token was not revoked. For details, run npm run check.',
		unreachable: 'Could not connect to Jira. Check the connection and JIRA_BASE_URL.',
	},
}

export function messages(req) {
	return req.get('x-lang') === 'en' ? MESSAGES.en : MESSAGES.es
}
