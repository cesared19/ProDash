import { useEffect, useState } from 'react'
import { api, type EstimateScope, type PickedIssue, type SavedView, type ViewInput } from '../api'
import { useT } from '../i18n'
import { CloseIcon } from './icons'

const EMPTY: ViewInput = {
	name: '',
	epics: [],
	issues: [],
	labels: [],
	components: [],
	jql: '',
	estimateScope: 'project',
	bugBreakdown: false,
}

function toggle(list: string[], item: string) {
	return list.includes(item) ? list.filter((i) => i !== item) : [...list, item]
}

// A filterable list of checkboxes; checked items first.
function CheckList({
	items,
	selected,
	onToggle,
	labelOf = (item) => item,
	detailOf,
}: {
	items: string[] | null
	selected: string[]
	onToggle: (item: string) => void
	labelOf?: (item: string) => string
	detailOf?: (item: string) => string
}) {
	const t = useT()
	const [filter, setFilter] = useState('')
	if (!items) return <p className="muted">{t.loading}</p>
	if (!items.length) return <p className="muted">{t.nothingToPick}</p>
	const q = filter.trim().toLowerCase()
	const visible = items
		.filter((i) => !q || labelOf(i).toLowerCase().includes(q) || i.toLowerCase().includes(q))
		.sort((a, b) => Number(selected.includes(b)) - Number(selected.includes(a)))
	return (
		<>
			{items.length > 8 && (
				<input className="search small" placeholder={t.filter} value={filter} onChange={(e) => setFilter(e.target.value)} />
			)}
			<div className="check-list">
				{visible.map((item) => (
					<label key={item} className="switch-row">
						<input type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} />
						<span>
							{labelOf(item)}
							{detailOf && <span className="muted"> {detailOf(item)}</span>}
						</span>
					</label>
				))}
				{!visible.length && <p className="muted">{t.noResults}</p>}
			</div>
		</>
	)
}

export function ViewEditor({
	projectKey,
	view,
	onSaved,
	onDeleted,
	onClose,
}: {
	projectKey: string
	view: SavedView | null
	onSaved: (view: SavedView) => void
	onDeleted: (id: string) => void
	onClose: () => void
}) {
	const t = useT()
	const [draft, setDraft] = useState<ViewInput>(view ? { ...EMPTY, ...view } : EMPTY)
	const [epics, setEpics] = useState<PickedIssue[] | null>(null)
	const [labels, setLabels] = useState<string[] | null>(null)
	const [components, setComponents] = useState<string[] | null>(null)
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<PickedIssue[] | null>(null)
	// Titles of tickets picked in this session; saved views only keep keys.
	const [known, setKnown] = useState<Record<string, string>>({})
	const [jqlResult, setJqlResult] = useState<{ ok: boolean; text: string } | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [confirming, setConfirming] = useState(false)

	const patch = (p: Partial<ViewInput>) => setDraft((d) => ({ ...d, ...p }))
	const fail = (e: unknown) => setError((e as Error).message)

	useEffect(() => {
		api.epics(projectKey).then(setEpics, (e) => (setEpics([]), fail(e)))
		api.labels(projectKey).then(setLabels, () => setLabels([]))
		api.components(projectKey).then(setComponents, () => setComponents([]))
	}, [projectKey])

	// Searches as the user types, waiting for a short pause.
	useEffect(() => {
		const q = query.trim()
		if (!q) return setResults(null)
		const timer = setTimeout(() => {
			api.searchIssues(projectKey, q).then(setResults, fail)
		}, 300)
		return () => clearTimeout(timer)
	}, [projectKey, query])

	const epicName = (key: string) => epics?.find((e) => e.key === key)?.summary ?? key

	async function tryJql() {
		setJqlResult(null)
		try {
			const { count, truncated } = await api.jqlCount(projectKey, draft.jql)
			setJqlResult({ ok: true, text: t.jqlFound(`${count.toLocaleString(t.locale)}${truncated ? '+' : ''}`) })
		} catch (e) {
			setJqlResult({ ok: false, text: (e as Error).message })
		}
	}

	async function save() {
		setBusy(true)
		setError(null)
		try {
			onSaved(view ? await api.updateView(view.id, draft) : await api.createView(projectKey, draft))
		} catch (e) {
			fail(e)
		} finally {
			setBusy(false)
		}
	}

	async function remove() {
		if (!view) return
		if (!confirming) return setConfirming(true)
		setBusy(true)
		try {
			await api.deleteView(view.id)
			onDeleted(view.id)
		} catch (e) {
			fail(e)
			setBusy(false)
		}
	}

	const parts = [
		draft.epics.length ? t.countEpics(draft.epics.length) : '',
		draft.issues.length ? t.countIssues(draft.issues.length) : '',
		draft.labels.length ? t.countLabels(draft.labels.length) : '',
		draft.components.length ? t.countComponents(draft.components.length) : '',
		draft.jql.trim() ? t.countJql : '',
	].filter(Boolean)

	return (
		<div className="overlay" onClick={onClose}>
			<div
				className="sheet sheet-wide"
				role="dialog"
				aria-label={view ? t.viewEditorEdit : t.viewEditorNew}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="sheet-head">
					<h2>{view ? t.viewEditorEdit : t.viewEditorNew}</h2>
					<button className="icon-button" onClick={onClose} aria-label={t.close}>
						<CloseIcon />
					</button>
				</div>

				<label className="field-label" htmlFor="view-name">
					{t.viewName}
				</label>
				<input
					id="view-name"
					className="search"
					maxLength={60}
					placeholder={t.viewNamePlaceholder}
					value={draft.name}
					onChange={(e) => patch({ name: e.target.value })}
					autoFocus={!view}
				/>
				<p className="muted">{t.viewHelp}</p>

				<h3>{t.pickEpics}</h3>
				<CheckList
					items={epics?.map((e) => e.key) ?? null}
					selected={draft.epics}
					onToggle={(key) => patch({ epics: toggle(draft.epics, key) })}
					labelOf={epicName}
					detailOf={(key) => key}
				/>

				<h3>{t.pickIssues}</h3>
				<input
					className="search small"
					placeholder={t.searchIssues}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
				{results && (
					<ul className="pick-results">
						{results.map((r) => (
							<li key={r.key}>
								<span>
									<strong>{r.key}</strong> {r.summary} <span className="muted">· {r.type}</span>
								</span>
								<button
									className="button small"
									disabled={draft.issues.includes(r.key)}
									onClick={() => {
										setKnown({ ...known, [r.key]: r.summary })
										patch({ issues: [...draft.issues, r.key] })
									}}
								>
									{t.add}
								</button>
							</li>
						))}
						{!results.length && <li className="muted">{t.noResults}</li>}
					</ul>
				)}
				{draft.issues.length > 0 && (
					<div className="chips">
						{draft.issues.map((key) => (
							<span key={key} className="chip">
								<strong>{key}</strong>
								{known[key] && <span className="chip-text">{known[key]}</span>}
								<button
									aria-label={t.remove(key)}
									onClick={() => patch({ issues: draft.issues.filter((k) => k !== key) })}
								>
									<CloseIcon />
								</button>
							</span>
						))}
					</div>
				)}

				<h3>{t.pickLabels}</h3>
				<CheckList items={labels} selected={draft.labels} onToggle={(l) => patch({ labels: toggle(draft.labels, l) })} />

				<h3>{t.pickComponents}</h3>
				<CheckList
					items={components}
					selected={draft.components}
					onToggle={(c) => patch({ components: toggle(draft.components, c) })}
				/>

				<h3>{t.pickJql}</h3>
				<textarea
					className="jql"
					rows={3}
					maxLength={2000}
					placeholder={t.jqlPlaceholder}
					value={draft.jql}
					onChange={(e) => (patch({ jql: e.target.value }), setJqlResult(null))}
				/>
				<div className="jql-row">
					<span className="muted">{t.jqlHelp}</span>
					<button className="button small" onClick={tryJql} disabled={!draft.jql.trim()}>
						{t.tryJql}
					</button>
				</div>
				{jqlResult && <p className={jqlResult.ok ? 'jql-ok' : 'form-error'}>{jqlResult.text}</p>}

				<h3>{t.defaultEstimate}</h3>
				<div className="segmented" role="radiogroup" aria-label={t.defaultEstimate}>
					{(['project', 'selection'] as EstimateScope[]).map((s) => (
						<button
							key={s}
							role="radio"
							aria-checked={draft.estimateScope === s}
							className={draft.estimateScope === s ? 'active' : ''}
							onClick={() => patch({ estimateScope: s })}
						>
							{t.scope[s]}
						</button>
					))}
				</div>
				<p className="muted">{t.scopeHelp[draft.estimateScope]}</p>

				<h3>{t.bugBreakdown}</h3>
				<label className="switch-row">
					<input
						type="checkbox"
						checked={draft.bugBreakdown}
						onChange={(e) => patch({ bugBreakdown: e.target.checked })}
					/>
					<span>{t.bugBreakdown}</span>
				</label>
				<p className="muted">{t.bugBreakdownHelp}</p>

				<div className="editor-footer">
					<p className="selected-summary">
						{parts.length ? t.selectedSummary(parts.join(' · ')) : t.nothingSelected}
					</p>
					{error && (
						<p className="form-error" role="alert">
							{error}
						</p>
					)}
					<div className="editor-buttons">
						{view && (
							<button className={`button danger${confirming ? ' confirming' : ''}`} onClick={remove} disabled={busy}>
								{confirming ? t.confirmDelete : t.deleteView}
							</button>
						)}
						<span className="spacer" />
						<button className="button" onClick={onClose}>
							{t.cancel}
						</button>
						<button className="button primary" onClick={save} disabled={busy || !draft.name.trim() || !parts.length}>
							{busy ? t.saving : t.save}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
