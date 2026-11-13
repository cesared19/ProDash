import type { BugReport as Report, BugReportItem } from '../api'
import { count } from '../format'
import { useT, type Messages } from '../i18n'
import { Card } from './Blocks'
import { ArrowDownIcon, ArrowUpIcon, BugIcon, ChartIcon, CheckCircleIcon, PlusIcon } from './icons'

// Priority is ordinal: one hue, darker for higher priority (same ramp as the
// Bugs block); a missing priority is neutral.
const PRIORITY_TONES = ['prio-1', 'prio-2', 'prio-3', 'prio-4', 'prio-5']

function toneFor(rank: number | null, ranks: number[]) {
	if (rank == null) return 'prio-none'
	const index = ranks.indexOf(rank)
	return PRIORITY_TONES[Math.round((index / Math.max(ranks.length - 1, 1)) * (PRIORITY_TONES.length - 1))]
}

const dayName = (t: Messages, day: string, style: 'long' | 'short') =>
	new Intl.DateTimeFormat(t.locale, { weekday: style, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))

const dayDate = (t: Messages, day: string) =>
	new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
		new Date(`${day}T12:00:00Z`),
	)

// More bugs is worse: an increase is red, a decrease green, no change neutral.
// The arrow and the sign say it too, so color never stands alone.
function Delta({ value, inverse = false }: { value: number; inverse?: boolean }) {
	const t = useT()
	const good = inverse ? value > 0 : value < 0
	const tone = value === 0 ? 'delta-same' : good ? 'delta-good' : 'delta-bad'
	return (
		<span className={`delta ${tone}`}>
			{value > 0 ? <ArrowUpIcon /> : value < 0 ? <ArrowDownIcon /> : null}
			{value === 0 ? t.bugDeltaSame : `${value > 0 ? '+' : '−'}${count(t, Math.abs(value))}`}
		</span>
	)
}

function BugList({
	title,
	items,
	total,
	empty,
	icon,
	jiraBaseUrl,
	ranks,
}: {
	title: string
	items: BugReportItem[]
	total: number
	empty: string
	icon: React.ReactNode
	jiraBaseUrl: string | null
	ranks: number[]
}) {
	const t = useT()
	return (
		<Card icon={icon} title={title}>
			{items.length === 0 ? (
				<p className="empty">{empty}</p>
			) : (
				<ul className="issue-list bug-list">
					{items.map((item) => (
						<li key={item.key} className="issue-row">
							<span className="prio-pill">
								<span className={`prio-dot ${toneFor(item.priorityRank, ranks)}`} />
								{item.priority ?? t.noPriority}
							</span>
							{jiraBaseUrl ? (
								<a className="issue-key" href={`${jiraBaseUrl}/browse/${item.key}`} target="_blank" rel="noreferrer">
									{item.key}
								</a>
							) : (
								<span className="issue-key">{item.key}</span>
							)}
							<span className="issue-summary">{item.summary}</span>
						</li>
					))}
					{total > items.length && <li className="muted">{t.moreInJira(count(t, total - items.length))}</li>}
				</ul>
			)}
		</Card>
	)
}

// "yesterday", or the day's name when the previous working day was not yesterday (Monday → Friday).
export function sinceLabel(t: Messages, report: Report) {
	const yesterday = new Date(Date.parse(`${report.today}T12:00:00Z`) - 864e5).toISOString().slice(0, 10)
	return report.previousDay === yesterday ? t.yesterday : t.onDay(dayName(t, report.previousDay, 'long'))
}

export function BugReport({ report }: { report: Report }) {
	const t = useT()
	const delta = report.openNow - report.openBefore
	const since = sinceLabel(t, report)
	const ranks = [...new Set(report.byPriority.map((p) => p.rank).filter((r): r is number => r != null))].sort(
		(a, b) => a - b,
	)
	const maxPriority = Math.max(...report.byPriority.map((p) => Math.max(p.now, p.before)), 1)
	const maxTrend = Math.max(...report.trend.map((p) => p.open), 1)

	return (
		<div className="blocks">
			<div className="block block-small">
				<section className={`tile ${delta > 0 ? 'tone-bad' : delta < 0 ? 'tone-good' : 'tone-neutral'}`}>
					<div className="tile-top">
						<span className="tile-icon">
							<BugIcon />
						</span>
						<span className="badge">
							{delta > 0 ? <ArrowUpIcon /> : delta < 0 ? <ArrowDownIcon /> : null}
							{delta > 0 ? t.bugTrendUp : delta < 0 ? t.bugTrendDown : t.bugTrendSame}
						</span>
					</div>
					<div className="tile-value">
						{count(t, report.openNow)}
						<span className="tile-unit">
							{' '}
							{delta === 0 ? '=' : `${delta > 0 ? '+' : '−'}${count(t, Math.abs(delta))}`}
						</span>
					</div>
					<div className="tile-label">{t.bugOpenNow}</div>
					<div className="tile-hint">{t.bugVsDay(since, count(t, report.openBefore))}</div>
				</section>
			</div>
			<div className="block block-small">
				<section className="tile tone-open">
					<div className="tile-top">
						<span className="tile-icon">
							<PlusIcon />
						</span>
					</div>
					<div className="tile-value">{count(t, report.added.count)}</div>
					<div className="tile-label">{t.bugNewSince(since)}</div>
					<div className="tile-hint">{t.bugDayBefore(count(t, report.added.before))}</div>
				</section>
			</div>
			<div className="block block-small">
				<section className="tile tone-closed">
					<div className="tile-top">
						<span className="tile-icon">
							<CheckCircleIcon />
						</span>
					</div>
					<div className="tile-value">{count(t, report.closed.count)}</div>
					<div className="tile-label">{t.bugClosedSince(since)}</div>
					<div className="tile-hint">{t.bugDayBefore(count(t, report.closed.before))}</div>
				</section>
			</div>

			<div className="block block-half">
				<Card icon={<BugIcon />} title={t.bugsByPriority}>
					{report.byPriority.length === 0 ? (
						<p className="empty">{t.noBugs}</p>
					) : (
						<>
							<p className="card-help">{t.bugPriorityHelp(since)}</p>
							<ul className="prio-list">
								{report.byPriority.map((p) => (
									<li key={p.name ?? '-'} className="prio-row prio-row-delta">
										<span className="prio-name">{p.name ?? t.noPriority}</span>
										<span className="prio-track">
											<span
												className={`prio-bar ${toneFor(p.rank, ranks)}`}
												style={{ width: `${(p.now / maxPriority) * 100}%` }}
											/>
										</span>
										<span className="prio-count">{count(t, p.now)}</span>
										<Delta value={p.now - p.before} />
									</li>
								))}
							</ul>
						</>
					)}
				</Card>
			</div>

			<div className="block block-half">
				<Card icon={<ChartIcon />} title={t.bugTrendTitle}>
					<p className="card-help">{t.bugTrendHelp(count(t, report.trend.length))}</p>
					<div className="day-bars" role="img" aria-label={t.bugTrendTitle}>
						{report.trend.map((p) => (
							<div
								key={p.day}
								className={`day-bar${p.day === report.today ? ' today' : ''}`}
								title={`${dayName(t, p.day, 'long')} ${dayDate(t, p.day)}: ${p.open}`}
							>
								<span className="day-value">{p.open}</span>
								<span className="day-fill" style={{ height: `${(p.open / maxTrend) * 100}%` }} />
								<span className="day-label">{dayName(t, p.day, 'short').slice(0, 2)}</span>
							</div>
						))}
					</div>
					<p className="day-range muted">
						{dayDate(t, report.trend[0].day)} – {dayDate(t, report.today)}
					</p>
				</Card>
			</div>

			<div className="block block-half">
				<BugList
					title={t.bugNewList(since)}
					items={report.added.items}
					total={report.added.count}
					empty={t.bugNoneNew}
					icon={<PlusIcon />}
					jiraBaseUrl={report.jiraBaseUrl}
					ranks={ranks}
				/>
			</div>
			<div className="block block-half">
				<BugList
					title={t.bugClosedList(since)}
					items={report.closed.items}
					total={report.closed.count}
					empty={t.bugNoneClosed}
					icon={<CheckCircleIcon />}
					jiraBaseUrl={report.jiraBaseUrl}
					ranks={ranks}
				/>
			</div>
		</div>
	)
}
