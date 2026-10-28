import type { GeometryRect } from "./GeometryCore.js";

/**
 * Scrollbar property names are present in the pinned WorkbenchApp.exe
 * reflection table. The native scroll measurement branch tests bytes at
 * +0x188 (horizontal), +0x189 (vertical) and +0x18C (vertical-left).
 *
 * This decoder is deliberately class-specific. Unknown authored values
 * cannot be interpreted as disabled scrollbars.
 */
export interface NativeScrollSettings {
	horizontal: boolean;
	vertical: boolean;
	verticalLeft: boolean;
}

export function DecodeNativeScrollSettings(
	properties: readonly { name: string; value: string }[]
): NativeScrollSettings | null {
	const values = new Map<string, string>();
	for (const property of properties) {
		const key = property.name.trim().toLowerCase();
		if (!values.has(key))
			values.set(key, property.value.trim());
	}
	function ReadBoolean(name: string): boolean | null {
		const raw = values.get(name);
		if (raw === undefined || raw === "0")
			return false;
		if (raw === "1")
			return true;
		return null;
	}
	const horizontal = ReadBoolean("scrollbar h");
	const vertical = ReadBoolean("scrollbar v");
	const verticalLeft = ReadBoolean("scrollbar v left");
	if (horizontal === null || vertical === null || verticalLeft === null)
		return null;
	return { horizontal, vertical, verticalLeft };
}

/**
 * Prototype of the *unscaled* ScrollWidget measurement branch.
 *
 * Native 0x1408E04F3 loads float constant 10.0 when the scale-dependent
 * flag is absent. +0x189 reserves width for a vertical scrollbar;
 * +0x188 reserves height for a horizontal scrollbar; +0x18C shifts
 * the child origin when a vertical bar is on the left.
 *
 * We do not know the correspondence between the native scale-mode flag and
 * the editor's DPI input. Restrict this result to an explicitly requested
 * unit-scale hypothesis, without claiming it is the actual Workbench DPI
 * branch. No scroll offset, child arrangement or clip is applied.
 */
export interface UnscaledScrollViewportCandidate {
	childViewport: GeometryRect;
	scrollbarThickness: 10;
	horizontalScrollbar: boolean;
	verticalScrollbar: boolean;
	verticalScrollbarLeft: boolean;
	evidence: "native-derived-unscaled-scroll-viewport";
	assumptions: "zero-offset-no-dpi-scaling";
}

export function EstimateUnscaledScrollViewport(
	container: Pick<GeometryRect, "width" | "height">,
	settings: NativeScrollSettings,
	unitScale: number
): UnscaledScrollViewportCandidate | null {
	if (unitScale !== 1 || !Number.isFinite(container.width)
		|| !Number.isFinite(container.height)
		|| container.width <= 0 || container.height <= 0)
		return null;
	const thickness = 10;
	const width = container.width - (settings.vertical ? thickness : 0);
	const height = container.height - (settings.horizontal ? thickness : 0);
	if (width <= 0 || height <= 0)
		return null;
	return {
		childViewport: {
			x: settings.vertical && settings.verticalLeft ? thickness : 0,
			y: 0,
			width,
			height
		},
		scrollbarThickness: 10,
		horizontalScrollbar: settings.horizontal,
		verticalScrollbar: settings.vertical,
		verticalScrollbarLeft: settings.vertical && settings.verticalLeft,
		evidence: "native-derived-unscaled-scroll-viewport",
		assumptions: "zero-offset-no-dpi-scaling"
	};
}
