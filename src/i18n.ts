import { createContext, useContext } from 'react'
import type { BlockId } from './settings'

export type Lang = 'es' | 'en'

export const LANGS: { value: Lang; label: string }[] = [
	{ value: 'es', label: 'Español' },
	{ value: 'en', label: 'English' },
]

const es = {
	locale: 'es',
	loading: 'Cargando…',
	// Login
	password: 'Contraseña',
	enter: 'Entrar',
	entering: 'Entrando…',
	// Project picker
	pickProject: 'Elige un proyecto',
	close: 'Cerrar',
	loadingProjects: 'Cargando proyectos…',
	searchProject: 'Buscar proyecto',
	noProjects:
		'Jira no devolvió ningún proyecto. La cuenta de JIRA_EMAIL necesita permiso para ver proyectos (Browse projects) en este sitio de Jira.',
	noMatch: 'Ningún proyecto coincide.',
	// Toolbar
	changeProject: 'Cambiar proyecto',
	period: 'Periodo',
	periods: { 30: '30 días', 90: '90 días', 180: '6 meses', 365: '1 año', all: 'Todo' },
	refresh: 'Actualizar',
	customize: 'Personalizar',
	downloadPng: 'Descargar PNG',
	creating: 'Creando…',
	logout: 'Salir',
	demo: 'Modo demo: los datos son de ejemplo.',
	// Report
	reportLine: (date: string, period: string) => `Reporte del ${date} · cerrados: ${period}`,
	excluding: (types: string) => ` · sin contar: ${types}`,
	loadingData: 'Cargando datos de Jira…',
	allHidden: 'Todos los bloques están ocultos. Usa Personalizar.',
	truncated: 'Hay más de 5.000 tickets; los números consideran solo los primeros 5.000.',
	fileName: 'reporte',
	pngError: 'No se pudo generar la imagen',
	// Blocks
	health: { good: 'Al día', warning: 'Atención', bad: 'Atrasado', unknown: 'Sin datos' },
	open: 'Abiertos',
	openHint: 'Tickets por cerrar',
	closed: 'Cerrados',
	toCloseAll: 'Para cerrar todo',
	allDone: '¡Listo!',
	nothingOpen: 'No queda nada abierto',
	noClosures: 'No hubo cierres en el periodo',
	closingRate: (rate: string) => `Cerrando ${rate} por semana`,
	towards: (date: string) => ` · hacia el ${date}`,
	byStatus: 'Abiertos por estado',
	noOpen: 'No hay tickets abiertos.',
	statusShare: 'Proporción de tickets por estado',
	howLong: '¿Cuánto tardan?',
	takesToClose: 'Un ticket tarda en cerrarse',
	openWaiting: 'Los abiertos llevan esperando',
	verdict: {
		unknown: 'Aún no hay datos suficientes para comparar.',
		good: 'Los abiertos van dentro de lo normal.',
		warning: 'Los abiertos llevan algo más de lo normal.',
		bad: 'Los abiertos llevan mucho más de lo normal.',
	},
	growing: (inRate: string, outRate: string) =>
		`Entran ${inRate} por semana y salen ${outRate}: la lista está creciendo.`,
	trajectory: 'Trayectoria',
	// Chart
	noHistory: 'Todavía no hay historia suficiente.',
	openTickets: 'Tickets abiertos',
	projection: 'Proyección',
	chartLabel: 'Evolución de tickets abiertos y proyección de cierre',
	today: 'Hoy',
	goal: (date: string) => `Meta ${date}`,
	openCount: 'abiertos',
	// Durations and periods
	units: { day: ['día', 'días'], week: ['semana', 'semanas'], month: ['mes', 'meses'] },
	sinceAlways: 'desde siempre',
	lastYear: 'último año',
	lastDays: (days: number) => `últimos ${days} días`,
	// Customize
	done: 'Listo',
	language: 'Idioma',
	text: 'Texto',
	bigText: 'Texto extra grande',
	blocksTitle: 'Bloques',
	blocksHelp: 'Marca los que quieres ver y ordénalos con las flechas.',
	moveUp: (block: string) => `Subir ${block}`,
	moveDown: (block: string) => `Bajar ${block}`,
	typesTitle: 'Tipos de ticket que no se cuentan',
	typesHelp: 'Por defecto se excluyen errores (bugs) y épicas.',
	loadingTypes: 'Cargando tipos…',
	resetTypes: 'Volver a los tipos por defecto',
	blocks: {
		open: 'Abiertos',
		closed: 'Cerrados',
		eta: 'Tiempo para terminar',
		statuses: 'Abiertos por estado',
		times: 'Comparación de tiempos',
		trajectory: 'Trayectoria',
	} satisfies Record<BlockId, string>,
}

export type Messages = typeof es

const en: Messages = {
	locale: 'en',
	loading: 'Loading…',
	password: 'Password',
	enter: 'Sign in',
	entering: 'Signing in…',
	pickProject: 'Choose a project',
	close: 'Close',
	loadingProjects: 'Loading projects…',
	searchProject: 'Search projects',
	noProjects:
		'Jira returned no projects. The JIRA_EMAIL account needs permission to see projects (Browse projects) on this Jira site.',
	noMatch: 'No project matches.',
	changeProject: 'Change project',
	period: 'Period',
	periods: { 30: '30 days', 90: '90 days', 180: '6 months', 365: '1 year', all: 'All' },
	refresh: 'Refresh',
	customize: 'Customize',
	downloadPng: 'Download PNG',
	creating: 'Creating…',
	logout: 'Sign out',
	demo: 'Demo mode: the data is sample data.',
	reportLine: (date: string, period: string) => `Report of ${date} · closed: ${period}`,
	excluding: (types: string) => ` · excluding: ${types}`,
	loadingData: 'Loading Jira data…',
	allHidden: 'All blocks are hidden. Use Customize.',
	truncated: 'There are more than 5,000 tickets; the numbers only consider the first 5,000.',
	fileName: 'report',
	pngError: 'The image could not be created',
	health: { good: 'On track', warning: 'Attention', bad: 'Behind', unknown: 'No data' },
	open: 'Open',
	openHint: 'Tickets left to close',
	closed: 'Closed',
	toCloseAll: 'To close everything',
	allDone: 'Done!',
	nothingOpen: 'Nothing left open',
	noClosures: 'Nothing was closed in this period',
	closingRate: (rate: string) => `Closing ${rate} per week`,
	towards: (date: string) => ` · by ${date}`,
	byStatus: 'Open by status',
	noOpen: 'There are no open tickets.',
	statusShare: 'Share of tickets by status',
	howLong: 'How long do they take?',
	takesToClose: 'A ticket takes to close',
	openWaiting: 'Open tickets have been waiting',
	verdict: {
		unknown: 'There is not enough data to compare yet.',
		good: 'Open tickets are within the usual time.',
		warning: 'Open tickets are taking somewhat longer than usual.',
		bad: 'Open tickets are taking much longer than usual.',
	},
	growing: (inRate: string, outRate: string) =>
		`${inRate} come in per week and ${outRate} go out: the list is growing.`,
	trajectory: 'Trajectory',
	noHistory: 'There is not enough history yet.',
	openTickets: 'Open tickets',
	projection: 'Projection',
	chartLabel: 'Open tickets over time and closing projection',
	today: 'Today',
	goal: (date: string) => `Goal ${date}`,
	openCount: 'open',
	units: { day: ['day', 'days'], week: ['week', 'weeks'], month: ['month', 'months'] },
	sinceAlways: 'all time',
	lastYear: 'last year',
	lastDays: (days: number) => `last ${days} days`,
	done: 'Done',
	language: 'Language',
	text: 'Text',
	bigText: 'Extra large text',
	blocksTitle: 'Blocks',
	blocksHelp: 'Check the ones you want to see and reorder them with the arrows.',
	moveUp: (block: string) => `Move ${block} up`,
	moveDown: (block: string) => `Move ${block} down`,
	typesTitle: 'Ticket types not counted',
	typesHelp: 'Bugs and epics are excluded by default.',
	loadingTypes: 'Loading types…',
	resetTypes: 'Back to the default types',
	blocks: {
		open: 'Open',
		closed: 'Closed',
		eta: 'Time to finish',
		statuses: 'Open by status',
		times: 'Time comparison',
		trajectory: 'Trajectory',
	},
}

export const MESSAGES: Record<Lang, Messages> = { es, en }

export function browserLang(): Lang {
	return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export const LangContext = createContext<Messages>(es)

export const useT = () => useContext(LangContext)
