import type { GeometryWidget } from "./WidgetGeometry.js";
import type { IntrinsicMeasurement } from "./IntrinsicMeasurements.js";

/**
 * Pure adapter around an existing ProjectWorkspace image resolver.
 * Imageset entries expose logicalWidth/logicalHeight; a direct URL with
 * atlasWidth=atlasHeight=1 does NOT have known intrinsic dimensions.
 */
/** Structural subset of the existing ResolvedImageResource contract. */
export interface LogicalImageResource {
	logicalWidth?: number;
	logicalHeight?: number;
}

export type ImageResourceResolver = (
	reference: string
) => LogicalImageResource | null;

export function CreateImageIntrinsicProvider(
	resolve: ImageResourceResolver
): (node: GeometryWidget) => IntrinsicMeasurement | null {
	return (node) => {
		const values = new Map<string, string>();
		for (const property of node.properties) {
			const key = property.name.toLowerCase();
			if (!values.has(key))
				values.set(key, property.value);
		}
		// Keep the same preference ordering as the current Canvas renderer.
		for (const key of ["image0", "imagetexture"]) {
			const reference = values.get(key)?.trim();
			if (!reference || reference === '""')
				continue;
			const resource = resolve(reference);
			if (!resource)
				continue;
			const width = resource.logicalWidth;
			const height = resource.logicalHeight;
			if (typeof width !== "number" || !Number.isFinite(width) || width <= 0
				|| typeof height !== "number" || !Number.isFinite(height) || height <= 0)
				continue;
			return {
				width,
				height,
				evidence: "imageset-logical",
				widthIndependent: true,
				heightIndependent: true
			};
		}
		return null;
	};
}
