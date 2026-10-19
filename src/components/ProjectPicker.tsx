import { useEffect, useState } from 'react'
import { api, type Project } from '../api'

export function ProjectPicker({
	current,
	onPick,
	onClose,
	onUnauthorized,
}: {
	current: string | null
	onPick: (key: string) => void
	onClose?: () => void
	onUnauthorized: (e: unknown) => void
}) {
	const [projects, setProjects] = useState<Project[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [query, setQuery] = useState('')

	useEffect(() => {
		api
			.projects()
			.then(setProjects)
			.catch((e) => {
				onUnauthorized(e)
				setError((e as Error).message)
			})
	}, [onUnauthorized])

	const q = query.trim().toLowerCase()
	const visible = projects?.filter((p) => !q || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))

	return (
		<div className="overlay" onClick={onClose}>
			<div className="sheet" role="dialog" aria-label="Elegir proyecto" onClick={(e) => e.stopPropagation()}>
				<div className="sheet-head">
					<h2>Elige un proyecto</h2>
					{onClose && (
						<button className="button" onClick={onClose}>
							Cerrar
						</button>
					)}
				</div>
				{error && <p className="form-error">{error}</p>}
				{!projects && !error && <p className="muted">Cargando proyectos…</p>}
				{projects && (
					<>
						{projects.length > 8 && (
							<input
								className="search"
								placeholder="Buscar proyecto"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								autoFocus
							/>
						)}
						<div className="project-list">
							{visible?.map((p) => (
								<button
									key={p.key}
									className={`project-option${p.key === current ? ' selected' : ''}`}
									onClick={() => onPick(p.key)}
								>
									<span className="project-key">{p.key}</span>
									<span className="project-name">{p.name}</span>
								</button>
							))}
							{projects.length === 0 && (
								<p className="muted">
									Jira no devolvió ningún proyecto. La cuenta de JIRA_EMAIL necesita permiso para ver proyectos
									(Browse projects) en este sitio de Jira.
								</p>
							)}
							{projects.length > 0 && visible?.length === 0 && <p className="muted">Ningún proyecto coincide.</p>}
						</div>
					</>
				)}
			</div>
		</div>
	)
}
