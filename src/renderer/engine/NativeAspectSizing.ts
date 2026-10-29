/**
 * Native-derived aspect sizing from pinned WorkbenchApp.exe VA 0x1408B8C70.
 *
 * Run 09 additionally verified the complete fixaspect property registration:
 * 0x1408B4BE8 -> "fixaspect" at 0x142065BF0 -> token 0x146143A90
 * -> common loader 0x1408BA840 -> widget flags bits 13:12.
 *
 * This only resolves the aspect-adjustment stage. Native DPI/safe-area
 * handling and container-specific measurement remain separate concerns.
 */
export type NativeAspectMode = 0 | 1 | 2 | 3;

export interface Size2D {
	width: number;
	height: number;
}

/** The native common property loader stores the low two bits. */
export function DecodeNativeAspectMode(raw: string | undefined): NativeAspectMode {
	if (raw === undefined || raw.trim() === "")
		return 0;
	const value = Number(raw);
	if (!Number.isFinite(value) || !Number.isInteger(value))
		return 0;
	return (value & 3) as NativeAspectMode;
}

/**
 * authored: original size pair before relative-size multiplication.
 * resolved: size after normal exact/relative resolution.
 * parent: containing rectangle dimensions.
 *
 * Either exact-size flag bypasses native aspect adjustment.
 */
export function ResolveNativeAspectSize(
	authored: Readonly<Size2D>,
	resolved: Readonly<Size2D>,
	parent: Readonly<Size2D>,
	mode: NativeAspectMode,
	exactWidth: boolean,
	exactHeight: boolean
): Size2D {
	const unchanged = { width: resolved.width, height: resolved.height };
	if (exactWidth || exactHeight || mode === 0)
		return unchanged;
	if (![authored.width, authored.height, resolved.width, resolved.height,
		parent.width, parent.height].every(Number.isFinite))
		return unchanged;

	if (mode === 1) {
		if (authored.height === 0)
			return unchanged;
		return { width: (authored.width / authored.height) * resolved.height, height: resolved.height };
	}
	if (authored.width === 0 || authored.height === 0 ||
		parent.width === 0 || parent.height === 0)
		return unchanged;

	const ratio = authored.width / authored.height;
	const availableRatio = parent.width / parent.height;
	if (mode === 2) {
		if (ratio < availableRatio)
			return { width: parent.height * ratio, height: parent.height };
		return { width: parent.width, height: parent.width / ratio };
	}
	if (availableRatio <= ratio)
		return { width: parent.height * ratio, height: parent.height };
	return { width: parent.width, height: parent.width / ratio };
}
