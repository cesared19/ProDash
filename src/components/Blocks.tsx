import type { ReactNode } from 'react'
import type { Health, Summary } from '../api'
import { count, duration, durationText, longDate, periodLabel, rate } from '../format'
import { useT } from '../i18n'
import { TrendChart } from './TrendChart'
import {
	AlertIcon,
	ChartIcon,
	CheckCircleIcon,
	ClockIcon,
	FlagIcon,
	GridIcon,
	InboxIcon,
	QuestionIcon,
	StopIcon,
} from './icons'

// Status colors are reserved for the health verdict and always ship with an icon and a word.
export const HEALTH: Record<Health, { className: string; Icon: typeof CheckCircleIcon }> = {
	good: { className: 'tone-good', Icon: CheckCircleIcon },
	warning: { className: 'tone-warning', Icon: AlertIcon },
	bad: { className: 'tone-bad', Icon: StopIcon },
	unknown: { className: 'tone-neutral', Icon: QuestionIcon },
}

// "To do" statuses are neutral; in-progress statuses take categorical hues in fixed order.
const IN_PROGRESS_TONES = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5']

export function statusTones(byStatus: Summary['byStatus']) {
	let next = 0
	return byStatus.map((s) =>
		s.category === 'new' ? 'tone-todo' : IN_PROGRESS_TONES[next++] ?? 'tone-other',
	)
}

function Tile({
	className,
	icon,
	value,
	unit,
	label,
	hint,
	badge,
}: {
	className: string
	icon: ReactNode
	value: string
	unit?: string
	label: string
	hint?: ReactNode
	badge?: ReactNode
}) {
	return (
		<section className={`tile ${className}`} aria-label={`${label}: ${value} ${unit ?? ''}`}>
			<div className="tile-top">
				<span className="tile-icon">{icon}</span>
				{badge}
			</div>
			<div className="tile-value">
				{value}
				{unit && <span className="tile-unit"> {unit}</span>}
			</div>
			<div className="tile-label">{label}</div>
			{hint && <div className="tile-hint">{hint}</div>}
		</section>
	)
}

export function OpenBlock({ summary }: { summary: Summary }) {
	const t = useT()
	return (
		<Tile
			className="tone-open"
			icon={<InboxIcon />}
			value={count(t, summary.openCount)}
			label={t.open}
			hint={t.openHint}
		/>
	)
}

export function ClosedBlock({ summary }: { summary: Summary }) {
	const t = useT()
	return (
		<Tile
			className="tone-closed"
			icon={<CheckCircleIcon />}
			value={count(t, summary.closedCount)}
			label={t.closed}
			hint={periodLabel(t, summary.periodDays)}
		/>
	)
}

export function EtaBlock({ summary }: { summary: Summary }) {
	const t = useT()
	const tr = summary.trajectory
	const health = HEALTH[tr.health]
	const eta = duration(t, tr.etaWeeks == null ? null : tr.etaWeeks * 7)
	let hint: ReactNode
	if (tr.remaining === 0) hint = t.nothingOpen
	else if (tr.etaWeeks == null) hint = t.noClosures
	else
		hint = (
			<>
				{t.closingRate(rate(t, tr.closeRatePerWeek))}
				{tr.etaDate && t.towards(longDate(t, tr.etaDate))}
			</>
		)
	return (
		<Tile
			className={health.className}
			icon={<FlagIcon />}
			value={tr.remaining === 0 ? t.allDone : tr.etaWeeks == null ? '?' : `~${eta.value}`}
			unit={tr.remaining === 0 || tr.etaWeeks == null ? undefined : eta.unit}
			label={t.toCloseAll}
			hint={hint}
			badge={
				<span className="badge">
					<health.Icon /> {t.health[tr.health]}
				</span>
			}
		/>
	)
}

export function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
	return (
		<section className="card" aria-label={title}>
			<h2 className="card-title">
				<span className="card-icon">{icon}</span>
				{title}
			</h2>
			{children}
		</section>
	)
}

export function StatusesBlock({ summary }: { summary: Summary }) {
	const t = useT()
	const tones = statusTones(summary.byStatus)
	const total = summary.openCount
	return (
		<Card icon={<GridIcon />} title={t.byStatus}>
			{total === 0 ? (
				<p className="empty">{t.noOpen}</p>
			) : (
				<>
					<div className="stack-bar" role="img" aria-label={t.statusShare}>
						{summary.byStatus.map((s, i) => (
							<div
								key={s.name}
								className={`stack-seg ${tones[i]}`}
								style={{ flexGrow: s.count }}
								title={`${s.name}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
							/>
						))}
					</div>
					<div className="status-grid">
						{summary.byStatus.map((s, i) => (
							<div key={s.name} className={`status-tile ${tones[i]}`}>
								<div className="status-count">{count(t, s.count)}</div>
								<div className="status-name">{s.name}</div>
								<div className="status-pct">{Math.round((s.count / total) * 100)}%</div>
							</div>
						))}
					</div>
				</>
			)}
		</Card>
	)
}

export function TimesBlock({ summary }: { summary: Summary }) {
	const t = useT()
	const tr = summary.trajectory
	const lead = tr.avgLeadTimeDays
	const age = tr.avgOpenAgeDays
	const max = Math.max(lead ?? 0, age ?? 0, 1)
	const health = HEALTH[tr.health]
	const verdict = lead == null || age == null ? t.verdict.unknown : t.verdict[tr.health]

	return (
		<Card icon={<ClockIcon />} title={t.howLong}>
			<div className="compare">
				<div className="compare-row">
					<div className="compare-label">{t.takesToClose}</div>
					<div className="compare-track">
						<div className="compare-bar tone-closed" style={{ width: `${((lead ?? 0) / max) * 100}%` }} />
					</div>
					<div className="compare-value">{durationText(t, lead)}</div>
				</div>
				<div className="compare-row">
					<div className="compare-label">{t.openWaiting}</div>
					<div className="compare-track">
						<div className={`compare-bar ${health.className}`} style={{ width: `${((age ?? 0) / max) * 100}%` }} />
					</div>
					<div className="compare-value">{durationText(t, age)}</div>
				</div>
			</div>
			<p className={`verdict ${health.className}-text`}>
				<health.Icon /> {verdict}
			</p>
			{tr.createRatePerWeek > tr.closeRatePerWeek && tr.remaining > 0 && (
				<p className="note">
					<AlertIcon /> {t.growing(rate(t, tr.createRatePerWeek), rate(t, tr.closeRatePerWeek))}
				</p>
			)}
		</Card>
	)
}

export function TrajectoryBlock({ summary }: { summary: Summary }) {
	const t = useT()
	return (
		<Card icon={<ChartIcon />} title={t.trajectory}>
			<TrendChart summary={summary} />
		</Card>
	)
}
