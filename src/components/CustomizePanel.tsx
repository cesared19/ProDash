import type { IssueType } from '../api'
import { BLOCKS, type BlockId, type Settings } from '../settings'
import { ArrowDownIcon, ArrowUpIcon } from './icons'

export function CustomizePanel({
	settings,
	update,
	issueTypes,
	excluded,
	onClose,
}: {
	settings: Settings
	update: (patch: Partial<Settings>) => void
	issueTypes: IssueType[] | null
	excluded: string[]
	onClose: () => void
}) {
	const label = (id: BlockId) => BLOCKS.find((b) => b.id === id)!.label

	function move(index: number, delta: number) {
		const order = [...settings.order]
		const [item] = order.splice(index, 1)
		order.splice(index + delta, 0, item)
		update({ order })
	}

	function toggleBlock(id: BlockId) {
		const hidden = settings.hidden.includes(id) ? settings.hidden.filter((h) => h !== id) : [...settings.hidden, id]
		update({ hidden })
	}

	function toggleType(id: string) {
		if (!settings.projectKey) return
		const next = excluded.includes(id) ? excluded.filter((e) => e !== id) : [...excluded, id]
		update({ excluded: { ...settings.excluded, [settings.projectKey]: next } })
	}

	function resetTypes() {
		if (!settings.projectKey) return
		const { [settings.projectKey]: _removed, ...rest } = settings.excluded
		update({ excluded: rest })
	}

	return (
		<div className="overlay" onClick={onClose}>
			<div className="sheet" role="dialog" aria-label="Personalizar" onClick={(e) => e.stopPropagation()}>
				<div className="sheet-head">
					<h2>Personalizar</h2>
					<button className="button primary" onClick={onClose}>
						Listo
					</button>
				</div>

				<h3>Texto</h3>
				<label className="switch-row">
					<input
						type="checkbox"
						checked={settings.bigText}
						onChange={(e) => update({ bigText: e.target.checked })}
					/>
					<span>Texto extra grande</span>
				</label>

				<h3>Bloques</h3>
				<p className="muted">Marca los que quieres ver y ordénalos con las flechas.</p>
				<ul className="order-list">
					{settings.order.map((id, i) => (
						<li key={id}>
							<label className="switch-row">
								<input type="checkbox" checked={!settings.hidden.includes(id)} onChange={() => toggleBlock(id)} />
								<span>{label(id)}</span>
							</label>
							<span className="order-buttons">
								<button
									className="icon-button"
									aria-label={`Subir ${label(id)}`}
									disabled={i === 0}
									onClick={() => move(i, -1)}
								>
									<ArrowUpIcon />
								</button>
								<button
									className="icon-button"
									aria-label={`Bajar ${label(id)}`}
									disabled={i === settings.order.length - 1}
									onClick={() => move(i, 1)}
								>
									<ArrowDownIcon />
								</button>
							</span>
						</li>
					))}
				</ul>

				<h3>Tipos de ticket que no se cuentan</h3>
				<p className="muted">Por defecto se excluyen errores (bugs) y épicas.</p>
				{!issueTypes && <p className="muted">Cargando tipos…</p>}
				{issueTypes && (
					<>
						<div className="type-list">
							{issueTypes.map((t) => (
								<label key={t.id} className="switch-row">
									<input type="checkbox" checked={excluded.includes(t.id)} onChange={() => toggleType(t.id)} />
									<span>{t.name}</span>
								</label>
							))}
						</div>
						<button className="button" onClick={resetTypes}>
							Volver a los tipos por defecto
						</button>
					</>
				)}
			</div>
		</div>
	)
}
