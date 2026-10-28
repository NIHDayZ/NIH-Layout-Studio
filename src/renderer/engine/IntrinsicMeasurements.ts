import type { GeometryWidget } from "./WidgetGeometry.js";

/**
 * Intrinsic dimensions are evidence supplied by a resource-aware measurer.
 * This module NEVER estimates glyph metrics, DPI, font fallback, or aspect
 * ratios from the authored widget rectangle.
 */
export type IntrinsicEvidence = "imageset-logical" | "font-metrics" | "workbench-observation";
export type IntrinsicFamily = "image" | "text";

export interface IntrinsicMeasurement {
	/** Unit-independent dimensions at the layout's reference scale. */
	width?: number;
	height?: number;
	evidence: IntrinsicEvidence;
	/** Only independent axes may be consumed by the current bottom-up pass. */
	widthIndependent: boolean;
	heightIndependent: boolean;
}

export interface ResolvedIntrinsicMeasurement {
	family: IntrinsicFamily;
	measurement: IntrinsicMeasurement;
}

export interface IntrinsicMeasurementProviders {
	image?: (node: GeometryWidget) => IntrinsicMeasurement | null;
	text?: (node: GeometryWidget) => IntrinsicMeasurement | null;
}

/** Preserve only finite nonnegative independent axes from source metrics. */
export function NormalizeIntrinsicMeasurement(
	input: IntrinsicMeasurement | null | undefined
): IntrinsicMeasurement | null {
	if (!input)
		return null;
	const width = input.widthIndependent && typeof input.width === "number"
		&& Number.isFinite(input.width) && input.width >= 0 ? input.width : undefined;
	const height = input.heightIndependent && typeof input.height === "number"
		&& Number.isFinite(input.height) && input.height >= 0 ? input.height : undefined;
	if (width === undefined && height === undefined)
		return null;
	return {
		width,
		height,
		evidence: input.evidence,
		widthIndependent: width !== undefined,
		heightIndependent: height !== undefined
	};
}

/**
 * Match class names exactly. A TextWidget inside a button does NOT make
 * ButtonWidget a leaf text measurer; multiline/RichText are width-dependent
 * and intentionally excluded until native shaping/wrapping is recovered.
 */
export function ResolveIntrinsicMeasurement(
	node: GeometryWidget,
	providers: IntrinsicMeasurementProviders
): ResolvedIntrinsicMeasurement | null {
	const type = node.type.trim().toLowerCase();
	const family: IntrinsicFamily | null = type === "imagewidgetclass"
		? "image" : type === "textwidgetclass" ? "text" : null;
	if (!family)
		return null;
	const provider = providers[family];
	if (!provider)
		return null;
	const measurement = NormalizeIntrinsicMeasurement(provider(node));
	return measurement ? { family, measurement } : null;
}
