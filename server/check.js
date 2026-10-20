// Diagnóstico de la conexión con Jira: npm run check
// Muestra qué falla sin imprimir el token.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from './env.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(path.join(root, '.env'))

const ok = (msg) => console.log(`  ✅ ${msg}`)
const bad = (msg) => console.log(`  ❌ ${msg}`)
const warn = (msg) => console.log(`  ⚠️  ${msg}`)
let failed = false
const fail = (msg) => {
	bad(msg)
	failed = true
}

console.log('\nDiagnóstico de ProDash\n')

const rawUrl = process.env.JIRA_BASE_URL ?? ''
const email = process.env.JIRA_EMAIL ?? ''
const token = process.env.JIRA_API_TOKEN ?? ''

console.log('1. Archivo .env')
if (/^(1|true|yes)$/i.test(process.env.JIRA_MOCK ?? '')) warn('JIRA_MOCK=true: la app usa datos de ejemplo y no se conecta a Jira.')
let baseUrl = ''
try {
	const url = new URL(rawUrl)
	baseUrl = `${url.protocol}//${url.host}`
	if (url.protocol !== 'https:') fail(`JIRA_BASE_URL debe empezar por https:// (ahora: ${rawUrl})`)
	else if (!url.host.endsWith('.atlassian.net')) warn(`JIRA_BASE_URL no termina en .atlassian.net (${url.host}). ¿Es Jira Cloud?`)
	else ok(`JIRA_BASE_URL: ${baseUrl}`)
	if (url.pathname.replace(/\/+$/, '') !== '') fail(`JIRA_BASE_URL tiene texto después del dominio ("${url.pathname}"). Déjalo como ${baseUrl}`)
} catch {
	fail(`JIRA_BASE_URL no es una dirección válida (ahora: "${rawUrl}")`)
}
if (!email) fail('JIRA_EMAIL está vacío')
else if (!/^[^\s@]+@[^\s@]+$/.test(email)) fail(`JIRA_EMAIL no parece un email ("${email}")`)
else ok(`JIRA_EMAIL: ${email}`)
if (!token) fail('JIRA_API_TOKEN está vacío')
else if (/\s/.test(token)) fail('JIRA_API_TOKEN tiene espacios o saltos de línea. Pégalo de nuevo en una sola línea.')
else if (token.length < 100) warn(`JIRA_API_TOKEN es corto (${token.length} caracteres); los tokens actuales tienen unos 190. ¿Está completo?`)
else ok(`JIRA_API_TOKEN: ${token.length} caracteres, empieza por ${token.slice(0, 5)}…`)

if (!baseUrl || !email || !token) {
	console.log('\nCorrige lo marcado con ❌ en .env y vuelve a ejecutar npm run check.\n')
	process.exit(1)
}

console.log('\n2. Sitio de Jira')
try {
	const res = await fetch(`${baseUrl}/rest/api/3/serverInfo`)
	if (res.ok) ok(`El sitio responde (${(await res.json()).serverTitle ?? baseUrl})`)
	else if (res.status === 404) fail('El sitio no existe o no es Jira Cloud. Revisa JIRA_BASE_URL.')
	else warn(`El sitio respondió ${res.status}`)
} catch (e) {
	fail(`No se pudo conectar con ${baseUrl}: ${e.cause?.code ?? e.message}. Revisa la URL y tu conexión.`)
}

console.log('\n3. Credenciales')
const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64')
try {
	const res = await fetch(`${baseUrl}/rest/api/3/myself`, { headers: { Authorization: auth, Accept: 'application/json' } })
	const reason = res.headers.get('x-seraph-loginreason') ?? ''
	const denied = res.headers.get('x-authentication-denied-reason') ?? ''
	if (res.ok) {
		const me = await res.json()
		ok(`Jira aceptó las credenciales: ${me.displayName} (${me.emailAddress ?? 'email oculto'})`)
		const projects = await fetch(`${baseUrl}/rest/api/3/project/search?maxResults=1`, {
			headers: { Authorization: auth, Accept: 'application/json' },
		}).then((r) => r.json())
		if (projects.total > 0) ok(`La cuenta ve ${projects.total} proyecto(s)`)
		else fail('La cuenta no ve ningún proyecto: pide a un administrador de Jira el permiso Browse projects.')
	} else if (/captcha|authentication_denied/i.test(`${denied} ${reason}`)) {
		fail('Jira bloqueó la cuenta con un CAPTCHA por demasiados intentos fallidos. Cierra sesión en Jira, vuelve a entrar desde el navegador resolviendo el CAPTCHA y repite.')
	} else if (res.status === 401) {
		fail('Jira rechazó el email o el token.')
		console.log(`
     Revisa, en este orden:
     • Que JIRA_EMAIL sea exactamente el email con el que entras a Jira
       (si entras con Google o con el SSO de tu empresa, el de esa cuenta).
     • Que el token sea de esa misma cuenta y se haya creado con
       "Create API token" (no "Create API token with scopes").
     • Que el token no esté caducado ni revocado: crea uno nuevo en
       https://id.atlassian.com/manage-profile/security/api-tokens
     • Si todo es correcto, puede que tu empresa bloquee los tokens de API
       (Atlassian Guard). Pregúntale al administrador de Atlassian.${reason ? `\n     (Motivo indicado por Jira: ${reason})` : ''}`)
	} else if (res.status === 403) {
		let detail = ''
		try {
			const data = await res.json()
			detail = [...(data.errorMessages ?? []), ...Object.values(data.errors ?? {})].join(' ')
		} catch {
			// Not JSON.
		}
		fail(`Jira denegó el acceso (403).${detail ? ` Jira dice: ${detail}` : ''}${reason || denied ? ` [${[denied, reason].filter(Boolean).join('; ')}]` : ''}`)
		console.log(`
     Si ayer funcionaba, revisa en este orden:
     • Entra a Jira en el navegador: si pide un CAPTCHA o volver a iniciar
       sesión, hazlo y repite npm run check.
     • ¿Estás en otra red o sin la VPN de tu empresa? Algunas empresas solo
       permiten usar Jira (también por API) desde su red (Atlassian Guard,
       lista de IP permitidas). Prueba conectado a la red o VPN de siempre.
     • Que el token siga activo en
       https://id.atlassian.com/manage-profile/security/api-tokens
       (si no está o caducó, crea uno nuevo y ponlo en .env).
     • Si nada de eso cambia, pregúntale al administrador de Atlassian si
       se bloquearon los tokens de API.`)
	} else {
		fail(`Jira respondió ${res.status}`)
	}
} catch (e) {
	fail(`No se pudo consultar Jira: ${e.cause?.code ?? e.message}`)
}

console.log(failed ? '\nCorrige lo marcado con ❌, reinicia ProDash y vuelve a probar.\n' : '\nTodo correcto. Reinicia ProDash si estaba en marcha.\n')
process.exit(failed ? 1 : 0)
