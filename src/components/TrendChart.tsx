import { useEffect, useRef, useState } from 'react'
import type { Summary } from '../api'
import { shortDate } from '../format'

const HEIGHT = 260
const PAD = { top: 20, right: 20, bottom: 36, left: 44 }

function niceMax(value: number) {
	if (value <= 5) return 5
	const pow = 10 ** Math.floor(Math.log10(value))
	const n = value / pow
	return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

function useWidth() {
	const ref = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(600)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)))
		observer.observe(el)
		return () => observer.disconnect()
	}, [])
	return [ref, width] as const
}

export function TrendChart({ summary }: { summary: Summary }) {
	const [ref, width] = useWidth()
	const [hover, setHover] = useState<number | null>(null)
	const { history, trajectory: t } = summary
	if (history.length < 2) return <p className="empty">Todavía no hay historia suficiente.</p>

	const start = Date.parse(history[0].date)
	const now = Date.parse(history[history.length - 1].date)
	const eta = t.etaDate && t.remaining > 0 ? Date.parse(t.etaDate) : null
	// Keep the projection readable: show at most twice the history span ahead.
	const end = eta ? Math.min(eta, now + Math.max(now - start, 28 * 864e5) * 2) : now
	const projectedAtEnd = eta ? t.remaining * (1 - (end - now) / (eta - now)) : 0

	const yMax = niceMax(Math.max(...history.map((h) => h.open), 1) * 1.05)
	const innerW = width - PAD.left - PAD.right
	const innerH = HEIGHT - PAD.top - PAD.bottom
	const x = (time: number) => PAD.left + ((time - start) / Math.max(end - start, 1)) * innerW
	const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH

	const points = history.map((h) => ({ time: Date.parse(h.date), open: h.open }))
	const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.time).toFixed(1)},${y(p.open).toFixed(1)}`).join('')
	const area = `${line}L${x(now).toFixed(1)},${y(0)}L${x(start).toFixed(1)},${y(0)}Z`
	const ticks = [0, yMax / 2, yMax]

	function onMove(e: React.PointerEvent<SVGRectElement>) {
		const box = e.currentTarget.getBoundingClientRect()
		const px = ((e.clientX - box.left) / box.width) * innerW + PAD.left
		let best = 0
		points.forEach((p, i) => {
			if (Math.abs(x(p.time) - px) < Math.abs(x(points[best].time) - px)) best = i
		})
		setHover(best)
	}

	const hp = hover != null ? points[hover] : null
	const tipLeft = hp ? Math.min(Math.max(x(hp.time), 70), width - 70) : 0

	return (
		<div className="chart" ref={ref}>
			<div className="chart-legend">
				<span>
					<i className="legend-line" /> Tickets abiertos
				</span>
				{eta && (
					<span>
						<i className="legend-line dashed" /> Proyección
					</span>
				)}
			</div>
			<div className="chart-area">
				<svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label="Evolución de tickets abiertos y proyección de cierre">
					{ticks.map((v) => (
						<g key={v}>
							<line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
							<text className="axis" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">
								{Math.round(v)}
							</text>
						</g>
					))}
					<path className="series-area" d={area} />
					<path className="series-line" d={line} />
					{eta && (
						<path
							className="series-line dashed"
							d={`M${x(now)},${y(t.remaining)}L${x(end)},${y(projectedAtEnd)}`}
						/>
					)}
					<line className="today" x1={x(now)} x2={x(now)} y1={PAD.top} y2={y(0)} />
					<circle className="series-dot" cx={x(now)} cy={y(t.remaining)} r={5} />
					<text className="axis" x={x(start)} y={HEIGHT - 10} textAnchor="start">
						{shortDate(history[0].date)}
					</text>
					<text className="axis strong" x={x(now)} y={HEIGHT - 10} textAnchor={eta ? 'middle' : 'end'}>
						Hoy
					</text>
					{eta && (
						<text className="axis strong" x={x(end)} y={HEIGHT - 10} textAnchor="end">
							{end === eta ? `Meta ${shortDate(t.etaDate!)}` : `${shortDate(new Date(end).toISOString())} →`}
						</text>
					)}
					{hp && (
						<g pointerEvents="none">
							<line className="crosshair" x1={x(hp.time)} x2={x(hp.time)} y1={PAD.top} y2={y(0)} />
							<circle className="series-dot hover" cx={x(hp.time)} cy={y(hp.open)} r={6} />
						</g>
					)}
					<rect
						x={PAD.left}
						y={PAD.top}
						width={Math.max(x(now) - PAD.left, 1)}
						height={innerH}
						fill="transparent"
						onPointerMove={onMove}
						onPointerDown={onMove}
						onPointerLeave={() => setHover(null)}
					/>
				</svg>
				{hp && (
					<div className="tooltip" data-no-export style={{ left: tipLeft, top: Math.max(y(hp.open) - 56, 0) }}>
						<strong>{hp.open}</strong> abiertos
						<span>{shortDate(new Date(hp.time).toISOString())}</span>
					</div>
				)}
			</div>
		</div>
	)
}
