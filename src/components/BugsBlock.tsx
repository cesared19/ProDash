import type { Summary } from '../api'
import { count } from '../format'
import { useT } from '../i18n'
import { Card } from './Blocks'
import { BugIcon } from './icons'

// Priority is ordinal: one hue, darker for higher priority. Bars carry their
// name and number as text, so the color never stands alone.
const PRIORITY_TONES = ['prio-1', 'prio-2', 'prio-3', 'prio-4', 'prio-5']

export function BugsBlock({ summary }: { summary: Summary }) {
	const t = useT()
	const bugs = summary.bugs
	if (!bugs) return <></>
	const max = Math.max(...bugs.byPriority.map((p) => p.count), 1)
	const ranked = bugs.byPriority.filter((p) => p.name != null)

	return (
		<Card icon={<BugIcon />} title={t.bugsTitle}>
			{bugs.total === 0 ? (
				<p className="empty">{t.noBugs}</p>
			) : (
				<>
					<div className="bugs-total">
						<span className="bugs-number">{count(t, bugs.total)}</span>
						<span className="bugs-label">{t.bugsOpen(bugs.total)}</span>
					</div>
					<p className="bugs-stages">
						<span>{t.bugsTodo(count(t, bugs.todo))}</span>
						<span>{t.bugsInProgress(count(t, bugs.inProgress))}</span>
					</p>
					<h3 className="bugs-subtitle">{t.bugsByPriority}</h3>
					<ul className="prio-list">
						{bugs.byPriority.map((p) => {
							const index = p.name == null ? -1 : ranked.indexOf(p)
							// Spread the ramp over the priorities present: first is darkest, last lightest.
							const tone =
								index < 0
									? 'prio-none'
									: PRIORITY_TONES[Math.round((index / Math.max(ranked.length - 1, 1)) * (PRIORITY_TONES.length - 1))]
							return (
								<li key={p.name ?? '-'} className="prio-row">
									<span className="prio-name">{p.name ?? t.noPriority}</span>
									<span className="prio-track">
										<span className={`prio-bar ${tone}`} style={{ width: `${(p.count / max) * 100}%` }} />
									</span>
									<span className="prio-count">{count(t, p.count)}</span>
								</li>
							)
						})}
					</ul>
				</>
			)}
		</Card>
	)
}
