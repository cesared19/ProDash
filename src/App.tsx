import { useCallback, useEffect, useState } from 'react'
import { api, UnauthorizedError } from './api'
import { Dashboard } from './components/Dashboard'
import { Login } from './components/Login'
import { useSettings } from './settings'

export function App() {
	const [session, setSession] = useState<{ authenticated: boolean; mock: boolean } | null>(null)
	const [settings, update] = useSettings()

	useEffect(() => {
		api.session().then(setSession, () => setSession({ authenticated: false, mock: false }))
	}, [])

	useEffect(() => {
		document.documentElement.classList.toggle('big-text', settings.bigText)
	}, [settings.bigText])

	const onUnauthorized = useCallback((e: unknown) => {
		if (e instanceof UnauthorizedError) setSession((s) => ({ authenticated: false, mock: s?.mock ?? false }))
	}, [])

	if (!session) return <div className="center-screen muted">Cargando…</div>
	if (!session.authenticated) return <Login onLogin={() => api.session().then(setSession)} />
	return (
		<Dashboard
			settings={settings}
			update={update}
			mock={session.mock}
			onUnauthorized={onUnauthorized}
			onLogout={() => api.logout().finally(() => setSession({ ...session, authenticated: false }))}
		/>
	)
}
