import type { IssueType } from '../api'
import { LANGS, useT } from '../i18n'
import type { BlockId, Settings } from '../settings'
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
	const t = useT()
	const label = (id: BlockId) => t.blocks[id]

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
			<div className="sheet" role="dialog" aria-label={t.customize} onClick={(e) => e.stopPropagation()}>
				<div className="sheet-head">
					<h2>{t.customize}</h2>
					<button className="button primary" onClick={onClose}>
						{t.done}
					</button>
				</div>

				<h3>{t.language}</h3>
				<div className="segmented" role="radiogroup" aria-label={t.language}>
					{LANGS.map((l) => (
						<button
							key={l.value}
							role="radio"
							aria-checked={settings.lang === l.value}
							className={settings.lang === l.value ? 'active' : ''}
							onClick={() => update({ lang: l.value })}
						>
							{l.label}
						</button>
					))}
				</div>

				<h3>{t.text}</h3>
				<label className="switch-row">
					<input
						type="checkbox"
						checked={settings.bigText}
						onChange={(e) => update({ bigText: e.target.checked })}
					/>
					<span>{t.bigText}</span>
				</label>

				<h3>{t.blocksTitle}</h3>
				<p className="muted">{t.blocksHelp}</p>
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
									aria-label={t.moveUp(label(id))}
									disabled={i === 0}
									onClick={() => move(i, -1)}
								>
									<ArrowUpIcon />
								</button>
								<button
									className="icon-button"
									aria-label={t.moveDown(label(id))}
									disabled={i === settings.order.length - 1}
									onClick={() => move(i, 1)}
								>
									<ArrowDownIcon />
								</button>
							</span>
						</li>
					))}
				</ul>

				<h3>{t.typesTitle}</h3>
				<p className="muted">{t.typesHelp}</p>
				{!issueTypes && <p className="muted">{t.loadingTypes}</p>}
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
							{t.resetTypes}
						</button>
					</>
				)}
			</div>
		</div>
	)
}
