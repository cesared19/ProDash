const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
const longDateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })

export const shortDate = (iso: string) => dateFormat.format(new Date(iso))
export const longDate = (iso: string) => longDateFormat.format(new Date(iso))

// Human duration from days, rounded for quick reading.
export function duration(days: number | null): { value: string; unit: string } {
	if (days == null) return { value: '—', unit: '' }
	if (days < 1) return { value: '<1', unit: 'día' }
	if (days < 14) {
		const d = Math.round(days)
		return { value: String(d), unit: d === 1 ? 'día' : 'días' }
	}
	if (days < 120) {
		const w = Math.round(days / 7)
		return { value: String(w), unit: w === 1 ? 'semana' : 'semanas' }
	}
	const m = Math.round(days / 30)
	return { value: String(m), unit: m === 1 ? 'mes' : 'meses' }
}

export const durationText = (days: number | null) => {
	const d = duration(days)
	return d.unit ? `${d.value} ${d.unit}` : d.value
}

export function rate(perWeek: number) {
	const r = perWeek >= 10 ? Math.round(perWeek) : Math.round(perWeek * 10) / 10
	return r.toLocaleString('es')
}

export function periodLabel(days: number | null) {
	if (days == null) return 'desde siempre'
	if (days === 365) return 'último año'
	return `últimos ${days} días`
}
