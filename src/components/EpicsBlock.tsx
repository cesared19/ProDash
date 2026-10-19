import { useState } from 'react'
import type { EpicGroup, Summary } from '../api'
import { count, periodLabel } from '../format'
import { useT } from '../i18n'
import { Card, statusTones } from './Blocks'
import { ChevronDownIcon, LayersIcon } from './icons'

const PAGE = 30

function EpicRow({
	epic,
	toneOf,
	jiraBaseUrl,
}: {
	epic: EpicGroup
	toneOf: (status: string, category: string) => string
	jiraBaseUrl: string | null
}) {
	const t = useT()
	const [expanded, setExpanded] = useState(false)
	const [shown, setShown] = useState(PAGE)
	const name = epic.name ?? t.noEpic
	const total = epic.open + epic.closed
	const visible = epic.issues.slice(0, shown)
	const notLoaded = epic.issueCount - epic.issues.length

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

export function EpicsBlock({ summary }: { summary: Summary }) {
	const t = useT()
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
					<p className="card-help">
						{t.epicHelp(periodLabel(t, summary.periodDays))} <span className="screen-only">{t.epicTap}</span>
					</p>
					<ul className="epic-list">
						{summary.epics.map((epic) => (
							<EpicRow key={epic.key ?? '-'} epic={epic} toneOf={toneOf} jiraBaseUrl={summary.jiraBaseUrl} />
						))}
					</ul>
				</>
			)}
		</Card>
	)
}
