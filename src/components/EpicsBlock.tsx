import type { Delivery, EpicGroup, StuckTicket } from '../api'
import { count, duration, durationText, periodLabel, shortDate } from '../format'
import { useT, type Messages } from '../i18n'
import type { EpicView } from '../settings'
import { Card, statusTones } from './Blocks'
import type { BlockProps } from './Dashboard'
import { timesText } from './StuckBlock'
import {
	AlertIcon,
	CheckCircleIcon,
	ChevronDownIcon,
	ClockIcon,
	HourglassIcon,
	FlagIcon,
	GridIcon,
	LayersIcon,
	QuestionIcon,
	StopIcon,
} from './icons'

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

const VIEWS: { view: EpicView; Icon: typeof ClockIcon }[] = [
	{ view: 'pace', Icon: ClockIcon },
	{ view: 'status', Icon: GridIcon },
	{ view: 'delivery', Icon: FlagIcon },
]

const workText = (t: Messages, n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 1 })

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
	if (view === 'status') {
		if (epic.statusEtaWeeks == null) return { main: t.noStatusForecast, detail: '' }
		const eta = duration(t, epic.statusEtaWeeks * 7)
		const parts = [epic.statusEtaDate ? t.paceTowards(shortDate(t, epic.statusEtaDate)) : '']
		if (epic.workUnits != null) parts.push(t.workLeft(workText(t, epic.workUnits)))
		return { main: t.paceEta(`${eta.value} ${eta.unit}`), detail: parts.filter(Boolean).join(' · ') }
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
	byStatusAvailable,
	stuckByKey,
	ui,
	setUi,
}: {
	epic: EpicGroup
	toneOf: (status: string, category: string) => string
	jiraBaseUrl: string | null
	view: EpicView
	now: number
	byStatusAvailable: boolean
	stuckByKey: Map<string, StuckTicket>
	ui: { expanded: boolean; shown: number } | undefined
	setUi: (value: { expanded: boolean; shown: number }) => void
}) {
	const t = useT()
	const expanded = ui?.expanded ?? false
	const shown = ui?.shown ?? PAGE
	const name = epic.name ?? t.noEpic
	const total = epic.open + epic.closed
	const visible = epic.issues.slice(0, shown)
	const notLoaded = epic.issueCount - epic.issues.length
	// Tickets without an epic have no due date, so they show no delivery line.
	const time = epic.key || view !== 'delivery' ? timeLine(t, epic, view, now) : null
	// The badge compares the due date with the forecast of the view (by status
	// for Status and Delivery, when there is one).
	const delivery = view !== 'pace' && byStatusAvailable ? epic.statusDelivery : epic.delivery
	const badge = delivery !== 'noDate' ? DELIVERY_TONES[delivery] : null
	const TimeIcon = VIEWS.find((v) => v.view === view)!.Icon

	return (
		<li className={`epic${expanded ? ' expanded' : ''}`}>
			<button className="epic-head" aria-expanded={expanded} onClick={() => setUi({ expanded: !expanded, shown })}>
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
							<TimeIcon />
							<strong>{time.main}</strong>
							{time.detail && <span className="muted">· {time.detail}</span>}
						</span>
					)}
					{badge && (
						<span className={`delivery-badge ${badge.className}`}>
							<badge.Icon /> {t.deliveryStatus[delivery]}
						</span>
					)}
				</div>
			)}
			{expanded && (
				<div className="epic-body">
					<ul className="issue-list">
						{visible.map((issue) => (
							<li key={issue.key} className="issue-row">
								<span className="issue-status">
									<span className={`status-pill ${issue.category === 'done' ? 'tone-closed' : toneOf(issue.status, issue.category)}`}>
										{issue.status}
									</span>
									{issue.stuck && stuckByKey.has(issue.key) && (
										<span
											className={`stuck-icon ${issue.stuck === 'severe' ? 'severe' : 'warning'}`}
											role="img"
											aria-label={t.stuckIcon(
												t.stuckLevel[issue.stuck],
												durationText(t, stuckByKey.get(issue.key)!.days),
												timesText(stuckByKey.get(issue.key)!.times),
											)}
											title={t.stuckIcon(
												t.stuckLevel[issue.stuck],
												durationText(t, stuckByKey.get(issue.key)!.days),
												timesText(stuckByKey.get(issue.key)!.times),
											)}
										>
											<HourglassIcon />
										</span>
									)}
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
						<button className="button" onClick={() => setUi({ expanded, shown: shown + PAGE })}>
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

export function EpicsBlock({ summary, settings, update, epicUi, setEpicUi }: BlockProps) {
	const t = useT()
	const view = settings.epicView
	const forecast = summary.statusForecast
	const stuckByKey = new Map(summary.stuck.items.map((i) => [i.key, i]))
	const viewHelp = {
		pace: t.paceHelp,
		status: forecast ? `${t.statusHelp(count(t, forecast.basedOn))}${forecast.basedOn < 10 ? ` ${t.fewData}` : ''}` : t.noStatusForecast,
		delivery: t.deliveryHelp,
	}[view]
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
						{VIEWS.map(({ view: v, Icon }) => (
							<button
								key={v}
								role="radio"
								aria-checked={view === v}
								className={view === v ? 'active' : ''}
								onClick={() => update({ epicView: v })}
							>
								<Icon />
								{t[v]}
							</button>
						))}
					</div>
					<p className="card-help">
						{t.epicHelp(periodLabel(t, summary.periodDays))} {viewHelp}{' '}
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
								byStatusAvailable={forecast != null}
								stuckByKey={stuckByKey}
								ui={epicUi[epic.key ?? '-']}
								setUi={(value) => setEpicUi(epic.key ?? '-', value)}
							/>
						))}
					</ul>
				</>
			)}
		</Card>
	)
}
