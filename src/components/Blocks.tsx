import type { ReactNode } from 'react'
import type { Health, Summary } from '../api'
import { duration, durationText, longDate, periodLabel, rate } from '../format'
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
export const HEALTH: Record<Health, { label: string; className: string; Icon: typeof CheckCircleIcon }> = {
	good: { label: 'Al día', className: 'tone-good', Icon: CheckCircleIcon },
	warning: { label: 'Atención', className: 'tone-warning', Icon: AlertIcon },
	bad: { label: 'Atrasado', className: 'tone-bad', Icon: StopIcon },
	unknown: { label: 'Sin datos', className: 'tone-neutral', Icon: QuestionIcon },
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
	return (
		<Tile
			className="tone-open"
			icon={<InboxIcon />}
			value={summary.openCount.toLocaleString('es')}
			label="Abiertos"
			hint="Tickets por cerrar"
		/>
	)
}

export function ClosedBlock({ summary }: { summary: Summary }) {
	return (
		<Tile
			className="tone-closed"
			icon={<CheckCircleIcon />}
			value={summary.closedCount.toLocaleString('es')}
			label="Cerrados"
			hint={periodLabel(summary.periodDays)}
		/>
	)
}

export function EtaBlock({ summary }: { summary: Summary }) {
	const t = summary.trajectory
	const health = HEALTH[t.health]
	const eta = duration(t.etaWeeks == null ? null : t.etaWeeks * 7)
	let hint: ReactNode
	if (t.remaining === 0) hint = 'No queda nada abierto'
	else if (t.etaWeeks == null) hint = 'No hubo cierres en el periodo'
	else
		hint = (
			<>
				Cerrando {rate(t.closeRatePerWeek)} por semana
				{t.etaDate && <> · hacia el {longDate(t.etaDate)}</>}
			</>
		)
	return (
		<Tile
			className={health.className}
			icon={<FlagIcon />}
			value={t.remaining === 0 ? '¡Listo!' : t.etaWeeks == null ? '?' : `~${eta.value}`}
			unit={t.remaining === 0 || t.etaWeeks == null ? undefined : eta.unit}
			label="Para cerrar todo"
			hint={hint}
			badge={
				<span className="badge">
					<health.Icon /> {health.label}
				</span>
			}
		/>
	)
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
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
	const tones = statusTones(summary.byStatus)
	const total = summary.openCount
	return (
		<Card icon={<GridIcon />} title="Abiertos por estado">
			{total === 0 ? (
				<p className="empty">No hay tickets abiertos.</p>
			) : (
				<>
					<div className="stack-bar" role="img" aria-label="Proporción de tickets por estado">
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
								<div className="status-count">{s.count.toLocaleString('es')}</div>
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
	const t = summary.trajectory
	const lead = t.avgLeadTimeDays
	const age = t.avgOpenAgeDays
	const max = Math.max(lead ?? 0, age ?? 0, 1)
	const health = HEALTH[t.health]
	let verdict: string
	if (lead == null || age == null) verdict = 'Aún no hay datos suficientes para comparar.'
	else if (t.health === 'good') verdict = 'Los abiertos van dentro de lo normal.'
	else if (t.health === 'warning') verdict = 'Los abiertos llevan algo más de lo normal.'
	else verdict = 'Los abiertos llevan mucho más de lo normal.'

	return (
		<Card icon={<ClockIcon />} title="¿Cuánto tardan?">
			<div className="compare">
				<div className="compare-row">
					<div className="compare-label">Un ticket tarda en cerrarse</div>
					<div className="compare-track">
						<div className="compare-bar tone-closed" style={{ width: `${((lead ?? 0) / max) * 100}%` }} />
					</div>
					<div className="compare-value">{durationText(lead)}</div>
				</div>
				<div className="compare-row">
					<div className="compare-label">Los abiertos llevan esperando</div>
					<div className="compare-track">
						<div className={`compare-bar ${health.className}`} style={{ width: `${((age ?? 0) / max) * 100}%` }} />
					</div>
					<div className="compare-value">{durationText(age)}</div>
				</div>
			</div>
			<p className={`verdict ${health.className}-text`}>
				<health.Icon /> {verdict}
			</p>
			{t.createRatePerWeek > t.closeRatePerWeek && t.remaining > 0 && (
				<p className="note">
					<AlertIcon /> Entran {rate(t.createRatePerWeek)} por semana y salen {rate(t.closeRatePerWeek)}: la lista
					está creciendo.
				</p>
			)}
		</Card>
	)
}

export function TrajectoryBlock({ summary }: { summary: Summary }) {
	return (
		<Card icon={<ChartIcon />} title="Trayectoria">
			<TrendChart summary={summary} />
		</Card>
	)
}
