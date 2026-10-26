import type { LayoutNode } from "../model/LayoutTypes";
import { FindPropertyOwners, FindWidgetPropertySchema } from "../schema/WidgetSchema";

export interface PropertyDiagnosticEntry {
	name: string;
	widgetType: string;
	widgetName: string;
	line: number;
	count: number;
	owners?: string[];
}

export interface RenderDiagnosticSummary {
	widgetCounts: Map<string, number>;
	unknownWidgetCounts: Map<string, number>;
	approximateWidgetCounts: Map<string, number>;
	knownUnrenderedProperties: Map<string, PropertyDiagnosticEntry>;
	invalidProperties: Map<string, PropertyDiagnosticEntry>;
	unknownProperties: Map<string, PropertyDiagnosticEntry>;
}

const fullySupportedWidgets = new Set([
	"FrameWidgetClass",
	"PanelWidgetClass",
	"TextWidgetClass",
	"RichTextWidgetClass",
	"ButtonWidgetClass",
	"ImageWidgetClass",
	"EditBoxWidgetClass",
	"MultilineTextWidgetClass",
	"MultilineEditBoxWidgetClass",
	"PasswordEditBoxWidgetClass",
	"XComboBoxWidgetClass",
	"ComboBoxWidgetClass"
]);

// Core classes are based on Bohemia's scripts/1_core/proto/enwidgets.c.
// These are recognized so diagnostics can distinguish "known but approximate"
// from a genuinely unknown/custom widget class.
const approximateWidgets = new Set([
	"RenderTargetWidgetClass",
	"RTTextureWidgetClass",
	"ConsoleWidgetClass",
	"VideoWidgetClass",
	"EmbededWidgetClass",
	"CheckBoxWidgetClass",
	"WindowWidgetClass",
	"SimpleProgressBarWidgetClass",
	"ProgressBarWidgetClass",
	"SliderWidgetClass",
	"BaseListboxWidgetClass",
	"SimpleListboxWidgetClass",
	"TextListboxWidgetClass",
	"GenericListboxWidgetClass",
	"WorkspaceWidgetClass",
	"ScrollWidgetClass",
	"SpacerWidgetClass",
	"GridSpacerWidgetClass",
	"WrapSpacerWidgetClass",
	"CanvasWidgetClass",
	"MapWidgetClass",
	"ItemPreviewWidgetClass",
	"ContentWidgetClass",
	"UniversalListboxWidgetClass"
]);

// Properties that Layout Studio currently consumes when rendering or computing geometry.
// A property may be valid in the Workbench schema without being listed here; those are
// reported as "Known / not yet rendered" rather than "unknown".
const rendererModeledProperties = new Set([
	"visible", "ignorepointer", "color", "position", "size", "halign", "valign",
	"hexactpos", "vexactpos", "hexactsize", "vexactsize", "style", "priority",
	"clipchildren", "fixaspect", "text", "font", "exact text", "exact text size",
	"text halign", "text valign", "bold text", "shadow size", "shadow color",
	"shadow offset", "image0", "imagetexture", "pivot", "progress", "padding",
	"margin", "content_halign", "content_valign", "columns", "rows", "wrap",
	"current", "minimum", "maximum", "vertical", "flipped"
].map((value) => value.toLowerCase()));

function Increment(map: Map<string, number>, key: string) {
	map.set(key, (map.get(key) ?? 0) + 1);
}

function AddPropertyEntry(map: Map<string, PropertyDiagnosticEntry>, propertyName: string, node: LayoutNode, line: number, owners?: string[]) {
	const key = `${node.type.toLowerCase()}::${propertyName.toLowerCase()}`;
	const existing = map.get(key);
	if (existing) {
		existing.count += 1;
		return;
	}
	map.set(key, {
		name: propertyName,
		widgetType: node.type,
		widgetName: node.name,
		line,
		count: 1,
		owners
	});
}

export function BuildRenderDiagnostics(nodes: LayoutNode[]): RenderDiagnosticSummary {
	const result: RenderDiagnosticSummary = {
		widgetCounts: new Map(),
		unknownWidgetCounts: new Map(),
		approximateWidgetCounts: new Map(),
		knownUnrenderedProperties: new Map(),
		invalidProperties: new Map(),
		unknownProperties: new Map()
	};

	function Scan(node: LayoutNode) {
		if (node.type.endsWith("WidgetClass")) {
			Increment(result.widgetCounts, node.type);
			if (approximateWidgets.has(node.type))
				Increment(result.approximateWidgetCounts, node.type);
			else if (!fullySupportedWidgets.has(node.type))
				Increment(result.unknownWidgetCounts, node.type);
		}

		for (const property of node.properties) {
			const schema = FindWidgetPropertySchema(node.type, property.name);
			const normalized = property.name.toLowerCase();
			if (schema) {
				if (!rendererModeledProperties.has(normalized))
					AddPropertyEntry(result.knownUnrenderedProperties, property.name, node, property.line);
				continue;
			}

			const owners = FindPropertyOwners(property.name);
			if (owners.length > 0)
				AddPropertyEntry(result.invalidProperties, property.name, node, property.line, owners);
			else
				AddPropertyEntry(result.unknownProperties, property.name, node, property.line);
		}

		for (const child of node.children)
			Scan(child);
	}

	for (const node of nodes)
		Scan(node);

	return result;
}
