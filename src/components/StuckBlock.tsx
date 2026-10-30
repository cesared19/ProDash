import type { StuckLevel } from '../api'
import { count, durationText } from '../format'
import { useT } from '../i18n'
import { Card, statusTones } from './Blocks'
import type { BlockProps } from './Dashboard'
import { AlertIcon, CheckCircleIcon, HourglassIcon, StopIcon } from './icons'

const PAGE = 5
// Key in the shared expanded/shown state, so the PNG shows the same rows.
const UI_KEY = '__stuck'

const LEVEL_TONE: Record<StuckLevel, string> = { severe: 'tone-bad', warning: 'tone-warning' }
const LEVEL_ICON: Record<StuckLevel, typeof AlertIcon> = { severe: StopIcon, warning: AlertIcon }

export const timesText = (times: number) => String(Math.round(times * 10) / 10)

export function StuckBlock({ summary, epicUi, setEpicUi }: BlockProps) {
	const t = useT()
	const { count: total, items } = summary.stuck
	const shown = epicUi[UI_KEY]?.shown ?? PAGE
	// Same colors as "Open by status", so a status reads the same everywhere.
	const tones = statusTones(summary.byStatus)
	const toneOf = (status: string) => tones[summary.byStatus.findIndex((s) => s.name === status)] ?? 'tone-other'
	// One scale for every row, in "times the usual": a longer bar is more
	// stuck, and the usual mark sits in the same place on all rows.
	const maxTimes = Math.max(...items.map((i) => i.times), 1) * 1.05

	return (
		<Card icon={<HourglassIcon />} title={t.stuckTitle}>
			{total === 0 ? (
				<p className="empty-ok">
					<CheckCircleIcon /> {t.stuckNone}
				</p>
			) : (
				<>
					<div className="stuck-summary">
						<span className="stuck-number">{count(t, total)}</span>
						<span className="stuck-label">{t.stuckSummary(total)}</span>
					</div>
					<div className="stuck-legend">
						{(['severe', 'warning'] as const).map((level) => {
							const Icon = LEVEL_ICON[level]
							return (
								<span key={level}>
									<span className={`sev ${LEVEL_TONE[level]}`}>
										<Icon /> {t.stuckLevel[level]}
									</span>
									{level === 'severe' ? t.stuckLegendSevere : t.stuckLegendWarning}
								</span>
							)
						})}
					</div>
					<div className="scale-legend">
						<span className="tick-sample" /> {t.stuckScale}
					</div>
					<ul className="stuck-list">
						{items.slice(0, shown).map((item) => (
							<li key={item.key} className="stuck-row">
								<div className="stuck-head">
									<span className={`sev ${LEVEL_TONE[item.level]}`}>{t.stuckLevel[item.level]}</span>
									<span className={`status-pill ${toneOf(item.status)}`}>{item.status}</span>
									{summary.jiraBaseUrl ? (
										<a
											className="issue-key"
											href={`${summary.jiraBaseUrl}/browse/${item.key}`}
											target="_blank"
											rel="noreferrer"
										>
											{item.key}
										</a>
									) : (
										<span className="issue-key">{item.key}</span>
									)}
									<span className="issue-summary">{item.summary}</span>
								</div>
								<div className="bar-row">
									<div
										className="stuck-bar"
										role="img"
										aria-label={t.stuckBar(durationText(t, item.days), durationText(t, item.usualDays))}
									>
										<span
											className={`stuck-fill ${LEVEL_TONE[item.level]}`}
											style={{ width: `${(item.times / maxTimes) * 100}%` }}
										/>
										<span className="stuck-normal" style={{ left: `calc(${(1 / maxTimes) * 100}% - 1px)` }} />
									</div>
									<span className="times-big">×{timesText(item.times)}</span>
								</div>
								<div className="stuck-time">
									<span>
										{t.stuckFor} <strong>{durationText(t, item.days)}</strong>
									</span>
									<span className="muted">{t.stuckUsual(durationText(t, item.usualDays))}</span>
								</div>
							</li>
						))}
					</ul>
					{shown < items.length && (
						<button
							className="button stuck-more"
							onClick={() => setEpicUi(UI_KEY, { expanded: true, shown: shown + PAGE })}
						>
							{t.showMore(count(t, Math.min(PAGE, items.length - shown)))}
						</button>
					)}
				</>
			)}
		</Card>
	)
}
