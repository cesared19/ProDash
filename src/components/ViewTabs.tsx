import type { EstimateScope, SavedView } from '../api'
import { useT } from '../i18n'
import { PencilIcon, PlusIcon } from './icons'

export function ViewTabs({
	views,
	active,
	scope,
	onSelect,
	onNew,
	onEdit,
	onScope,
}: {
	views: SavedView[]
	active: SavedView | null
	scope: EstimateScope | null
	onSelect: (id: string | null) => void
	onNew: () => void
	onEdit: () => void
	onScope: (scope: EstimateScope) => void
}) {
	const t = useT()
	return (
		<div className="views-bar">
			<div className="view-tabs" role="tablist" aria-label={t.views}>
				<button role="tab" aria-selected={!active} className={!active ? 'active' : ''} onClick={() => onSelect(null)}>
					{t.general}
				</button>
				{views.map((v) => (
					<button
						key={v.id}
						role="tab"
						aria-selected={active?.id === v.id}
						className={active?.id === v.id ? 'active' : ''}
						onClick={() => onSelect(v.id)}
					>
						{v.name}
					</button>
				))}
				<button className="view-new" onClick={onNew}>
					<PlusIcon />
					{t.newView}
				</button>
			</div>
			{active && scope && (
				<div className="view-options">
					<span className="view-options-label">{t.estimateWith}</span>
					<div className="segmented" role="radiogroup" aria-label={t.estimateWith}>
						{(['project', 'selection'] as EstimateScope[]).map((s) => (
							<button
								key={s}
								role="radio"
								aria-checked={scope === s}
								className={scope === s ? 'active' : ''}
								onClick={() => onScope(s)}
							>
								{t.scope[s]}
							</button>
						))}
					</div>
					<button className="button" onClick={onEdit}>
						<PencilIcon />
						{t.editView}
					</button>
				</div>
			)}
		</div>
	)
}
