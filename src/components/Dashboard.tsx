import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, defaultExcluded, type IssueType, type SavedView, type Summary } from '../api'
import { longDate, periodLabel } from '../format'
import { useT } from '../i18n'
import { exportPng, REPORT_WIDTH } from '../exportPng'
import type { BlockId, Period, Settings } from '../settings'
import { ClosedBlock, EtaBlock, OpenBlock, StatusesBlock, TimesBlock, TrajectoryBlock } from './Blocks'
import { BugsBlock } from './BugsBlock'
import { EpicsBlock } from './EpicsBlock'
import { CustomizePanel } from './CustomizePanel'
import { ChevronDownIcon, ImageIcon, LogoutIcon, RefreshIcon, SlidersIcon } from './icons'
import { ProjectPicker } from './ProjectPicker'
import { ViewEditor } from './ViewEditor'
import { ViewTabs } from './ViewTabs'

const PERIODS: Period[] = [30, 90, 180, 365, 'all']

// Which epics are open and how many of their tickets are shown. It lives here,
// not in the block, so the PNG copy shows exactly what is on screen.
export type EpicUi = Record<string, { expanded: boolean; shown: number }>

export type BlockProps = {
	summary: Summary
	settings: Settings
	update: (patch: Partial<Settings>) => void
	epicUi: EpicUi
	setEpicUi: (key: string, value: { expanded: boolean; shown: number }) => void
}

const BLOCK_VIEWS: Record<BlockId, { Component: (p: BlockProps) => JSX.Element; size: string }> = {
	open: { Component: OpenBlock, size: 'small' },
	closed: { Component: ClosedBlock, size: 'small' },
	eta: { Component: EtaBlock, size: 'small' },
	statuses: { Component: StatusesBlock, size: 'full' },
	times: { Component: TimesBlock, size: 'half' },
	trajectory: { Component: TrajectoryBlock, size: 'half' },
	epics: { Component: EpicsBlock, size: 'full' },
	bugs: { Component: BugsBlock, size: 'half' },
}

const REFRESH_MS = 5 * 60 * 1000

export function Dashboard({
	settings,
	update,
	onUnauthorized,
	onLogout,
	mock,
	version,
}: {
	settings: Settings
	update: (patch: Partial<Settings>) => void
	onUnauthorized: (e: unknown) => void
	onLogout: () => void
	mock: boolean
	version?: string
}) {
	const t = useT()
	const key = settings.projectKey
	const [projectName, setProjectName] = useState<string | null>(null)
	const [issueTypes, setIssueTypes] = useState<IssueType[] | null>(null)
	const [summary, setSummary] = useState<Summary | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [picking, setPicking] = useState(false)
	const [customizing, setCustomizing] = useState(false)
	const [exporting, setExporting] = useState(false)
	const exportRef = useRef<HTMLDivElement>(null)
	const [epicUi, setEpicUiState] = useState<EpicUi>({})
	const [views, setViews] = useState<SavedView[] | null>(null)
	const [editing, setEditing] = useState<SavedView | 'new' | null>(null)
	const setEpicUi = useCallback(
		(epicKey: string, value: { expanded: boolean; shown: number }) =>
			setEpicUiState((current) => ({ ...current, [epicKey]: value })),
		[],
	)

	useEffect(() => {
		if (!key) return
		setIssueTypes(null)
		setSummary(null)
		setEpicUiState({})
		setViews(null)
		api.views(key).then(setViews, (e) => {
			onUnauthorized(e)
			setViews([])
		})
		api.issueTypes(key).then(setIssueTypes, (e) => {
			onUnauthorized(e)
			setError((e as Error).message)
		})
		api.projects().then(
			(list) => setProjectName(list.find((p) => p.key === key)?.name ?? key),
			() => setProjectName(key),
		)
	}, [key, onUnauthorized])

	const excluded = key ? (settings.excluded[key] ?? (issueTypes ? defaultExcluded(issueTypes) : null)) : null
	const excludedKey = excluded?.join(',')
	const statusDaysKey = JSON.stringify((key && settings.statusDays[key]) || {})

	// The saved view open for this project; a view someone deleted falls back to General.
	const selectedId = key ? (settings.selectedView[key] ?? null) : null
	const activeView = (selectedId && views?.find((v) => v.id === selectedId)) || null
	const viewsReady = !selectedId || views != null
	const scope = activeView ? (settings.viewScope[activeView.id] ?? activeView.estimateScope) : null
	const viewParam = activeView ? `${activeView.id}|${activeView.updatedAt}|${scope}` : ''
	// Views decide the bug breakdown themselves; General follows Customize.
	const generalBugs = !activeView && settings.bugsGeneral

	function selectView(id: string | null) {
		if (!key) return
		setEpicUiState({})
		update({ selectedView: { ...settings.selectedView, [key]: id } })
	}

	const load = useCallback(async (fresh = false) => {
		if (!key || excludedKey == null || !viewsReady) return
		const [viewId, , viewScope] = viewParam.split('|')
		setLoading(true)
		setError(null)
		try {
			setSummary(
				await api.summary(
					key,
					settings.period,
					excludedKey ? excludedKey.split(',') : [],
					JSON.parse(statusDaysKey),
					fresh,
					viewId ? { id: viewId, scope: viewScope as 'project' | 'selection' } : null,
					generalBugs,
				),
			)
		} catch (e) {
			onUnauthorized(e)
			// The view was deleted elsewhere: refresh the list, which falls back to General.
			if (e instanceof ApiError && e.status === 404 && viewId) api.views(key).then(setViews, () => {})
			setError((e as Error).message)
		} finally {
			setLoading(false)
		}
	}, [key, excludedKey, statusDaysKey, settings.period, viewsReady, viewParam, generalBugs, onUnauthorized])

	useEffect(() => {
		load()
		const timer = setInterval(() => load(), REFRESH_MS)
		return () => clearInterval(timer)
	}, [load])

	// The off-screen copy mounts when `exporting` turns on; capture it once the
	// chart has measured its new width.
	useEffect(() => {
		if (!exporting || !summary) return
		let cancelled = false
		const timer = setTimeout(async () => {
			try {
				if (!exportRef.current) return
				const date = summary.generatedAt.slice(0, 10)
				await exportPng(exportRef.current, `${t.fileName}-${summary.projectKey}-${date}.png`, t.pngError)
			} catch (e) {
				if (!cancelled) setError((e as Error).message)
			} finally {
				if (!cancelled) setExporting(false)
			}
		}, 150)
		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [exporting, summary, t])

	if (!key) {
		return <ProjectPicker current={null} onPick={(k) => update({ projectKey: k })} onUnauthorized={onUnauthorized} />
	}

	const excludedNames = issueTypes?.filter((t) => excluded?.includes(t.id)).map((t) => t.name) ?? []
	const visibleBlocks = settings.order.filter(
		(id) => !settings.hidden.includes(id) && (id !== 'bugs' || summary?.bugs != null),
	)

	function renderReport(className: string, ref?: React.Ref<HTMLDivElement>) {
		return (
			<div className={className} ref={ref}>
				<div className="report-head">
					<h1>
						{projectName ?? key}
						{summary?.view && <span className="report-view"> · {summary.view.name}</span>}
					</h1>
					<p>
						{summary ? t.reportLine(longDate(t, summary.generatedAt), periodLabel(t, summary.periodDays)) : ' '}
						{summary?.view && t.reportScope(t.scope[summary.estimateScope])}
						{excludedNames.length > 0 && t.excluding(excludedNames.join(', '))}
						{summary && visibleBlocks.includes('epics') && t.reportEpicView(t[settings.epicView])}
					</p>
				</div>
				{!summary && !error && <div className="loading">{t.loadingData}</div>}
				{summary && (
					<div className="blocks">
						{visibleBlocks.map((id) => {
							const { Component, size } = BLOCK_VIEWS[id]
							return (
								<div key={id} className={`block block-${size} block-${id}`}>
									<Component
										summary={summary}
										settings={settings}
										update={update}
										epicUi={epicUi}
										setEpicUi={setEpicUi}
									/>
								</div>
							)
						})}
						{visibleBlocks.length === 0 && <p className="empty">{t.allHidden}</p>}
					</div>
				)}
				{summary?.truncated && (
					<p className="note">{t.truncated}</p>
				)}
			</div>
		)
	}

	return (
		<div className="page">
			<header className="toolbar">
				<button
					className="project-button"
					onClick={() => setPicking(true)}
					aria-label={t.changeProject}
					title={projectName ?? key}
				>
					<span className="project-button-name">{projectName ?? key}</span>
					<ChevronDownIcon />
				</button>
				<div className="segmented" role="radiogroup" aria-label={t.period}>
					{PERIODS.map((p) => (
						<button
							key={p}
							role="radio"
							aria-checked={settings.period === p}
							className={settings.period === p ? 'active' : ''}
							onClick={() => update({ period: p })}
						>
							{t.periods[p]}
						</button>
					))}
				</div>
				<div className="actions">
					<button className="button" onClick={() => load(true)} disabled={loading} aria-label={t.refresh}>
						<RefreshIcon className={loading ? 'spin' : ''} />
						<span className="button-text">{t.refresh}</span>
					</button>
					<button className="button" onClick={() => setCustomizing(true)} aria-label={t.customize}>
						<SlidersIcon />
						<span className="button-text">{t.customize}</span>
					</button>
					<button className="button primary" onClick={() => setExporting(true)} disabled={!summary || exporting}>
						<ImageIcon />
						<span>{exporting ? t.creating : t.downloadPng}</span>
					</button>
					<button className="icon-button" onClick={onLogout} aria-label={t.logout} title={t.logout}>
						<LogoutIcon />
					</button>
				</div>
			</header>

			{views && (
				<ViewTabs
					views={views}
					active={activeView}
					scope={scope}
					onSelect={selectView}
					onNew={() => setEditing('new')}
					onEdit={() => activeView && setEditing(activeView)}
					onScope={(s) => activeView && update({ viewScope: { ...settings.viewScope, [activeView.id]: s } })}
				/>
			)}

			{mock && <p className="banner">{t.demo}</p>}
			{error && (
				<p className="banner error" role="alert">
					{error}
				</p>
			)}

			{renderReport('report')}
			{exporting && (
				<div className="export-holder" style={{ width: REPORT_WIDTH }} aria-hidden="true">
					{renderReport('report exporting', exportRef)}
				</div>
			)}

			{picking && (
				<ProjectPicker
					current={key}
					onPick={(k) => {
						update({ projectKey: k })
						setPicking(false)
					}}
					onClose={() => setPicking(false)}
					onUnauthorized={onUnauthorized}
				/>
			)}
			{editing && key && (
				<ViewEditor
					projectKey={key}
					view={editing === 'new' ? null : editing}
					onClose={() => setEditing(null)}
					onSaved={(saved) => {
						setViews((list) =>
							list?.some((v) => v.id === saved.id)
								? list.map((v) => (v.id === saved.id ? saved : v))
								: [...(list ?? []), saved],
						)
						setEditing(null)
						selectView(saved.id)
					}}
					onDeleted={(id) => {
						setViews((list) => (list ?? []).filter((v) => v.id !== id))
						setEditing(null)
						selectView(null)
					}}
				/>
			)}
			{customizing && (
				<CustomizePanel
					settings={settings}
					update={update}
					issueTypes={issueTypes}
					excluded={excluded ?? []}
					statusForecast={summary?.statusForecast ?? null}
					version={version}
					onClose={() => setCustomizing(false)}
				/>
			)}
		</div>
	)
}
