/**
 * Native ImageWidget UV corner arrangement (WorkbenchApp.exe SHA-256
 * 8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85).
 *
 * Source: IWidgetRenderInterface::draw vtable slot18, VA 0x1408EA020.
 * Its textured-quad path applies two widget flag bits to the UV components.
 *
 * This is only the UV-ordering step. Property registration, draw mode,
 * clipping, color blending, and resource loading are not inferred here.
 */

/** Flat native source UV order: TL(u,v), TR(u,v), BR(u,v), BL(u,v). */
export type NativeImageUvCorners = readonly [number, number, number, number, number, number, number, number];

export interface NativeImageUvPoint {
	u: number;
	v: number;
}

/** Renderer's vertex order: TL, TR, BL, BR. */
export interface NativeImageUvQuad {
	topLeft: NativeImageUvPoint;
	topRight: NativeImageUvPoint;
	bottomLeft: NativeImageUvPoint;
	bottomRight: NativeImageUvPoint;
}

/** Native bits 26 and 27 in the ImageWidget common flag word at +0xA8. */
export function DecodeNativeImageUvFlips(widgetFlags: number): { horizontal: boolean; vertical: boolean } {
	return {
		horizontal: ((widgetFlags >>> 26) & 1) !== 0,
		vertical: ((widgetFlags >>> 27) & 1) !== 0
	};
}

/**
 * Mirrors the component-level permutation seen in the native textured
 * quad path; do not swap entire points because native flips U and V
 * independently even when the four supplied UVs are non-rectangular.
 */
export function ArrangeNativeImageUvQuad(
	corners: NativeImageUvCorners,
	horizontal: boolean,
	vertical: boolean
): NativeImageUvQuad {
	return {
		topLeft: {
			u: horizontal ? corners[2] : corners[0],
			v: vertical ? corners[7] : corners[1]
		},
		topRight: {
			u: horizontal ? corners[0] : corners[2],
			v: vertical ? corners[5] : corners[3]
		},
		bottomLeft: {
			u: horizontal ? corners[4] : corners[6],
			v: vertical ? corners[1] : corners[7]
		},
		bottomRight: {
			u: horizontal ? corners[6] : corners[4],
			v: vertical ? corners[3] : corners[5]
		}
	};
}

export function ArrangeNativeImageUvQuadFromFlags(
	corners: NativeImageUvCorners,
	widgetFlags: number
): NativeImageUvQuad {
	const flips = DecodeNativeImageUvFlips(widgetFlags);
	return ArrangeNativeImageUvQuad(corners, flips.horizontal, flips.vertical);
}
