import { useEffect, useState } from 'react'
import { api, type Project } from '../api'
import { useT } from '../i18n'

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
	const t = useT()
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
			<div className="sheet" role="dialog" aria-label={t.pickProject} onClick={(e) => e.stopPropagation()}>
				<div className="sheet-head">
					<h2>{t.pickProject}</h2>
					{onClose && (
						<button className="button" onClick={onClose}>
							{t.close}
						</button>
					)}
				</div>
				{error && <p className="form-error">{error}</p>}
				{!projects && !error && <p className="muted">{t.loadingProjects}</p>}
				{projects && (
					<>
						{projects.length > 8 && (
							<input
								className="search"
								placeholder={t.searchProject}
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
								<p className="muted">{t.noProjects}</p>
							)}
							{projects.length > 0 && visible?.length === 0 && <p className="muted">{t.noMatch}</p>}
						</div>
					</>
				)}
			</div>
		</div>
	)
}
