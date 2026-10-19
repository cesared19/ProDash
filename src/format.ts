import type { Messages } from './i18n'

export const shortDate = (t: Messages, iso: string) =>
	new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'short' }).format(new Date(iso))

export const longDate = (t: Messages, iso: string) =>
	new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

// Human duration from days, rounded for quick reading.
export function duration(t: Messages, days: number | null): { value: string; unit: string } {
	if (days == null) return { value: '—', unit: '' }
	if (days < 1) return { value: '<1', unit: t.units.day[0] }
	const pick = (n: number, [one, many]: string[]) => ({ value: String(n), unit: n === 1 ? one : many })
	if (days < 14) return pick(Math.round(days), t.units.day)
	if (days < 120) return pick(Math.round(days / 7), t.units.week)
	return pick(Math.round(days / 30), t.units.month)
}

export const durationText = (t: Messages, days: number | null) => {
	const d = duration(t, days)
	return d.unit ? `${d.value} ${d.unit}` : d.value
}

export function rate(t: Messages, perWeek: number) {
	const r = perWeek >= 10 ? Math.round(perWeek) : Math.round(perWeek * 10) / 10
	return r.toLocaleString(t.locale)
}

export const count = (t: Messages, n: number) => n.toLocaleString(t.locale)

export function periodLabel(t: Messages, days: number | null) {
	if (days == null) return t.sinceAlways
	if (days === 365) return t.lastYear
	return t.lastDays(days)
}
