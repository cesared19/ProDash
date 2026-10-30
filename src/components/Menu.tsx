import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from './icons'

const ITEMS = '[role="menuitem"], [role="menuitemradio"]'

/**
 * A button that opens a list of actions. Closes on Escape, on a click
 * outside or after choosing an item; arrow keys move between items.
 * `children` receives `close` so items can close the menu themselves.
 */
export function Menu({
	label,
	buttonContent,
	buttonClass = 'menu-button',
	align = 'start',
	showChevron = true,
	children,
}: {
	label: string
	buttonContent: ReactNode
	buttonClass?: string
	align?: 'start' | 'end'
	showChevron?: boolean
	children: (close: () => void) => ReactNode
}) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)

	const close = () => {
		setOpen(false)
		button.current?.focus()
	}

	useEffect(() => {
		if (!open) return
		const onPointer = (e: PointerEvent) => {
			if (!root.current?.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('pointerdown', onPointer)
		root.current?.querySelector<HTMLElement>(ITEMS)?.focus()
		return () => document.removeEventListener('pointerdown', onPointer)
	}, [open])

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault()
			close()
			return
		}
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
		e.preventDefault()
		const items = [...(root.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])]
		const index = items.indexOf(document.activeElement as HTMLElement)
		const next = e.key === 'ArrowDown' ? index + 1 : index - 1
		items[(next + items.length) % items.length]?.focus()
	}

	return (
		<div className="menu" ref={root} onKeyDown={open ? onKeyDown : undefined}>
			<button
				ref={button}
				className={buttonClass}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={label}
				title={label}
				onClick={() => setOpen(!open)}
			>
				{buttonContent}
				{showChevron && <ChevronDownIcon className="menu-chevron" />}
			</button>
			{open && (
				<div className={`menu-popover align-${align}`} role="menu" aria-label={label}>
					{children(close)}
				</div>
			)}
		</div>
	)
}

export function MenuItem({
	icon,
	children,
	onSelect,
	disabled,
}: {
	icon?: ReactNode
	children: ReactNode
	onSelect: () => void
	disabled?: boolean
}) {
	return (
		<button role="menuitem" className="menu-item" onClick={onSelect} disabled={disabled}>
			<span className="menu-item-icon">{icon}</span>
			<span className="menu-item-text">{children}</span>
		</button>
	)
}

export function MenuRadio({ checked, children, onSelect }: { checked: boolean; children: ReactNode; onSelect: () => void }) {
	return (
		<button role="menuitemradio" aria-checked={checked} className="menu-item" onClick={onSelect}>
			<span className="menu-item-icon menu-check" aria-hidden="true">
				{checked ? '✓' : ''}
			</span>
			<span className="menu-item-text">{children}</span>
		</button>
	)
}

// A submenu that opens inside the same list (works the same with a finger
// and with a mouse), showing its current value next to the label.
export function SubMenu({
	icon,
	label,
	value,
	children,
}: {
	icon?: ReactNode
	label: ReactNode
	value?: ReactNode
	children: ReactNode
}) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<button role="menuitem" className="menu-item" aria-expanded={open} onClick={() => setOpen(!open)}>
				<span className="menu-item-icon">{icon}</span>
				<span className="menu-item-text stacked">
					{label}
					{value && <span className="menu-item-value">{value}</span>}
				</span>
				<ChevronDownIcon className={`submenu-chevron${open ? ' open' : ''}`} />
			</button>
			{open && (
				<div role="group" className="submenu">
					{children}
				</div>
			)}
		</>
	)
}

export function MenuSeparator() {
	return <div role="separator" className="menu-separator" />
}

export function MenuNote({ children }: { children: ReactNode }) {
	return <div className="menu-note">{children}</div>
}
