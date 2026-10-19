import { useState } from 'react'
import { api } from '../api'
import { GridIcon } from './icons'

export function Login({ onLogin }: { onLogin: () => void }) {
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	async function submit(e: React.FormEvent) {
		e.preventDefault()
		setBusy(true)
		setError(null)
		try {
			await api.login(password)
			onLogin()
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<main className="center-screen">
			<form className="login" onSubmit={submit}>
				<span className="login-logo">
					<GridIcon />
				</span>
				<h1>ProDash</h1>
				<label htmlFor="password">Contraseña</label>
				<input
					id="password"
					type="password"
					autoComplete="current-password"
					autoFocus
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
				{error && (
					<p className="form-error" role="alert">
						{error}
					</p>
				)}
				<button className="button primary big" disabled={busy || !password}>
					{busy ? 'Entrando…' : 'Entrar'}
				</button>
			</form>
		</main>
	)
}
