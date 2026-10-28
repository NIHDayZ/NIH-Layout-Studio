/**
 * Pure geometry contracts for the proposed Enfusion layout engine.
 *
 * These primitives are intentionally independent of React, DOM, widget
 * visuals, and native layout-manager policies. No claims of native
 * GridSpacer/WrapSpacer/ScrollWidget behavior are made here.
 */
export interface GeometryRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface LayoutConstraints {
	availableWidth: number;
	availableHeight: number;
	dpiScale: number;
}

export interface MeasuredWidget {
	minWidth: number;
	minHeight: number;
	preferredWidth: number;
	preferredHeight: number;
	dependsOnParentWidth: boolean;
	dependsOnParentHeight: boolean;
}

export interface ArrangedWidget {
	id: string;
	parentId: string | null;
	localRect: GeometryRect;
	absoluteRect: GeometryRect;
	clipRect: GeometryRect | null;
	visible: boolean;
	sortOrder: number;
}

/** Translate a child-local rectangle into its parent's absolute space. */
export function TranslateRect(rect: GeometryRect, parent: GeometryRect): GeometryRect {
	return {
		x: parent.x + rect.x,
		y: parent.y + rect.y,
		width: rect.width,
		height: rect.height
	};
}

/** Compute the common visible area of two axis-aligned rectangles. */
export function IntersectRects(a: GeometryRect, b: GeometryRect): GeometryRect {
	const left = Math.max(a.x, b.x);
	const top = Math.max(a.y, b.y);
	const right = Math.min(a.x + Math.max(0, a.width), b.x + Math.max(0, b.width));
	const bottom = Math.min(a.y + Math.max(0, a.height), b.y + Math.max(0, b.height));
	return {
		x: left,
		y: top,
		width: Math.max(0, right - left),
		height: Math.max(0, bottom - top)
	};
}

/**
 * Update effective clipping for a container.
 * Clipping is inherited; a child cannot expand an ancestor's clip.
 * If this widget does not clip children, pass the existing clip through.
 */
export function ResolveChildClip(
	inheritedClip: GeometryRect | null,
	containerAbsoluteRect: GeometryRect,
	clipChildren: boolean
): GeometryRect | null {
	if (!clipChildren)
		return inheritedClip;
	if (!inheritedClip)
		return { ...containerAbsoluteRect };
	return IntersectRects(inheritedClip, containerAbsoluteRect);
}
