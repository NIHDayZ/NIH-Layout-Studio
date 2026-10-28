import type { GeometryWidget } from "./WidgetGeometry.js";

/**
 * Read-only, source-order-sensitive native loader compatibility evidence.
 *
 * The evidence is restricted to real DayZ client fixture observations:
 * tests/fixtures/workbench-content/capture.property-syntax.native.2026-10-28.json
 * and capture.property-matrix.native.2026-10-28.json.
 *
 * This is NOT a C++ property table, an all-widget allowlist, or a command to
 * remove children/attributes. Unobserved names and widget families stay
 * explicitly unverified.
 */
export type NativePropertyEvidence =
	| "observed-child-loss-before-block"
	| "observed-accepted-with-children"
	| "unverified";

export type NativePropertySourceOrder =
	| "before-all-children"
	| "after-all-children"
	| "mixed-or-unavailable"
	| "no-children";

export type NativeCompatibilityCode =
	| "observed-native-child-loss-risk"
	| "serialization-order-risk"
	| "observed-native-safe-after-children"
	| "mixed-native-property-order"
	| "unverified-native-property";

export interface NativeCompatibilityDiagnostic {
	readonly code: NativeCompatibilityCode;
	readonly severity: "warning" | "info";
	readonly id: string;
	readonly type: string;
	readonly widgetName: string;
	readonly propertyName: string;
	readonly propertyValue: string;
	readonly propertyLine: number | null;
	readonly sourceOrder: NativePropertySourceOrder;
	readonly evidence: NativePropertyEvidence;
	/** The read-only warning never asserts the exact internal parser branch. */
	readonly basis: "dayz-2026-10-28-property-syntax-probe" | "no-native-observation";
	readonly detail: string;
}

export interface NativeCompatibilityOptions {
	/** Default false: do not swamp real layouts with unverified-property notices. */
	readonly includeUnverified?: boolean;
}

interface SourceProperty {
	readonly name: string;
	readonly value: string;
	readonly line?: number;
}

interface SourceWidget {
	readonly id: string;
	readonly name: string;
	readonly type: string;
	readonly line?: number;
	readonly sourceGroupLine?: number;
	readonly properties: readonly SourceProperty[];
	readonly children: readonly SourceWidget[];
}

const DOCUMENTED_LOSS_PROPERTIES = new Map<string, ReadonlySet<string>>([
	["framewidgetclass", new Set([
		"size to content h", "size to content v", "size to text v", "nih_probeunknown"
	])],
	["panelwidgetclass", new Set([
		"size to content h", "size to content v", "nih_probeunknown"
	])]
]);

const DOCUMENTED_ACCEPTED_PROPERTIES = new Map<string, ReadonlySet<string>>([
	["framewidgetclass", new Set(["clipchildren"])],
	// The WrapSpacer V=0/1 pair loaded both children; enabled V=1 resized
	// height 20->28. This is accepted syntax evidence only, not a height rule.
	["wrapspacerwidgetclass", new Set(["size to content v"])]
]);

/** Exact class/name pairs only. A known property on another class is UNKNOWN. */
export function ClassifyNativePropertyEvidence(
	widgetType: string,
	propertyName: string
): NativePropertyEvidence {
	const type = widgetType.trim().toLowerCase();
	const name = propertyName.trim().toLowerCase();
	if (DOCUMENTED_LOSS_PROPERTIES.get(type)?.has(name))
		return "observed-child-loss-before-block";
	if (DOCUMENTED_ACCEPTED_PROPERTIES.get(type)?.has(name))
		return "observed-accepted-with-children";
	return "unverified";
}

/**
 * Studio's parsed node retains children and properties in separate arrays.
 * Original order can only be recovered when source line metadata is present.
 * Never infer order from the array order, and never guess using widget IDs.
 */
export function InspectNativePropertySourceOrder(
	property: Pick<SourceProperty, "line">,
	children: readonly Pick<SourceWidget, "line">[]
): NativePropertySourceOrder {
	if (children.length === 0)
		return "no-children";
	const line = property.line;
	if (line === undefined || !Number.isSafeInteger(line) || line <= 0)
		return "mixed-or-unavailable";
	let first = Infinity;
	let last = -Infinity;
	for (const child of children) {
		if (child.line === undefined || !Number.isSafeInteger(child.line) || child.line <= 0)
			return "mixed-or-unavailable";
		first = Math.min(first, child.line);
		last = Math.max(last, child.line);
	}
	if (line < first)
		return "before-all-children";
	if (line > last)
		return "after-all-children";
	return "mixed-or-unavailable";
}

/**
 * Canonical serialization now respects known child-group source lines.
 * A trailing property is observed safe in the tested fixture if all
 * direct child groups have source provenance. Without that provenance,
 * serialization may still fall back to properties first.
 * Neither inspection nor diagnostics mutate source or geometry.
 */
export function InspectNativePropertyCompatibility(
	roots: readonly GeometryWidget[],
	options: NativeCompatibilityOptions = {}
): readonly NativeCompatibilityDiagnostic[] {
	const result: NativeCompatibilityDiagnostic[] = [];

	function Visit(node: GeometryWidget): void {
		// GeometryWidget permits extra metadata supplied by LayoutParser.
		const source = node as SourceWidget;
		for (const property of source.properties) {
			const evidence = ClassifyNativePropertyEvidence(node.type, property.name);
			const sourceOrder = InspectNativePropertySourceOrder(property, source.children);
			const propertyLine = property.line ?? null;
			let code: NativeCompatibilityCode | null = null;
			let severity: "warning" | "info" = "info";
			let detail = "";
			if (evidence === "observed-child-loss-before-block" && source.children.length > 0) {
				if (sourceOrder === "before-all-children") {
					code = "observed-native-child-loss-risk";
					severity = "warning";
					detail = "In the tested DayZ client, this class/property pair before the child group left the parent present but children absent, including when the value was 0. The exact C++ parser cause is unknown.";
				} else if (sourceOrder === "after-all-children") {
					const allGroupsKnown = source.children.every((child) =>
						child.sourceGroupLine !== undefined &&
						Number.isSafeInteger(child.sourceGroupLine) &&
						child.sourceGroupLine > 0
					);
					if (allGroupsKnown) {
						code = "observed-native-safe-after-children";
						detail = "In the tested DayZ client, this property after the child group retained the children. Studio's canonical serializer now preserves recorded group order. This is an observed syntax result, not a C++ parser guarantee.";
					} else {
						code = "serialization-order-risk";
						severity = "warning";
						detail = "DayZ retained children with this property after the child group, but source group provenance is missing. Canonical serialization may reflow property order. Direct Save/Export preserves the current source.";
					}
				} else {
					code = "mixed-native-property-order";
					detail = "Native tests differ before versus after the child group, but source order here is mixed or unavailable. Do not predict child existence.";
				}
			} else if (evidence === "unverified" && options.includeUnverified) {
				code = "unverified-native-property";
				detail = "No matching class/property behavior is independently verified in the existing DayZ native property probes.";
			}
			if (code) {
				result.push({
					code,
					severity,
					id: node.id,
					type: node.type,
					widgetName: node.name,
					propertyName: property.name,
					propertyValue: property.value,
					propertyLine,
					sourceOrder,
					evidence,
					basis: evidence === "unverified" ? "no-native-observation" : "dayz-2026-10-28-property-syntax-probe",
					detail
				});
			}
		}
		for (const child of source.children)
			Visit(child as GeometryWidget);
	}

	for (const root of roots)
		Visit(root);
	return result;
}
