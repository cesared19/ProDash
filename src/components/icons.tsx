import type { ReactNode, SVGProps } from 'react'

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			{children}
		</svg>
	)
}

type P = SVGProps<SVGSVGElement>

export const InboxIcon = (p: P) => (
	<Icon {...p}>
		<path d="M22 12h-6l-2 3h-4l-2-3H2" />
		<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
	</Icon>
)

export const CheckCircleIcon = (p: P) => (
	<Icon {...p}>
		<circle cx="12" cy="12" r="10" />
		<path d="m8 12 3 3 5-6" />
	</Icon>
)

export const AlertIcon = (p: P) => (
	<Icon {...p}>
		<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
		<path d="M12 9v4M12 17h.01" />
	</Icon>
)

export const StopIcon = (p: P) => (
	<Icon {...p}>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 7v6M12 17h.01" />
	</Icon>
)

export const QuestionIcon = (p: P) => (
	<Icon {...p}>
		<circle cx="12" cy="12" r="10" />
		<path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
	</Icon>
)

export const FlagIcon = (p: P) => (
	<Icon {...p}>
		<path d="M4 22V4M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1" />
	</Icon>
)

export const ClockIcon = (p: P) => (
	<Icon {...p}>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 6v6l4 2" />
	</Icon>
)

export const ChartIcon = (p: P) => (
	<Icon {...p}>
		<path d="M3 3v18h18" />
		<path d="m7 14 4-4 4 4 5-6" />
	</Icon>
)

export const GridIcon = (p: P) => (
	<Icon {...p}>
		<rect x="3" y="3" width="7" height="7" rx="1" />
		<rect x="14" y="3" width="7" height="7" rx="1" />
		<rect x="3" y="14" width="7" height="7" rx="1" />
		<rect x="14" y="14" width="7" height="7" rx="1" />
	</Icon>
)

export const RefreshIcon = (p: P) => (
	<Icon {...p}>
		<path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
		<path d="M21 3v5h-5" />
	</Icon>
)

export const SlidersIcon = (p: P) => (
	<Icon {...p}>
		<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
	</Icon>
)

export const ImageIcon = (p: P) => (
	<Icon {...p}>
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<circle cx="9" cy="9" r="2" />
		<path d="m21 15-5-5L5 21" />
	</Icon>
)

export const ChevronDownIcon = (p: P) => (
	<Icon {...p}>
		<path d="m6 9 6 6 6-6" />
	</Icon>
)

export const ArrowUpIcon = (p: P) => (
	<Icon {...p}>
		<path d="M12 19V5M5 12l7-7 7 7" />
	</Icon>
)

export const ArrowDownIcon = (p: P) => (
	<Icon {...p}>
		<path d="M12 5v14M19 12l-7 7-7-7" />
	</Icon>
)

export const CloseIcon = (p: P) => (
	<Icon {...p}>
		<path d="M18 6 6 18M6 6l12 12" />
	</Icon>
)

export const LogoutIcon = (p: P) => (
	<Icon {...p}>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
	</Icon>
)

export const LayersIcon = (p: P) => (
	<Icon {...p}>
		<path d="m12 2 10 5-10 5L2 7l10-5z" />
		<path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
	</Icon>
)

export const PlusIcon = (p: P) => (
	<Icon {...p}>
		<path d="M12 5v14M5 12h14" />
	</Icon>
)

export const PencilIcon = (p: P) => (
	<Icon {...p}>
		<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
	</Icon>
)
