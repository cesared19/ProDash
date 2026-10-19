import { toBlob } from 'html-to-image'

export const REPORT_WIDTH = 1200

// `node` is a copy of the report rendered off-screen at REPORT_WIDTH, so the
// PNG looks the same whether it is made on a phone or on the Mac.
export async function exportPng(node: HTMLElement, fileName: string) {
	const blob = await toBlob(node, {
		pixelRatio: 2,
		width: REPORT_WIDTH,
		height: node.scrollHeight,
		backgroundColor: getComputedStyle(node).backgroundColor,
		filter: (n) => !(n instanceof HTMLElement && n.dataset.noExport != null),
	})
	if (!blob) throw new Error('No se pudo generar la imagen')
	const file = new File([blob], fileName, { type: 'image/png' })
	const touch = matchMedia('(pointer: coarse)').matches
	if (touch && navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title: fileName })
			return
		} catch (e) {
			if ((e as Error).name === 'AbortError') return
		}
	}
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = fileName
	document.body.appendChild(a)
	a.click()
	a.remove()
	setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
