import { useCallback, useState } from 'react'
import { browserLang, type Lang } from './i18n'

export type BlockId = 'open' | 'closed' | 'eta' | 'statuses' | 'times' | 'trajectory'

export const BLOCKS: BlockId[] = ['open', 'closed', 'eta', 'statuses', 'times', 'trajectory']

export type Period = 30 | 90 | 180 | 365 | 'all'

export type Settings = {
	projectKey: string | null
	period: Period
	order: BlockId[]
	hidden: BlockId[]
	// Excluded issue type IDs per project; missing = defaults (bugs and epics).
	excluded: Record<string, string[]>
	bigText: boolean
	lang: Lang
}

const DEFAULTS: Settings = {
	projectKey: null,
	period: 90,
	order: BLOCKS,
	hidden: [],
	excluded: {},
	bigText: false,
	lang: browserLang(),
}

const STORAGE_KEY = 'prodash-settings'

function load(): Settings {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>
		const merged = { ...DEFAULTS, ...saved }
		// Keep the order valid if blocks are added or removed in a new version.
		const known = BLOCKS
		merged.order = [...merged.order.filter((id) => known.includes(id)), ...known.filter((id) => !merged.order.includes(id))]
		return merged
	} catch {
		return DEFAULTS
	}
}

export function useSettings() {
	const [settings, setSettings] = useState<Settings>(load)
	const update = useCallback((patch: Partial<Settings>) => {
		setSettings((current) => {
			const next = { ...current, ...patch }
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
			} catch {
				// Private mode or blocked storage: settings last for this visit only.
			}
			return next
		})
	}, [])
	return [settings, update] as const
}
