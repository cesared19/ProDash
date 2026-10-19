import { useCallback, useEffect, useState } from 'react'
import { api, setApiLang, UnauthorizedError } from './api'
import { Dashboard } from './components/Dashboard'
import { Login } from './components/Login'
import { LangContext, MESSAGES } from './i18n'
import { useSettings } from './settings'

export function App() {
	const [session, setSession] = useState<{ authenticated: boolean; mock: boolean } | null>(null)
	const [settings, update] = useSettings()
	const t = MESSAGES[settings.lang] ?? MESSAGES.es
	setApiLang(settings.lang)

	useEffect(() => {
		api.session().then(setSession, () => setSession({ authenticated: false, mock: false }))
	}, [])

	useEffect(() => {
		document.documentElement.classList.toggle('big-text', settings.bigText)
	}, [settings.bigText])

	useEffect(() => {
		document.documentElement.lang = settings.lang
	}, [settings.lang])

	const onUnauthorized = useCallback((e: unknown) => {
		if (e instanceof UnauthorizedError) setSession((s) => ({ authenticated: false, mock: s?.mock ?? false }))
	}, [])

	let content
	if (!session) content = <div className="center-screen muted">{t.loading}</div>
	else if (!session.authenticated)
		content = (
			<Login
				onLogin={() => api.session().then(setSession)}
				lang={settings.lang}
				setLang={(lang) => update({ lang })}
			/>
		)
	else
		content = (
			<Dashboard
				settings={settings}
				update={update}
				mock={session.mock}
				onUnauthorized={onUnauthorized}
				onLogout={() => api.logout().finally(() => setSession({ ...session, authenticated: false }))}
			/>
		)
	return <LangContext.Provider value={t}>{content}</LangContext.Provider>
}
