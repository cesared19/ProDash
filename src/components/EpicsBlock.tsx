import { useState } from 'react'
import type { Delivery, EpicGroup, Summary } from '../api'
import { count, duration, durationText, periodLabel, shortDate } from '../format'
import { useT, type Messages } from '../i18n'
import type { EpicView, Settings } from '../settings'
import { Card, statusTones } from './Blocks'
import { AlertIcon, CheckCircleIcon, ChevronDownIcon, ClockIcon, FlagIcon, LayersIcon, QuestionIcon, StopIcon } from './icons'

const PAGE = 30
const DAY = 24 * 60 * 60 * 1000

// Status colors with an icon and a word, as everywhere else.
const DELIVERY_TONES: Record<Exclude<Delivery, 'noDate'>, { className: string; Icon: typeof CheckCircleIcon }> = {
	done: { className: 'tone-closed', Icon: CheckCircleIcon },
	onTrack: { className: 'tone-good', Icon: CheckCircleIcon },
	late: { className: 'tone-bad', Icon: StopIcon },
	overdue: { className: 'tone-bad', Icon: AlertIcon },
	unknown: { className: 'tone-neutral', Icon: QuestionIcon },
}

// A Jira date ("YYYY-MM-DD") read at midday, so no time zone moves it to another day.
const dueTime = (dueDate: string) => Date.parse(`${dueDate}T12:00:00`)

function timeLine(t: Messages, epic: EpicGroup, view: EpicView, now: number) {
	if (epic.open === 0) return { main: t.epicAllClosed, detail: '' }
	if (view === 'pace') {
		if (epic.etaWeeks == null) return { main: t.paceUnknown, detail: '' }
		const eta = duration(t, epic.etaWeeks * 7)
		return {
			main: t.paceEta(`${eta.value} ${eta.unit}`),
			detail: epic.etaDate ? t.paceTowards(shortDate(t, epic.etaDate)) : '',
		}
	}
	if (!epic.dueDate) return { main: t.noDueDate, detail: '' }
	const detail = t.dueOn(shortDate(t, `${epic.dueDate}T12:00:00`))
	const endOfDue = Date.parse(`${epic.dueDate}T23:59:59`)
	if (endOfDue < now) return { main: t.overdueBy(durationText(t, (now - endOfDue) / DAY)), detail }
	const days = (dueTime(epic.dueDate) - now) / DAY
	return { main: days < 1 ? t.dueToday : t.dueIn(durationText(t, days)), detail }
}

function EpicRow({
	epic,
	toneOf,
	jiraBaseUrl,
	view,
	now,
}: {
	epic: EpicGroup
	toneOf: (status: string, category: string) => string
	jiraBaseUrl: string | null
	view: EpicView
	now: number
}) {
	const t = useT()
	const [expanded, setExpanded] = useState(false)
	const [shown, setShown] = useState(PAGE)
	const name = epic.name ?? t.noEpic
	const total = epic.open + epic.closed
	const visible = epic.issues.slice(0, shown)
	const notLoaded = epic.issueCount - epic.issues.length
	// Tickets without an epic have no due date, so they only show their pace.
	const time = epic.key || view === 'pace' ? timeLine(t, epic, view, now) : null
	const badge = epic.delivery !== 'noDate' ? DELIVERY_TONES[epic.delivery] : null

	return (
		<li className={`epic${expanded ? ' expanded' : ''}`}>
			<button className="epic-head" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
				<ChevronDownIcon className="epic-chevron" />
				<span className="epic-title">
					<span className="epic-name">{name}</span>
					{epic.key && <span className="epic-key">{epic.key}</span>}
				</span>
				<span className="epic-counts">
					<span>{t.epicOpen(epic.open, count(t, epic.open))}</span>
					<span className="epic-closed">{t.epicClosed(epic.closed, count(t, epic.closed))}</span>
				</span>
			</button>
			<div className="epic-bar" role="img" aria-label={`${name}: ${t.epicOpen(epic.open, String(epic.open))}, ${t.epicClosed(epic.closed, String(epic.closed))}`}>
				{epic.byStatus.map((s) => (
					<div
						key={s.name}
						className={`stack-seg ${toneOf(s.name, s.category)}`}
						style={{ flexGrow: s.count }}
						title={`${s.name}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
					/>
				))}
				{epic.closed > 0 && (
					<div
						className="stack-seg tone-closed"
						style={{ flexGrow: epic.closed }}
						title={`${t.closed}: ${epic.closed} (${Math.round((epic.closed / total) * 100)}%)`}
					/>
				)}
			</div>
			{(time || badge) && (
				<div className="epic-time">
					{time && (
						<span className="epic-time-text">
							{view === 'pace' ? <ClockIcon /> : <FlagIcon />}
							<strong>{time.main}</strong>
							{time.detail && <span className="muted">· {time.detail}</span>}
						</span>
					)}
					{badge && (
						<span className={`delivery-badge ${badge.className}`}>
							<badge.Icon /> {t.deliveryStatus[epic.delivery]}
						</span>
					)}
				</div>
			)}
			{expanded && (
				<div className="epic-body">
					<ul className="issue-list">
						{visible.map((issue) => (
							<li key={issue.key} className="issue-row">
								<span className={`status-pill ${issue.category === 'done' ? 'tone-closed' : toneOf(issue.status, issue.category)}`}>
									{issue.status}
								</span>
								{jiraBaseUrl ? (
									<a className="issue-key" href={`${jiraBaseUrl}/browse/${issue.key}`} target="_blank" rel="noreferrer">
										{issue.key}
									</a>
								) : (
									<span className="issue-key">{issue.key}</span>
								)}
								<span className="issue-summary">{issue.summary}</span>
							</li>
						))}
					</ul>
					{shown < epic.issues.length && (
						<button className="button" onClick={() => setShown(shown + PAGE)}>
							{t.showMore(count(t, Math.min(PAGE, epic.issues.length - shown)))}
						</button>
					)}
					{shown >= epic.issues.length && notLoaded > 0 && (
						<p className="muted">{t.moreInJira(count(t, notLoaded))}</p>
					)}
				</div>
			)}
		</li>
	)
}

export function EpicsBlock({
	summary,
	settings,
	update,
}: {
	summary: Summary
	settings: Settings
	update: (patch: Partial<Settings>) => void
}) {
	const t = useT()
	const view = settings.epicView
	const now = Date.parse(summary.generatedAt)
	// Same colors as "Open by status", so a status reads the same everywhere.
	const tones = statusTones(summary.byStatus)
	const toneByStatus = new Map(summary.byStatus.map((s, i) => [s.name, tones[i]]))
	const toneOf = (status: string, category: string) =>
		toneByStatus.get(status) ?? (category === 'new' ? 'tone-todo' : 'tone-other')

	return (
		<Card icon={<LayersIcon />} title={t.byEpic}>
			{summary.epics.length === 0 ? (
				<p className="empty">{t.noEpics}</p>
			) : (
				<>
					<div className="segmented screen-only epic-view" role="radiogroup" aria-label={t.epicTimeView}>
						{(['pace', 'delivery'] as const).map((v) => (
							<button
								key={v}
								role="radio"
								aria-checked={view === v}
								className={view === v ? 'active' : ''}
								onClick={() => update({ epicView: v })}
							>
								{v === 'pace' ? <ClockIcon /> : <FlagIcon />}
								{t[v]}
							</button>
						))}
					</div>
					<p className="card-help">
						{t.epicHelp(periodLabel(t, summary.periodDays))} {view === 'pace' ? t.paceHelp : t.deliveryHelp}{' '}
						<span className="screen-only">{t.epicTap}</span>
					</p>
					<ul className="epic-list">
						{summary.epics.map((epic) => (
							<EpicRow
								key={epic.key ?? '-'}
								epic={epic}
								toneOf={toneOf}
								jiraBaseUrl={summary.jiraBaseUrl}
								view={view}
								now={now}
							/>
						))}
					</ul>
				</>
			)}
		</Card>
	)
}
