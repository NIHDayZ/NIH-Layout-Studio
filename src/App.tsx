import { MakeCopiedWidgetNameFromNames } from "./model/WidgetCopyName";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { Canvas, type CanvasDebugOptions } from "./components/Canvas";
import { ProjectPanel } from "./components/ProjectPanel";
import { PropertyInspector, type FontResourceOption, type ImageSetResourceOption, type StyleResourceOption } from "./components/PropertyInspector";
import { ImageSetInspector } from "./components/ImageSetInspector";
import { RenderStatus } from "./components/RenderStatus";
import { NativeCompatibilityReview, NativeCompatibilityWarnings } from "./components/NativeCompatibilityWarnings";
import { InspectNativePropertyCompatibility } from "./renderer/engine/NativePropertyCompatibility";
import { WidgetTree } from "./components/WidgetTree";
import type { LayoutDocument, LayoutNode, LayoutProperty, LayoutProblem } from "./model/LayoutTypes";
import { RectToLayoutGeometry, ResolveRect, type Rect } from "./renderer/LayoutMath";
import { LayoutParser } from "./parser/LayoutParser";
import type { ProjectFile, ProjectWorkspaceModel } from "./project/ProjectTypes";
import { BuildProjectWorkspace, DisposeProjectWorkspace, ParseImageSetSource, ResolveImageSetAtlasUrl, ResolveProjectImage } from "./project/ProjectWorkspace";
import { EncodeImageToEdds, type EddsPixelFormat } from "./project/EddsEncoder";
import { BuildImageSet } from "./project/ImageSetBuilder";
import { WorkbenchWidgetTypes } from "./schema/WidgetSchema";
import { version as appVersion } from "../package.json";
import "./styles.css";


function FindNodeById(nodes: LayoutNode[], id: string | null | undefined): LayoutNode | null {
	if (!id)
		return null;
	for (const node of nodes) {
		if (node.id === id)
			return node;
		const child = FindNodeById(node.children, id);
		if (child)
			return child;
	}
	return null;
}

function FindParentArray(nodes: LayoutNode[], id: string): LayoutNode[] | null {
	if (nodes.some((node) => node.id === id))
		return nodes;
	for (const node of nodes) {
		const parent = FindParentArray(node.children, id);
		if (parent)
			return parent;
	}
	return null;
}


function FindParentNode(nodes: LayoutNode[], id: string, parent: LayoutNode | null = null): LayoutNode | null {
	for (const node of nodes) {
		if (node.id === id)
			return parent;
		const found = FindParentNode(node.children, id, node);
		if (found !== null)
			return found;
	}
	return null;
}

function CollectNodeNames(nodes: LayoutNode[], names = new Set<string>()): Set<string> {
	for (const node of nodes) {
		names.add(node.name);
		CollectNodeNames(node.children, names);
	}
	return names;
}

function MakeCopiedWidgetName(nodes: LayoutNode[], name: string): string {
	return MakeCopiedWidgetNameFromNames(CollectNodeNames(nodes), name);
}

function MakeUniqueNodeName(nodes: LayoutNode[], baseName: string): string {
	const names = CollectNodeNames(nodes);
	if (!names.has(baseName))
		return baseName;
	let suffix = 2;
	while (names.has(`${baseName}${suffix}`))
		++suffix;
	return `${baseName}${suffix}`;
}

interface NodeRectInfo {
	node: LayoutNode;
	parentNode: LayoutNode | null;
	parentRect: Rect;
	rect: Rect;
}

function FindNodeRectInfo(nodes: LayoutNode[], id: string, parentRect: Rect, parentNode: LayoutNode | null = null): NodeRectInfo | null {
	for (const node of nodes) {
		const rect = ResolveRect(node, parentRect);
		if (node.id === id)
			return { node, parentNode, parentRect, rect };
		const childParent = { x: 0, y: 0, width: Math.max(0, rect.width), height: Math.max(0, rect.height) };
		const found = FindNodeRectInfo(node.children, id, childParent, node);
		if (found)
			return found;
	}
	return null;
}

function RenameSourceBlockRoot(block: string[], type: string, oldName: string, newName: string): string[] {
	if (block.length === 0)
		return block;
	const copy = [...block];
	const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const escapedName = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	copy[0] = copy[0].replace(new RegExp(`^(\\s*${escapedType}\\s+)${escapedName}(\\s*\\{?.*)$`), `$1${newName}$2`);
	return copy;
}
function ContainsNode(node: LayoutNode, id: string): boolean {
	if (node.id === id)
		return true;
	return node.children.some((child) => ContainsNode(child, id));
}

function NormalizePropertyValue(rawValue: string): string {
	const trimmed = rawValue.trim();
	if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"'))
		return trimmed.slice(1, -1);
	return trimmed;
}


function FindNodePath(nodes: LayoutNode[], id: string, prefix: number[] = []): number[] | null {
	for (let i = 0; i < nodes.length; ++i) {
		const path = [...prefix, i];
		if (nodes[i].id === id)
			return path;
		const child = FindNodePath(nodes[i].children, id, path);
		if (child)
			return child;
	}
	return null;
}

function GetNodeAtPath(nodes: LayoutNode[], path: number[] | null): LayoutNode | null {
	if (!path)
		return null;
	let list = nodes;
	let node: LayoutNode | null = null;
	for (const index of path) {
		node = list[index] ?? null;
		if (!node)
			return null;
		list = node.children;
	}
	return node;
}

function CopyNodeIds(previous: LayoutNode[], next: LayoutNode[]) {
	const count = Math.min(previous.length, next.length);
	for (let i = 0; i < count; ++i) {
		next[i].id = previous[i].id;
		CopyNodeIds(previous[i].children, next[i].children);
	}
}

function SplitSourceLines(source: string) {
	const eol = source.includes("\r\n") ? "\r\n" : "\n";
	return { eol, lines: source.replace(/\r\n/g, "\n").split("\n") };
}

function PatchNodeProperties(source: string, node: LayoutNode, changes: Array<{ name: string; rawValue: string | null }>): string {
	const { eol, lines } = SplitSourceLines(source);
	interface PropertyPatchOperation {
		index: number;
		start: number;
		end: number;
		replacement: string;
		deleteProperty: boolean;
	}
	const operations: PropertyPatchOperation[] = [];
	const missing: Array<{ name: string; rawValue: string }> = [];

	for (const change of changes) {
		const property = node.properties.find((item) => item.name.toLowerCase() === change.name.toLowerCase());
		if (!property) {
			if (change.rawValue !== null)
				missing.push({ name: change.name, rawValue: change.rawValue });
			continue;
		}

		const index = property.line - 1;
		if (index < 0 || index >= lines.length)
			continue;

		if (property.startColumn !== undefined && property.endColumn !== undefined &&
			property.valueStartColumn !== undefined && property.valueEndColumn !== undefined) {
			if (change.rawValue === null) {
				operations.push({
					index,
					start: property.startColumn,
					end: property.endColumn,
					replacement: "",
					deleteProperty: true
				});
			} else {
				operations.push({
					index,
					start: property.valueStartColumn,
					end: property.valueEndColumn,
					replacement: change.rawValue,
					deleteProperty: false
				});
			}
			continue;
		}

		// Compatibility fallback for documents parsed before source-span support.
		const current = lines[index];
		const nameIndex = current.indexOf(property.rawName);
		if (nameIndex < 0)
			continue;
		if (change.rawValue === null) {
			operations.push({ index, start: nameIndex, end: current.length, replacement: "", deleteProperty: true });
		} else {
			const afterName = nameIndex + property.rawName.length;
			const whitespace = current.slice(afterName).match(/^\s+/)?.[0] ?? " ";
			operations.push({ index, start: afterName, end: current.length, replacement: `${whitespace}${change.rawValue}`, deleteProperty: false });
		}
	}

	const byLine = new Map<number, PropertyPatchOperation[]>();
	for (const operation of operations) {
		const list = byLine.get(operation.index) ?? [];
		list.push(operation);
		byLine.set(operation.index, list);
	}

	const lineIndexes = [...byLine.keys()].sort((a, b) => b - a);
	for (const index of lineIndexes) {
		let current = lines[index];
		const lineOperations = byLine.get(index)!.sort((a, b) => b.start - a.start);
		for (const operation of lineOperations) {
			if (!operation.deleteProperty) {
				current = current.slice(0, operation.start) + operation.replacement + current.slice(operation.end);
				continue;
			}

			const before = current.slice(0, operation.start);
			const after = current.slice(operation.end);
			if (!before.trim() && !after.trim()) {
				current = "";
				continue;
			}
			if (!before.trim()) {
				const indent = before.match(/^\s*/)?.[0] ?? "";
				current = indent + after.trimStart();
				continue;
			}
			if (!after.trim()) {
				current = before.trimEnd();
				continue;
			}
			current = before + after;
		}

		if (!current.trim())
			lines.splice(index, 1);
		else
			lines[index] = current;
	}

	if (missing.length > 0) {
		const declarationIndex = Math.max(0, node.line - 1);
		const declarationIndent = lines[declarationIndex]?.match(/^\s*/)?.[0] ?? "";
		const propertyIndent = `${declarationIndent}\t`;
		let insertIndex = declarationIndex + 1;
		const existingLines = node.properties.map((property) => property.line - 1).filter((index) => index >= declarationIndex);
		if (existingLines.length > 0)
			insertIndex = Math.max(...existingLines) + 1;
		const additions = missing.map(({ name, rawValue }) => `${propertyIndent}${/\s/.test(name) ? `"${name}"` : name} ${rawValue}`);
		lines.splice(insertIndex, 0, ...additions);
	}

	return lines.join(eol);
}

function PatchNodeName(source: string, node: LayoutNode, name: string): string {
	const { eol, lines } = SplitSourceLines(source);
	const index = node.line - 1;
	if (index < 0 || index >= lines.length)
		return source;
	const escapedType = node.type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const expression = new RegExp(`^(\\s*${escapedType}\\s+)${node.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s*\\{?.*)$`);
	lines[index] = lines[index].replace(expression, `$1${name}$2`);
	return lines.join(eol);
}
interface SourceLineRange {
	start: number;
	end: number;
}

function CountStructuralBraces(line: string): { open: number; close: number } {
	let open = 0;
	let close = 0;
	let quoted = false;
	let escaped = false;
	for (let i = 0; i < line.length; ++i) {
		const char = line[i];
		if (!quoted && char === "/" && line[i + 1] === "/")
			break;
		if (quoted) {
			if (escaped)
				escaped = false;
			else if (char === "\\")
				escaped = true;
			else if (char === '"')
				quoted = false;
			continue;
		}
		if (char === '"') {
			quoted = true;
			continue;
		}
		if (char === "{")
			++open;
		else if (char === "}")
			++close;
	}
	return { open, close };
}

function FindNodeLineRange(source: string, node: LayoutNode): SourceLineRange | null {
	const { lines } = SplitSourceLines(source);
	const start = node.line - 1;
	if (start < 0 || start >= lines.length)
		return null;
	let depth = 0;
	let opened = false;
	for (let i = start; i < lines.length; ++i) {
		const braces = CountStructuralBraces(lines[i]);
		if (braces.open > 0)
			opened = true;
		depth += braces.open - braces.close;
		if (opened && depth === 0)
			return { start, end: i };
	}
	return null;
}

function GetLineIndent(line: string): string {
	return line.match(/^\s*/)?.[0] ?? "";
}

function ReindentSourceBlock(lines: string[], targetIndent: string): string[] {
	const baseIndent = lines.find((line) => line.trim().length > 0)?.match(/^\s*/)?.[0] ?? "";
	return lines.map((line) => {
		if (!line.trim())
			return line;
		const body = line.startsWith(baseIndent) ? line.slice(baseIndent.length) : line.trimStart();
		return `${targetIndent}${body}`;
	});
}

function PatchDeleteNode(source: string, node: LayoutNode): string {
	const { eol, lines } = SplitSourceLines(source);
	const range = FindNodeLineRange(source, node);
	if (!range)
		return source;
	lines.splice(range.start, range.end - range.start + 1);
	return lines.join(eol);
}

function PatchDuplicateNode(source: string, node: LayoutNode, newName: string): string {
	const { eol, lines } = SplitSourceLines(source);
	const range = FindNodeLineRange(source, node);
	if (!range)
		return source;
	const block = lines.slice(range.start, range.end + 1);
	const escapedType = node.type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const escapedName = node.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	block[0] = block[0].replace(new RegExp(`^(\\s*${escapedType}\\s+)${escapedName}(\\s*\\{?.*)$`), `$1${newName}$2`);
	lines.splice(range.end + 1, 0, ...block);
	return lines.join(eol);
}

function FindNodeByTypeAndName(nodes: LayoutNode[], type: string, name: string): LayoutNode | null {
	for (const node of nodes) {
		if (node.type === type && node.name === name)
			return node;
		const child = FindNodeByTypeAndName(node.children, type, name);
		if (child)
			return child;
	}
	return null;
}

function InsertChildBlock(source: string, target: LayoutNode, blockLines: string[]): string {
	const { eol, lines } = SplitSourceLines(source);
	const targetRange = FindNodeLineRange(source, target);
	if (!targetRange)
		return source;
	const targetIndent = GetLineIndent(lines[targetRange.start] ?? "");
	const childIndent = `${targetIndent}\t\t`;
	const reindented = ReindentSourceBlock(blockLines, childIndent);
	if (target.children.length > 0) {
		const lastChild = target.children[target.children.length - 1];
		const childRange = FindNodeLineRange(source, lastChild);
		if (childRange) {
			lines.splice(childRange.end + 1, 0, ...reindented);
			return lines.join(eol);
		}
	}
	lines.splice(targetRange.end, 0, `${targetIndent}\t{`, ...reindented, `${targetIndent}\t}`);
	return lines.join(eol);
}

function PatchReparentNode(source: string, moving: LayoutNode, target: LayoutNode, parser: LayoutParser): string {
	const { lines } = SplitSourceLines(source);
	const movingRange = FindNodeLineRange(source, moving);
	if (!movingRange)
		return source;
	const block = lines.slice(movingRange.start, movingRange.end + 1);
	const removed = PatchDeleteNode(source, moving);
	const reparsed = parser.Parse(removed);
	const targetAfterRemoval = FindNodeByTypeAndName(reparsed.roots, target.type, target.name);
	if (!targetAfterRemoval)
		return source;
	return InsertChildBlock(removed, targetAfterRemoval, block);
}

function PatchSwapSiblingNodes(source: string, first: LayoutNode, second: LayoutNode): string {
	const { eol, lines } = SplitSourceLines(source);
	const firstRange = FindNodeLineRange(source, first);
	const secondRange = FindNodeLineRange(source, second);
	if (!firstRange || !secondRange)
		return source;
	let a = firstRange;
	let b = secondRange;
	if (a.start > b.start) {
		a = secondRange;
		b = firstRange;
	}
	return [
		...lines.slice(0, a.start),
		...lines.slice(b.start, b.end + 1),
		...lines.slice(a.end + 1, b.start),
		...lines.slice(a.start, a.end + 1),
		...lines.slice(b.end + 1)
	].join(eol);
}
function UpsertProperty(node: LayoutNode, name: string, rawValue: string) {
	const existing = node.properties.find((property) => property.name.toLowerCase() === name.toLowerCase());
	if (existing) {
		existing.rawValue = rawValue;
		existing.value = NormalizePropertyValue(rawValue);
		return;
	}
	const rawName = /\s/.test(name) ? `"${name}"` : name;
	const property: LayoutProperty = { name, rawName, rawValue, value: NormalizePropertyValue(rawValue), line: node.line };
	node.properties.push(property);
}

let s_EditorNodeId = 1;
function RefreshNodeIds(node: LayoutNode) {
	node.id = `editor-${Date.now()}-${s_EditorNodeId++}`;
	for (const child of node.children)
		RefreshNodeIds(child);
}

const sampleLayout = `FrameWidgetClass SampleRoot {
 position 0 0
 size 1 1
 hexactpos 0
 vexactpos 0
 hexactsize 0
 vexactsize 0
 {
  PanelWidgetClass ExamplePanel {
   position 0 0
   size 560 260
   halign center_ref
   valign center_ref
   hexactpos 0
   vexactpos 0
   hexactsize 1
   vexactsize 1
   color 0.04 0.05 0.07 0.95
   style rover_sim_colorable
   {
    TextWidgetClass ExampleTitle {
     position 24 24
     size 512 36
     hexactpos 1
     vexactpos 1
     hexactsize 1
     vexactsize 1
     text "Sample Interface"
     "exact text size" 24
     color 0.92 0.95 1 1
     "text halign" center
    }
    TextWidgetClass ExampleDescription {
     position 40 84
     size 480 54
     hexactpos 1
     vexactpos 1
     hexactsize 1
     vexactsize 1
     text "Open a layout or project to begin editing."
     "exact text size" 18
     color 0.72 0.78 0.86 1
     "text halign" center
    }
    PanelWidgetClass ExampleContent {
     position 40 164
     size 480 56
     hexactpos 1
     vexactpos 1
     hexactsize 1
     vexactsize 1
     color 0.1 0.12 0.16 0.8
     style rover_sim_colorable
     {
      TextWidgetClass ExampleContentLabel {
       position 12 12
       size 456 32
       hexactpos 1
       vexactpos 1
       hexactsize 1
       vexactsize 1
       text "Select a widget to inspect its properties."
       "exact text size" 16
       color 0.82 0.87 0.94 1
       "text halign" center
      }
     }
    }
   }
  }
 }
}`;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.5;
const DEFAULT_ZOOM = 0.5;
const DEFAULT_LEFT_WIDTH = 270;
const DEFAULT_RIGHT_WIDTH = 330;
const DEFAULT_PROJECT_HEIGHT = 320;
const DEFAULT_SOURCE_HEIGHT = 300;


function CloseToolbarMenus() {
	window.document.querySelectorAll<HTMLDetailsElement>("details.toolbar-menu[open]").forEach((menu) => { menu.open = false; });
}

const resolutions = [
	{ label: "1920 × 1080", width: 1920, height: 1080 },
	{ label: "2560 × 1440", width: 2560, height: 1440 },
	{ label: "3440 × 1440", width: 3440, height: 1440 },
	{ label: "1280 × 720", width: 1280, height: 720 }
];


function StripFontExtension(path: string) {
	return path.replace(/\.(fnt|ttf|otf|woff2?)$/i, "");
}

function BuildWorkspaceFontOptions(workspace: ProjectWorkspaceModel | null, source: "project" | "dependency" | "vanilla", sourceLabel?: string): FontResourceOption[] {
	if (!workspace)
		return [];
	const options = new Map<string, FontResourceOption>();
	const prefix = source === "vanilla" ? "gui" : workspace.name;
	const rootName = workspace.name.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

	function NormalizeRelative(path: string) {
		let relative = StripFontExtension(path).replace(/\\/g, "/").replace(/^\/+/, "");
		if (rootName && relative.toLowerCase().startsWith(`${rootName.toLowerCase()}/`))
			relative = relative.slice(rootName.length + 1);
		if (source === "vanilla" && relative.toLowerCase().startsWith("gui/"))
			relative = relative.slice(4);
		return relative;
	}

	function AddOption(relativePath: string, display: string) {
		const relative = NormalizeRelative(relativePath);
		const value = `${prefix}/${relative}`.replace(/\/{2,}/g, "/");
		const basename = relative.split("/").pop() ?? relative;
		const aliases = [relative, basename, value];
		if (source === "vanilla")
			aliases.push(`gui/${relative}`);
		else {
			aliases.push(`${rootName}/${relative}`);
			// DayZ layouts occasionally reference a project font without the mod-root prefix.
			aliases.push(relative.replace(/^gui\//i, ""));
		}
		options.set(value.toLowerCase(), {
			value,
			label: `${display} — ${source === "project" ? "Project" : source === "dependency" ? (sourceLabel ?? workspace!.name) : "Vanilla"}`,
			source,
			sourceLabel,
			aliases: [...new Set(aliases)]
		});
	}

	for (const font of new Set(workspace.bitmapFonts.values())) {
		const relative = NormalizeRelative(font.path);
		const filename = relative.split("/").pop() ?? relative;
		const name = font.name || filename;
		const display = `${name} — ${font.nominalSize}px (${filename})`;
		AddOption(font.path, display);
	}

	// Distinguish SDF variants by their actual resource basename and nominal
	// size; never change the serialized resource reference in the layout.
	for (const [path, font] of workspace.sdfFonts) {
		if (!path.includes("/"))
			continue;
		const relative = NormalizeRelative(path);
		const filename = relative.split("/").pop() ?? relative;
		const display = `${filename} — ${font.metadata.fontSize}px (SDF)`;
		AddOption(path, display);
	}

	for (const file of workspace.files) {
		if (![".ttf", ".otf", ".woff", ".woff2"].includes(file.extension))
			continue;
		const relativeNoExt = NormalizeRelative(file.path);
		const normalized = StripFontExtension(file.path).replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
		const normalizedRelative = relativeNoExt.toLowerCase();
		if (!workspace.fontFamilies.has(normalized) && !workspace.fontFamilies.has(normalizedRelative) && !workspace.fontFamilies.has(file.name.replace(/\.(ttf|otf|woff2?)$/i, "").toLowerCase()))
			continue;
		const display = file.name.replace(/\.(ttf|otf|woff2?)$/i, "");
		AddOption(file.path, display);
	}

	return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function BuildWorkspaceStyleOptions(workspace: ProjectWorkspaceModel | null, source: "project" | "dependency" | "vanilla", sourceLabel?: string): StyleResourceOption[] {
	if (!workspace)
		return [];
	const result: StyleResourceOption[] = [];
	for (const styles of workspace.widgetStyles.values())
		for (const style of styles)
			result.push({ name: style.name, widgetType: style.widgetType, source, sourceLabel });
	return result.sort((a, b) => a.widgetType.localeCompare(b.widgetType) || a.name.localeCompare(b.name));
}

function BuildWorkspaceImageSetOptions(workspace: ProjectWorkspaceModel | null, source: "project" | "dependency" | "vanilla", sourceLabel?: string): ImageSetResourceOption[] {
	if (!workspace)
		return [];
	const uniqueSets = [...new Set(workspace.imageSets.values())];
	return uniqueSets.map((set) => ({
		setName: set.name,
		source,
		sourceLabel,
		images: [...set.images.values()]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((image) => ({
				name: image.name,
				preview: ResolveProjectImage(workspace, `set:${set.name} image:${image.name}`) ?? undefined
			}))
	})).sort((a, b) => a.setName.localeCompare(b.setName));
}

export default function App() {
	const parser = useMemo(() => new LayoutParser(), []);
	const sourceAccessSupported = typeof window !== "undefined" && "showDirectoryPicker" in window && "showOpenFilePicker" in window;
	const [source, setSource] = useState("");
	const [sourceTab, setSourceTab] = useState<"source" | "problems">("source");
	const [pendingLayoutOutput, setPendingLayoutOutput] = useState<{ action: "save" | "download"; sourceSnapshot: string } | null>(null);
	const [document, setDocument] = useState<LayoutDocument>(() => parser.Parse(""));
	const [selected, setSelected] = useState<LayoutNode | null>(null);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [copiedWidget, setCopiedWidget] = useState<{ type: string; name: string; block: string[] } | null>(null);
	const [resolutionIndex, setResolutionIndex] = useState(0);
	const [zoom, setZoom] = useState(DEFAULT_ZOOM);
	const [parseError, setParseError] = useState<string | null>(null);
	const [debug, setDebug] = useState<CanvasDebugOptions>({ showBounds: false, showNames: false, showAnchors: false });
	const [fileName, setFileName] = useState("Untitled.layout");
	const [activeProjectPath, setActiveProjectPath] = useState<string | null>(null);
	const [project, setProject] = useState<ProjectWorkspaceModel | null>(null);
	const [dependencyProjects, setDependencyProjects] = useState<ProjectWorkspaceModel[]>([]);
	const [vanillaProject, setVanillaProject] = useState<ProjectWorkspaceModel | null>(null);
	const fontOptions = useMemo(() => {
		const result = BuildWorkspaceFontOptions(project, "project");
		const seen = new Set(result.map((option) => option.value.toLowerCase()));
		for (const dependency of dependencyProjects) {
			for (const option of BuildWorkspaceFontOptions(dependency, "dependency", dependency.name)) {
				if (!seen.has(option.value.toLowerCase())) {
					result.push(option);
					seen.add(option.value.toLowerCase());
				}
			}
		}
		for (const option of BuildWorkspaceFontOptions(vanillaProject, "vanilla")) {
			if (!seen.has(option.value.toLowerCase())) {
				result.push(option);
				seen.add(option.value.toLowerCase());
			}
		}
		return result;
	}, [project, dependencyProjects, vanillaProject]);
	const imageSetOptions = useMemo(() => {
		const result = BuildWorkspaceImageSetOptions(project, "project");
		const seen = new Set(result.map((option) => option.setName.toLowerCase()));
		for (const dependency of dependencyProjects) {
			for (const option of BuildWorkspaceImageSetOptions(dependency, "dependency", dependency.name)) {
				if (!seen.has(option.setName.toLowerCase())) {
					result.push(option);
					seen.add(option.setName.toLowerCase());
				}
			}
		}
		for (const option of BuildWorkspaceImageSetOptions(vanillaProject, "vanilla")) {
			if (!seen.has(option.setName.toLowerCase())) {
				result.push(option);
				seen.add(option.setName.toLowerCase());
			}
		}
		return result;
	}, [project, dependencyProjects, vanillaProject]);
	const styleOptions = useMemo(() => {
		const result = BuildWorkspaceStyleOptions(project, "project");
		const seen = new Set(result.map((option) => `${option.widgetType.toLowerCase()}::${option.name.toLowerCase()}`));
		for (const dependency of dependencyProjects) {
			for (const option of BuildWorkspaceStyleOptions(dependency, "dependency", dependency.name)) {
				const key = `${option.widgetType.toLowerCase()}::${option.name.toLowerCase()}`;
				if (!seen.has(key)) { result.push(option); seen.add(key); }
			}
		}
		for (const option of BuildWorkspaceStyleOptions(vanillaProject, "vanilla")) {
			const key = `${option.widgetType.toLowerCase()}::${option.name.toLowerCase()}`;
			if (!seen.has(key)) { result.push(option); seen.add(key); }
		}
		return result;
	}, [project, dependencyProjects, vanillaProject]);
	const [dependencyLoading, setDependencyLoading] = useState(false);
	const [textureToolOpen, setTextureToolOpen] = useState(false);
	const [textureToolFile, setTextureToolFile] = useState<File | null>(null);
	const [textureToolProjectPath, setTextureToolProjectPath] = useState<string | null>(null);
	const [textureToolMipmaps, setTextureToolMipmaps] = useState(false);
	const [textureToolFormat, setTextureToolFormat] = useState<EddsPixelFormat>("bgra8");
	const [imageSetToolOpen, setImageSetToolOpen] = useState(false);
	const [imageSetFiles, setImageSetFiles] = useState<File[]>([]);
	const [imageSetFlags, setImageSetFlags] = useState<Record<string, number>>({});
	const [imageSetName, setImageSetName] = useState("UIAtlas");
	const [imageSetOutputFolder, setImageSetOutputFolder] = useState("GUI/Imagesets");
	const [imageSetPadding, setImageSetPadding] = useState(2);
	const [imageSetMipmaps, setImageSetMipmaps] = useState(false);
	const [imageSetFormat, setImageSetFormat] = useState<EddsPixelFormat>("bgra8");
	const [imageSetBusy, setImageSetBusy] = useState(false);
	const [imageSetStatus, setImageSetStatus] = useState<string | null>(null);
	const [imageSetInspector, setImageSetInspector] = useState<{ file: ProjectFile; source: string; definition: NonNullable<ReturnType<typeof ParseImageSetSource>>; atlasUrl: string | null } | null>(null);
	const [textureToolBusy, setTextureToolBusy] = useState(false);
	const [textureToolStatus, setTextureToolStatus] = useState<string | null>(null);
	const [vanillaLoading, setVanillaLoading] = useState(false);
	const [snapEnabled, setSnapEnabled] = useState(true);
	const [showGrid, setShowGrid] = useState(false);
	const [snapSize, setSnapSize] = useState(5);
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
	const [projectLoading, setProjectLoading] = useState(false);
	const [textureProgress, setTextureProgress] = useState<{ project: { completed: number; total: number } | null; dependency: { completed: number; total: number } | null; vanilla: { completed: number; total: number } | null }>({ project: null, dependency: null, vanilla: null });
	function TrackTextures(kind: "project" | "dependency" | "vanilla") {
		return (progress: { completed: number; total: number }) => setTextureProgress((previous) => ({ ...previous, [kind]: progress }));
	}
	const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
	const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
	const [projectHeight, setProjectHeight] = useState(DEFAULT_PROJECT_HEIGHT);
	const [sourceHeight, setSourceHeight] = useState(DEFAULT_SOURCE_HEIGHT);
	const [undoStack, setUndoStack] = useState<LayoutDocument[]>([]);
	const [redoStack, setRedoStack] = useState<LayoutDocument[]>([]);
	const [sourcePreserving, setSourcePreserving] = useState(true);
	const [dirty, setDirty] = useState(false);
	const [localSourceMode, setLocalSourceMode] = useState(false);
	const [workspaceStarted, setWorkspaceStarted] = useState(false);
	const savedSourceRef = useRef("");
	const currentFileHandleRef = useRef<any>(null);
	const projectFileHandlesRef = useRef<Map<string, any>>(new Map());
	const projectDirectoryHandleRef = useRef<any>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const folderRef = useRef<HTMLInputElement>(null);
	const vanillaFolderRef = useRef<HTMLInputElement>(null);
	const dependencyFolderRef = useRef<HTMLInputElement>(null);
	const dependencyProjectsRef = useRef<ProjectWorkspaceModel[]>([]);
	const previewRef = useRef<HTMLDivElement>(null);
	const resolution = resolutions[resolutionIndex];

	// Inspect the current SOURCE text, not the potentially stale Canvas document.
	// Missing/unsupported native property evidence never mutates the layout.
	const nativeCompatibilityWarnings = useMemo(() => {
		try {
			return InspectNativePropertyCompatibility(parser.Parse(source).roots)
				.filter((finding) => finding.severity === "warning");
		} catch {
			return [];
		}
	}, [source, parser]);

	useEffect(() => () => DisposeProjectWorkspace(project), [project]);
	useEffect(() => () => DisposeProjectWorkspace(vanillaProject), [vanillaProject]);
	useEffect(() => { dependencyProjectsRef.current = dependencyProjects; }, [dependencyProjects]);
	useEffect(() => () => { for (const dependency of dependencyProjectsRef.current) DisposeProjectWorkspace(dependency); }, []);

	useEffect(() => {
		function DismissContextMenu() { setContextMenu(null); }
		window.addEventListener("pointerdown", DismissContextMenu);
		return () => window.removeEventListener("pointerdown", DismissContextMenu);
	}, []);

	useEffect(() => {
		function OnKeyDown(event: KeyboardEvent) {
			if (pendingLayoutOutput)
				return;
			const target = event.target as HTMLElement | null;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"))
				return;
			if (event.ctrlKey && event.key.toLowerCase() === "s") { event.preventDefault(); RequestLayoutOutput("save"); }
			else if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); Undo(); }
			else if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); Redo(); }
			else if (event.ctrlKey && event.key.toLowerCase() === "c" && selected) { event.preventDefault(); CopySelected(); }
			else if (event.ctrlKey && event.key.toLowerCase() === "v" && selected && copiedWidget) { event.preventDefault(); PasteWidgetAsSibling(); }
			else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selected) {
				event.preventDefault();
				const step = event.shiftKey ? 10 : 1;
				NudgeSelected(event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0);
			}
			else if (event.key === "Delete" && selected) { event.preventDefault(); DeleteSelected(); }
		}
		window.addEventListener("keydown", OnKeyDown);
		return () => window.removeEventListener("keydown", OnKeyDown);
	}, [undoStack, redoStack, selected, selectedIds, document, source, dirty, localSourceMode, copiedWidget, pendingLayoutOutput, nativeCompatibilityWarnings]);

	function ParseSource(nextSource = source) {
		try {
			const parsed = parser.Parse(nextSource);
			setDocument(parsed);
			setSelected(null);
			setSelectedIds([]);
			setUndoStack([]);
			setRedoStack([]);
			setSourcePreserving((current) => current);
			setParseError(null);
		} catch (error) {
			setParseError(error instanceof Error ? error.message : String(error));
		}
	}

	async function RefreshSource() {
		const handle = currentFileHandleRef.current;
		if (!handle) {
			ParseSource();
			return;
		}
		try {
			const file = await handle.getFile();
			const text = await file.text();
			setFileName(file.name);
			setSource(text);
			savedSourceRef.current = text;
			setDirty(false);
			setSourcePreserving(true);
			ParseSource(text);
		} catch (error) {
			setParseError(error instanceof Error ? error.message : String(error));
		}
	}

	async function OpenFile(file: File, projectPath: string | null = null, fileHandle: any = null) {
		const text = await file.text();
		setWorkspaceStarted(true);
		setFileName(file.name);
		setActiveProjectPath(projectPath);
		setSource(text);
		savedSourceRef.current = text;
		setDirty(false);
		setSourcePreserving(true);
		currentFileHandleRef.current = fileHandle;
		setLocalSourceMode(!!fileHandle);
		ParseSource(text);
	}

	async function OpenProjectFiles(files: File[]) {
		if (files.length === 0)
			return;
		projectFileHandlesRef.current = new Map();
		projectDirectoryHandleRef.current = null;
		currentFileHandleRef.current = null;
		setLocalSourceMode(false);
		setTextureProgress((previous) => ({ ...previous, project: null }));
			setProjectLoading(true);
		try {
			const nextProject = await BuildProjectWorkspace(files, TrackTextures("project"));
			setProject(nextProject);
			setWorkspaceStarted(true);
			const firstLayout = nextProject.files.find((file) => file.extension === ".layout");
			if (firstLayout)
				await OpenFile(firstLayout.file, firstLayout.path);
		} finally {
			setProjectLoading(false);
			if (folderRef.current)
				folderRef.current.value = "";
		}
	}

	async function OpenVanillaFiles(files: File[]) {
		if (files.length === 0)
			return;
		setTextureProgress((previous) => ({ ...previous, vanilla: null }));
			setVanillaLoading(true);
		try {
			const nextVanilla = await BuildProjectWorkspace(files, TrackTextures("vanilla"));
			setVanillaProject(nextVanilla);
			setParseError(null);
		} catch (error) {
			setParseError(error instanceof Error ? error.message : String(error));
		} finally {
			setVanillaLoading(false);
			if (vanillaFolderRef.current)
				vanillaFolderRef.current.value = "";
		}
	}


	async function OpenDependencyFiles(files: File[]) {
		if (files.length === 0)
			return;
		setTextureProgress((previous) => ({ ...previous, dependency: null }));
			setDependencyLoading(true);
		try {
			const nextDependency = await BuildProjectWorkspace(files, TrackTextures("dependency"));
			setDependencyProjects((current) => [...current, nextDependency]);
			setParseError(null);
		} catch (error) {
			setParseError(error instanceof Error ? error.message : String(error));
		} finally {
			setDependencyLoading(false);
			if (dependencyFolderRef.current)
				dependencyFolderRef.current.value = "";
		}
	}

	function RemoveDependencyProject(index: number) {
		setDependencyProjects((current) => {
			const dependency = current[index];
			if (dependency)
				DisposeProjectWorkspace(dependency);
			return current.filter((_, itemIndex) => itemIndex !== index);
		});
	}

	function UnloadDependencyProjects() {
		for (const dependency of dependencyProjects)
			DisposeProjectWorkspace(dependency);
		setDependencyProjects([]);
	}

	async function OpenProjectFile(file: ProjectFile) {
		if (file.extension === ".imageset") {
			try {
				const handle = projectFileHandlesRef.current.get(file.path.toLowerCase()) ?? null;
				const freshFile = handle ? await handle.getFile() : file.file;
				const source = await freshFile.text();
				const definition = ParseImageSetSource(file.path, source);
				if (!definition)
					throw new Error(`Could not parse ${file.path}`);
				setImageSetInspector({ file, source, definition, atlasUrl: ResolveImageSetAtlasUrl(project, definition) });
			} catch (error) {
				setParseError(error instanceof Error ? error.message : String(error));
			}
			return;
		}
		if (file.extension !== ".layout")
			return;
		const handle = projectFileHandlesRef.current.get(file.path.toLowerCase()) ?? null;
		if (handle) {
			try {
				const freshFile = await handle.getFile();
				await OpenFile(freshFile, file.path, handle);
				return;
			} catch (error) {
				setParseError(error instanceof Error ? error.message : String(error));
			}
		}
		await OpenFile(file.file, file.path, null);
	}

	function ApplyEditedDocument(nextDocument: LayoutDocument, selectedId = selected?.id ?? null) {
		const serialized = parser.Serialize(nextDocument);
		setSourcePreserving(false);
		nextDocument.source = serialized;
		setDocument(nextDocument);
		setSource(serialized);
		setDirty(serialized !== savedSourceRef.current);
		const nextSelected = FindNodeById(nextDocument.roots, selectedId);
		setSelected(nextSelected);
		setSelectedIds(nextSelected ? [nextSelected.id] : []);
		setParseError(null);
	}

	function CommitSourceAwareEdit(node: LayoutNode, nextSource: string) {
		const previous = structuredClone(document);
		const path = FindNodePath(document.roots, node.id);
		try {
			const parsed = parser.Parse(nextSource);
			CopyNodeIds(document.roots, parsed.roots);
			parsed.source = nextSource;
			setUndoStack((items) => [...items.slice(-99), previous]);
			setRedoStack([]);
			setDocument(parsed);
			setSource(nextSource);
			setDirty(nextSource !== savedSourceRef.current);
			const nextSelected = GetNodeAtPath(parsed.roots, path);
			setSelected(nextSelected);
			setSelectedIds(nextSelected ? [nextSelected.id] : []);
			setParseError(null);
		} catch (error) {
			setParseError(error instanceof Error ? error.message : String(error));
		}
	}

	function CommitStructuralEdit(nextSource: string, selectType: string | null = null, selectName: string | null = null) {
		const previous = structuredClone(document);
		try {
			const parsed = parser.Parse(nextSource);
			parsed.source = nextSource;
			setUndoStack((items) => [...items.slice(-99), previous]);
			setRedoStack([]);
			setDocument(parsed);
			setSource(nextSource);
			setDirty(nextSource !== savedSourceRef.current);
			const nextSelected = selectType && selectName ? FindNodeByTypeAndName(parsed.roots, selectType, selectName) : null;
			setSelected(nextSelected);
			setSelectedIds(nextSelected ? [nextSelected.id] : []);
			setWorkspaceStarted(true);
			setParseError(null);
		} catch (error) {
			setParseError(error instanceof Error ? error.message : String(error));
		}
	}

	function CommitEdit(mutator: (nextDocument: LayoutDocument) => void, selectedId = selected?.id ?? null) {
		const previous = structuredClone(document);
		const nextDocument = structuredClone(document);
		mutator(nextDocument);
		setUndoStack((items) => [...items.slice(-99), previous]);
		setRedoStack([]);
		ApplyEditedDocument(nextDocument, selectedId);
	}

	function ApplyHistoryDocument(historyDocument: LayoutDocument) {
		const restored = structuredClone(historyDocument);
		const restoredSource = restored.source || parser.Serialize(restored);
		restored.source = restoredSource;
		setDocument(restored);
		setSource(restoredSource);
		setDirty(restoredSource !== savedSourceRef.current);
		setSelected(null);
		setSelectedIds([]);
		setSourcePreserving(restoredSource !== parser.Serialize(restored));
		setParseError(null);
	}

	function Undo() {
		if (undoStack.length === 0)
			return;
		const previous = undoStack[undoStack.length - 1];
		setUndoStack((items) => items.slice(0, -1));
		setRedoStack((items) => [...items, structuredClone(document)]);
		ApplyHistoryDocument(previous);
	}

	function Redo() {
		if (redoStack.length === 0)
			return;
		const next = redoStack[redoStack.length - 1];
		setRedoStack((items) => items.slice(0, -1));
		setUndoStack((items) => [...items, structuredClone(document)]);
		ApplyHistoryDocument(next);
	}

	function UpdateProperty(node: LayoutNode, propertyName: string, rawValue: string) {
		CommitSourceAwareEdit(node, PatchNodeProperties(source, node, [{ name: propertyName, rawValue }]));
	}

	function DeleteProperty(node: LayoutNode, propertyName: string) {
		CommitSourceAwareEdit(node, PatchNodeProperties(source, node, [{ name: propertyName, rawValue: null }]));
	}

	function RenameNode(node: LayoutNode, name: string) {
		const trimmed = name.trim();
		if (!trimmed || trimmed === node.name)
			return;
		CommitSourceAwareEdit(node, PatchNodeName(source, node, trimmed));
	}

	const layoutProblems = useMemo<LayoutProblem[]>(() => {
		try { return parser.AnalyzeFormatting(source); }
		catch { return [{ type: "parse", severity: "error", line: 1, message: "Layout could not be analyzed." }]; }
	}, [source, parser]);

	function NormalizeProblem(problem: LayoutProblem) {
		if (!problem.canNormalize) return;
		const nextSource = parser.NormalizePropertyLine(source, problem.line);
		if (nextSource !== source) CommitStructuralEdit(nextSource);
	}

	function NormalizeAllFormatting() {
		const nextSource = parser.NormalizeFormatting(source);
		if (nextSource !== source) CommitStructuralEdit(nextSource);
	}

	function ChangeGeometry(node: LayoutNode, parent: Rect, rect: Rect) {
		const geometry = RectToLayoutGeometry(node, parent, rect);
		CommitSourceAwareEdit(node, PatchNodeProperties(source, node, [
			{ name: "position", rawValue: geometry.position },
			{ name: "size", rawValue: geometry.size }
		]));
	}

	function SelectNode(node: LayoutNode, additive = false) {
		setSelected(node);
		setSelectedIds((current) => {
			if (!additive)
				return [node.id];
			return current.includes(node.id) ? current : [...current, node.id];
		});
	}

	function CopySelected(node = selected) {
		if (!node)
			return;
		const range = FindNodeLineRange(source, node);
		if (!range)
			return;
		const { lines } = SplitSourceLines(source);
		setCopiedWidget({ type: node.type, name: node.name, block: lines.slice(range.start, range.end + 1) });
	}

	function PasteWidgetAsSibling() {
		if (!copiedWidget || !selected)
			return;
		const name = MakeCopiedWidgetName(document.roots, copiedWidget.name);
		const block = RenameSourceBlockRoot(copiedWidget.block, copiedWidget.type, copiedWidget.name, name);
		const { eol, lines } = SplitSourceLines(source);
		const range = FindNodeLineRange(source, selected);
		if (!range)
			return;
		const targetIndent = GetLineIndent(lines[range.start] ?? "");
		const reindented = ReindentSourceBlock(block, targetIndent);
		lines.splice(range.end + 1, 0, ...reindented);
		CommitStructuralEdit(lines.join(eol), copiedWidget.type, name);
	}

	function PasteWidgetAsChild(target = selected) {
		if (!copiedWidget || !target)
			return;
		const name = MakeCopiedWidgetName(document.roots, copiedWidget.name);
		const block = RenameSourceBlockRoot(copiedWidget.block, copiedWidget.type, copiedWidget.name, name);
		CommitStructuralEdit(InsertChildBlock(source, target, block), copiedWidget.type, name);
	}

	type WidgetTemplate = { label: string; type: string; baseName: string; properties: string[] };

	const commonWidgetTemplates: WidgetTemplate[] = [
		{ label: "Panel", type: "PanelWidgetClass", baseName: "Panel", properties: ["position 0 0", "size 200 100", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1", "color 0.15 0.15 0.15 1", "style rover_sim_colorable"] },
		{ label: "Frame", type: "FrameWidgetClass", baseName: "Frame", properties: ["position 0 0", "size 200 100", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Text", type: "TextWidgetClass", baseName: "Text", properties: ["position 0 0", "size 160 28", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1", "text \"Text\""] },
		{ label: "Multiline Text", type: "MultilineTextWidgetClass", baseName: "MultilineText", properties: ["position 0 0", "size 200 80", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1", "text \"Text\""] },
		{ label: "Rich Text", type: "RichTextWidgetClass", baseName: "RichText", properties: ["position 0 0", "size 200 80", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1", "text \"Text\""] },
		{ label: "Image", type: "ImageWidgetClass", baseName: "Image", properties: ["position 0 0", "size 48 48", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Button", type: "ButtonWidgetClass", baseName: "Button", properties: ["position 0 0", "size 160 40", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1", "text \"Button\""] },
		{ label: "Edit Box", type: "EditBoxWidgetClass", baseName: "EditBox", properties: ["position 0 0", "size 180 36", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Check Box", type: "CheckBoxWidgetClass", baseName: "CheckBox", properties: ["position 0 0", "size 160 32", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1", "text \"Check Box\""] },
		{ label: "Combo Box", type: "XComboBoxWidgetClass", baseName: "ComboBox", properties: ["position 0 0", "size 180 36", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Progress Bar", type: "ProgressBarWidgetClass", baseName: "ProgressBar", properties: ["position 0 0", "size 200 20", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Slider", type: "SliderWidgetClass", baseName: "Slider", properties: ["position 0 0", "size 200 24", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Scroll", type: "ScrollWidgetClass", baseName: "Scroll", properties: ["position 0 0", "size 240 160", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Grid Spacer", type: "GridSpacerWidgetClass", baseName: "GridSpacer", properties: ["position 0 0", "size 240 160", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Wrap Spacer", type: "WrapSpacerWidgetClass", baseName: "WrapSpacer", properties: ["position 0 0", "size 240 160", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Canvas", type: "CanvasWidgetClass", baseName: "Canvas", properties: ["position 0 0", "size 200 120", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] },
		{ label: "Map", type: "MapWidgetClass", baseName: "Map", properties: ["position 0 0", "size 400 300", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"] }
	];

	const nonInsertableWidgetTypes = new Set([
		"WidgetClass",
		"StyledWidgetClass",
		"SpacerBaseWidgetClass"
	]);

	const commonWidgetTypes = new Set(commonWidgetTemplates.map((template) => template.type));

	function FormatWidgetTypeLabel(type: string) {
		return type
			.replace(/WidgetClass$/, "")
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
			.trim();
	}

	const advancedWidgetTemplates: WidgetTemplate[] = WorkbenchWidgetTypes
		.filter((type) => !commonWidgetTypes.has(type) && !nonInsertableWidgetTypes.has(type))
		.map((type) => {
			const baseName = type.replace(/WidgetClass$/, "") || "Widget";
			return {
				label: FormatWidgetTypeLabel(type),
				type,
				baseName,
				properties: ["position 0 0", "size 200 100", "hexactpos 1", "vexactpos 1", "hexactsize 1", "vexactsize 1"]
			};
		});

	const widgetTemplates = [...commonWidgetTemplates, ...advancedWidgetTemplates];

	function AddWidget(template: (typeof widgetTemplates)[number]) {
		const name = MakeUniqueNodeName(document.roots, template.baseName);
		const block = [
			`${template.type} ${name} {`,
			...template.properties.map((property) => `\t${property}`),
			"}"
		];
		if (selected)
			CommitStructuralEdit(InsertChildBlock(source, selected, block), template.type, name);
		else {
			const { eol } = SplitSourceLines(source);
			const prefix = source.trimEnd();
			CommitStructuralEdit(`${prefix}${prefix ? eol + eol : ""}${block.join(eol)}${eol}`, template.type, name);
		}
	}

	function SelectedNodeInfos() {
		const rootRect = { x: 0, y: 0, width: resolution.width, height: resolution.height };
		return selectedIds.map((id) => FindNodeRectInfo(document.roots, id, rootRect)).filter((info): info is NodeRectInfo => !!info);
	}

	function HaveCommonParent(infos: NodeRectInfo[]) {
		if (infos.length < 2)
			return false;
		const firstParentId = infos[0].parentNode?.id ?? null;
		return infos.every((info) => (info.parentNode?.id ?? null) === firstParentId);
	}

	function AlignSelected(mode: "left" | "centerH" | "right" | "top" | "centerV" | "bottom") {
		const infos = SelectedNodeInfos();
		if (!HaveCommonParent(infos))
			return;
		const anchor = infos.find((info) => info.node.id === selected?.id) ?? infos[0];
		let nextSource = source;
		for (const info of infos) {
			if (info.node.id === anchor.node.id)
				continue;
			const nextRect = { ...info.rect };
			if (mode === "left") nextRect.x = anchor.rect.x;
			else if (mode === "centerH") nextRect.x = anchor.rect.x + (anchor.rect.width - info.rect.width) * 0.5;
			else if (mode === "right") nextRect.x = anchor.rect.x + anchor.rect.width - info.rect.width;
			else if (mode === "top") nextRect.y = anchor.rect.y;
			else if (mode === "centerV") nextRect.y = anchor.rect.y + (anchor.rect.height - info.rect.height) * 0.5;
			else if (mode === "bottom") nextRect.y = anchor.rect.y + anchor.rect.height - info.rect.height;
			const parsed = parser.Parse(nextSource);
			const live = FindNodeByTypeAndName(parsed.roots, info.node.type, info.node.name);
			if (!live)
				continue;
			const geometry = RectToLayoutGeometry(live, info.parentRect, nextRect);
			nextSource = PatchNodeProperties(nextSource, live, [{ name: "position", rawValue: geometry.position }]);
		}
		CommitStructuralEdit(nextSource, anchor.node.type, anchor.node.name);
	}

	function DistributeSelected(axis: "horizontal" | "vertical") {
		const infos = SelectedNodeInfos();
		if (infos.length < 3 || !HaveCommonParent(infos))
			return;
		const sorted = [...infos].sort((a, b) => axis === "horizontal" ? a.rect.x - b.rect.x : a.rect.y - b.rect.y);
		const first = sorted[0].rect;
		const last = sorted[sorted.length - 1].rect;
		const totalSize = sorted.reduce((sum, info) => sum + (axis === "horizontal" ? info.rect.width : info.rect.height), 0);
		const span = axis === "horizontal" ? (last.x + last.width - first.x) : (last.y + last.height - first.y);
		const gap = (span - totalSize) / (sorted.length - 1);
		let cursor = axis === "horizontal" ? first.x : first.y;
		let nextSource = source;
		for (const info of sorted) {
			const nextRect = { ...info.rect };
			if (axis === "horizontal") nextRect.x = cursor; else nextRect.y = cursor;
			cursor += (axis === "horizontal" ? info.rect.width : info.rect.height) + gap;
			const parsed = parser.Parse(nextSource);
			const live = FindNodeByTypeAndName(parsed.roots, info.node.type, info.node.name);
			if (!live)
				continue;
			const geometry = RectToLayoutGeometry(live, info.parentRect, nextRect);
			nextSource = PatchNodeProperties(nextSource, live, [{ name: "position", rawValue: geometry.position }]);
		}
		const primary = selected ?? sorted[0].node;
		CommitStructuralEdit(nextSource, primary.type, primary.name);
	}

	function NudgeSelected(dx: number, dy: number) {
		const infos = SelectedNodeInfos();
		if (infos.length === 0)
			return;
		let nextSource = source;
		for (const info of infos) {
			const parsed = parser.Parse(nextSource);
			const live = FindNodeByTypeAndName(parsed.roots, info.node.type, info.node.name);
			if (!live)
				continue;
			const nextRect = { ...info.rect, x: info.rect.x + dx, y: info.rect.y + dy };
			const geometry = RectToLayoutGeometry(live, info.parentRect, nextRect);
			nextSource = PatchNodeProperties(nextSource, live, [{ name: "position", rawValue: geometry.position }]);
		}
		const primary = selected ?? infos[0].node;
		CommitStructuralEdit(nextSource, primary.type, primary.name);
	}

	function DuplicateSelected(node = selected) {
		if (!node)
			return;
		const newName = MakeCopiedWidgetName(document.roots, node.name);
		let nextSource = PatchDuplicateNode(source, node, newName);
		try {
			const parsed = parser.Parse(nextSource);
			const duplicate = FindNodeByTypeAndName(parsed.roots, node.type, newName);
			if (duplicate) {
				const rootRect = { x: 0, y: 0, width: resolution.width, height: resolution.height };
				const info = FindNodeRectInfo(parsed.roots, duplicate.id, rootRect);
				if (info) {
					const offsetRect = { ...info.rect, x: info.rect.x + 10, y: info.rect.y + 10 };
					const geometry = RectToLayoutGeometry(duplicate, info.parentRect, offsetRect);
					nextSource = PatchNodeProperties(nextSource, duplicate, [{ name: "position", rawValue: geometry.position }]);
				}
			}
		} catch {
			// Keep duplication usable even if offset calculation fails.
		}
		CommitStructuralEdit(nextSource, node.type, newName);
	}

	function DeleteSelected(node = selected) {
		if (!node)
			return;
		CommitStructuralEdit(PatchDeleteNode(source, node));
	}

	function ReparentNode(nodeId: string, targetId: string) {
		if (nodeId === targetId)
			return;
		const moving = FindNodeById(document.roots, nodeId);
		const target = FindNodeById(document.roots, targetId);
		if (!moving || !target || ContainsNode(moving, targetId))
			return;
		CommitStructuralEdit(PatchReparentNode(source, moving, target, parser), moving.type, moving.name);
	}

	function MoveNode(nodeId: string, direction: -1 | 1) {
		const node = FindNodeById(document.roots, nodeId);
		if (!node)
			return;
		const siblings = FindParentArray(document.roots, node.id);
		if (!siblings)
			return;
		const index = siblings.findIndex((item) => item.id === node.id);
		const otherIndex = index + direction;
		if (index < 0 || otherIndex < 0 || otherIndex >= siblings.length)
			return;
		CommitStructuralEdit(PatchSwapSiblingNodes(source, node, siblings[otherIndex]), node.type, node.name);
	}

	async function CollectDirectoryFiles(directoryHandle: any, rootName: string) {
		const files: File[] = [];
		const handles = new Map<string, any>();

		async function Walk(handle: any, prefix: string) {
			for await (const [name, entry] of handle.entries()) {
				const relative = prefix ? `${prefix}/${name}` : name;
				if (entry.kind === "directory") {
					await Walk(entry, relative);
					continue;
				}
				const file = await entry.getFile();
				try {
					Object.defineProperty(file, "webkitRelativePath", { value: `${rootName}/${relative}` });
				} catch {
					// BuildProjectWorkspace can still index the basename if a browser forbids the synthetic relative path.
				}
				files.push(file);
				handles.set(relative.toLowerCase(), entry);
			}
		}

		await Walk(directoryHandle, "");
		return { files, handles };
	}

	async function OpenLocalProject() {
		const picker = (window as any).showDirectoryPicker;
		if (!picker) {
			setParseError("Writable local project mode requires a Chromium browser with the File System Access API. Use Open Project for upload/offline mode.");
			return;
		}
		try {
			const directoryHandle = await picker({ mode: "readwrite" });
			setTextureProgress((previous) => ({ ...previous, project: null }));
			setProjectLoading(true);
			const collected = await CollectDirectoryFiles(directoryHandle, directoryHandle.name || "Project");
			const nextProject = await BuildProjectWorkspace(collected.files, TrackTextures("project"));
			projectFileHandlesRef.current = collected.handles;
			projectDirectoryHandleRef.current = directoryHandle;
			setProject(nextProject);
			setWorkspaceStarted(true);
			setLocalSourceMode(true);
			const firstLayout = nextProject.files.find((file) => file.extension === ".layout");
			if (firstLayout)
				await OpenFile(firstLayout.file, firstLayout.path, collected.handles.get(firstLayout.path.toLowerCase()) ?? null);
		} catch (error) {
			if ((error as DOMException)?.name !== "AbortError")
				setParseError(error instanceof Error ? error.message : String(error));
		} finally {
			setProjectLoading(false);
		}
	}

	function StartBlankLayout() {
		setProject(null);
		projectFileHandlesRef.current = new Map();
		projectDirectoryHandleRef.current = null;
		currentFileHandleRef.current = null;
		setLocalSourceMode(false);
		setActiveProjectPath(null);
		setFileName("Untitled.layout");
		setSource("");
		savedSourceRef.current = "";
		setDirty(false);
		setSourcePreserving(true);
		setWorkspaceStarted(true);
		ParseSource("");
	}

	function LoadSampleLayout() {
		setProject(null);
		projectFileHandlesRef.current = new Map();
		projectDirectoryHandleRef.current = null;
		currentFileHandleRef.current = null;
		setLocalSourceMode(false);
		setActiveProjectPath(null);
		setFileName("Sample.layout");
		setSource(sampleLayout);
		savedSourceRef.current = sampleLayout;
		setDirty(false);
		setSourcePreserving(true);
		setWorkspaceStarted(true);
		ParseSource(sampleLayout);
	}

	function OpenTextureTool(file?: File, projectPath: string | null = null) {
		setTextureToolOpen(true);
		setTextureToolFile(file ?? null);
		setTextureToolProjectPath(projectPath);
		setTextureToolMipmaps(false);
		setTextureToolFormat("bgra8");
		setTextureToolStatus(null);
	}

	function CloseTextureTool() {
		if (textureToolBusy)
			return;
		setTextureToolOpen(false);
		setTextureToolFile(null);
		setTextureToolProjectPath(null);
		setTextureToolStatus(null);
	}

	function DownloadBlob(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const anchor = window.document.createElement("a");
		anchor.href = url;
		anchor.download = name;
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	async function RefreshWritableProjectIndex() {
		const directoryHandle = projectDirectoryHandleRef.current;
		if (!directoryHandle)
			return;
		const collected = await CollectDirectoryFiles(directoryHandle, directoryHandle.name || "Project");
		const nextProject = await BuildProjectWorkspace(collected.files, TrackTextures("project"));
		projectFileHandlesRef.current = collected.handles;
		setProject(nextProject);
	}

	async function WriteGeneratedEddsBesideSource(blob: Blob, projectPath: string) {
		const root = projectDirectoryHandleRef.current;
		if (!root)
			return false;
		const parts = projectPath.replace(/\\/g, "/").split("/").filter(Boolean);
		if (parts.length === 0)
			return false;
		const sourceName = parts.pop()!;
		let directory = root;
		for (const part of parts)
			directory = await directory.getDirectoryHandle(part);
		const outputName = sourceName.replace(/\.(png|tga)$/i, ".edds");
		const handle = await directory.getFileHandle(outputName, { create: true });
		const writable = await handle.createWritable();
		await writable.write(blob);
		await writable.close();
		return true;
	}

	async function ConvertTextureToEdds() {
		if (!textureToolFile)
			return;
		setTextureToolBusy(true);
		setTextureToolStatus(null);
		try {
			const result = await EncodeImageToEdds(textureToolFile, { generateMipmaps: textureToolMipmaps, format: textureToolFormat });
			const outputName = textureToolFile.name.replace(/\.(png|tga)$/i, ".edds");
			let wroteToProject = false;
			if (textureToolProjectPath && projectDirectoryHandleRef.current) {
				wroteToProject = await WriteGeneratedEddsBesideSource(result.blob, textureToolProjectPath);
				if (wroteToProject)
					await RefreshWritableProjectIndex();
			}
			if (!wroteToProject)
				DownloadBlob(result.blob, outputName);
			setTextureToolStatus(`${result.width}×${result.height} · ${result.format.toUpperCase()} · ${result.mipCount} mip${result.mipCount === 1 ? "" : "s"} · ${(result.byteLength / 1024).toFixed(1)} KiB${wroteToProject ? " · saved beside source and refreshed" : " · exported"}`);
		} catch (error) {
			setTextureToolStatus(error instanceof Error ? error.message : String(error));
		} finally {
			setTextureToolBusy(false);
		}
	}

	async function WriteProjectGeneratedFile(relativeFolder: string, name: string, data: Blob | string) {
		const root = projectDirectoryHandleRef.current;
		if (!root)
			return false;
		let directory = root;
		for (const part of relativeFolder.replace(/\\/g, "/").split("/").filter(Boolean))
			directory = await directory.getDirectoryHandle(part, { create: true });
		const handle = await directory.getFileHandle(name, { create: true });
		const writable = await handle.createWritable();
		await writable.write(data);
		await writable.close();
		return true;
	}

	async function BuildAtlasImageset() {
		if (imageSetFiles.length === 0)
			return;
		setImageSetBusy(true);
		setImageSetStatus(null);
		try {
			const normalizedOutputFolder = imageSetOutputFolder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
			const texturePathPrefix = projectDirectoryHandleRef.current
				? [project?.name, normalizedOutputFolder].filter(Boolean).join("/")
				: normalizedOutputFolder;
			const result = await BuildImageSet(imageSetFiles.map((file) => ({ file, flags: imageSetFlags[`${file.name}:${file.size}:${file.lastModified}`] ?? 0 })), { name: imageSetName, padding: imageSetPadding, generateMipmaps: imageSetMipmaps, format: imageSetFormat, texturePathPrefix });
			let saved = false;
			if (projectDirectoryHandleRef.current) {
				for (const part of result.parts) {
					await WriteProjectGeneratedFile(imageSetOutputFolder, `${part.name}.edds`, part.edds.blob);
					await WriteProjectGeneratedFile(imageSetOutputFolder, `${part.name}.imageset`, part.imageSetText);
				}
				await RefreshWritableProjectIndex();
				saved = true;
			} else {
				for (const part of result.parts) {
					DownloadBlob(part.edds.blob, `${part.name}.edds`);
					DownloadBlob(new Blob([part.imageSetText], { type: "text/plain" }), `${part.name}.imageset`);
				}
			}
			const totalBytes = result.parts.reduce((sum, part) => sum + part.edds.byteLength, 0);
			const atlasSummary = result.parts.map((part) => `${part.name} ${part.atlas.width}×${part.atlas.height}`).join(", ");
			const first = result.parts[0];
			setImageSetStatus(`${result.entryCount} images · ${result.parts.length} atlas${result.parts.length === 1 ? "" : "es"} · ${atlasSummary} · ${first.edds.format.toUpperCase()} · ${first.edds.mipCount} mip${first.edds.mipCount === 1 ? "" : "s"} · ${(totalBytes / 1024).toFixed(1)} KiB${saved ? ` · saved to ${imageSetOutputFolder || "project root"} and refreshed` : " · exported .imageset + .edds"}`);
		} catch (error) {
			setImageSetStatus(error instanceof Error ? error.message : String(error));
		} finally {
			setImageSetBusy(false);
		}
	}

	async function OpenLocalDependencyMod() {
		const picker = (window as any).showDirectoryPicker;
		if (!picker) {
			setParseError("Dependency source mode requires a Chromium browser with the File System Access API. Use Dependency Mod (Upload) instead.");
			return;
		}
		try {
			setTextureProgress((previous) => ({ ...previous, dependency: null }));
			setDependencyLoading(true);
			const directoryHandle = await picker({ mode: "read", id: "nih-layout-studio-dependency-mod" });
			const collected = await CollectDirectoryFiles(directoryHandle, directoryHandle.name || "Dependency");
			const nextDependency = await BuildProjectWorkspace(collected.files, TrackTextures("dependency"));
			setDependencyProjects((current) => [...current, nextDependency]);
			setParseError(null);
		} catch (error) {
			if ((error as DOMException)?.name !== "AbortError")
				setParseError(error instanceof Error ? error.message : String(error));
		} finally {
			setDependencyLoading(false);
		}
	}


	async function OpenLocalVanillaGui() {
		const picker = (window as any).showDirectoryPicker;
		if (!picker) {
			setParseError("Vanilla source mode requires a Chromium browser with the File System Access API. Use Vanilla GUI (Upload) instead.");
			return;
		}
		try {
			setTextureProgress((previous) => ({ ...previous, vanilla: null }));
			setVanillaLoading(true);
			const directoryHandle = await picker({ mode: "read", id: "nih-layout-studio-vanilla-gui" });
			const collected = await CollectDirectoryFiles(directoryHandle, directoryHandle.name || "gui");
			const nextVanilla = await BuildProjectWorkspace(collected.files, TrackTextures("vanilla"));
			setVanillaProject(nextVanilla);
			setParseError(null);
		} catch (error) {
			if ((error as DOMException)?.name !== "AbortError")
				setParseError(error instanceof Error ? error.message : String(error));
		} finally {
			setVanillaLoading(false);
		}
	}

	async function OpenLocalLayout() {
		const picker = (window as any).showOpenFilePicker;
		if (!picker) {
			setParseError("Writable local file mode requires a Chromium browser with the File System Access API. Use Open .layout for upload/offline mode.");
			return;
		}
		try {
			const [handle] = await picker({
				multiple: false,
				types: [{ description: "DayZ Layout", accept: { "text/plain": [".layout"] } }]
			});
			if (!handle)
				return;
			const file = await handle.getFile();
			setProject(null);
			projectFileHandlesRef.current = new Map();
			await OpenFile(file, null, handle);
		} catch (error) {
			if ((error as DOMException)?.name !== "AbortError")
				setParseError(error instanceof Error ? error.message : String(error));
		}
	}

	function RequestLayoutOutput(action: "save" | "download") {
		if (nativeCompatibilityWarnings.length > 0) {
			setPendingLayoutOutput({ action, sourceSnapshot: source });
			return;
		}
		if (action === "save")
			void SaveCurrent();
		else
			DownloadLayout();
	}

	function ContinueLayoutOutput() {
		const pending = pendingLayoutOutput;
		setPendingLayoutOutput(null);
		if (!pending)
			return;
		// Never allow an earlier review to authorize a subsequently edited file.
		if (source !== pending.sourceSnapshot) {
			RequestLayoutOutput(pending.action);
			return;
		}
		if (pending.action === "save")
			void SaveCurrent();
		else
			DownloadLayout();
	}

	async function SaveCurrent() {
		try {
			parser.Parse(source);
		} catch (error) {
			setParseError(`Save blocked: ${error instanceof Error ? error.message : String(error)}`);
			return;
		}
		const handle = currentFileHandleRef.current;
		if (!handle) {
			DownloadLayout();
			return;
		}
		try {
			const writable = await handle.createWritable();
			await writable.write(source);
			await writable.close();
			savedSourceRef.current = source;
			setDirty(false);
		} catch (error) {
			setParseError(error instanceof Error ? error.message : String(error));
		}
	}

	function DownloadLayout() {
		const blob = new Blob([source], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const anchor = window.document.createElement("a");
		anchor.href = url;
		anchor.download = fileName;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	function ToggleDebug(key: keyof CanvasDebugOptions) {
		setDebug((current) => ({ ...current, [key]: !current[key] }));
	}

	function ClampZoom(value: number) {
		return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
	}

	function SetZoomAtPoint(nextZoom: number, clientX?: number, clientY?: number) {
		const viewport = previewRef.current;
		const clamped = ClampZoom(nextZoom);
		if (!viewport) {
			setZoom(clamped);
			return;
		}
		const bounds = viewport.getBoundingClientRect();
		const cursorX = clientX !== undefined ? clientX - bounds.left : viewport.clientWidth / 2;
		const cursorY = clientY !== undefined ? clientY - bounds.top : viewport.clientHeight / 2;
		const contentX = (viewport.scrollLeft + cursorX) / zoom;
		const contentY = (viewport.scrollTop + cursorY) / zoom;
		setZoom(clamped);
		requestAnimationFrame(() => {
			viewport.scrollLeft = contentX * clamped - cursorX;
			viewport.scrollTop = contentY * clamped - cursorY;
		});
	}

	function HandlePreviewWheel(event: WheelEvent<HTMLDivElement>) {
		event.preventDefault();
		const factor = Math.exp(-event.deltaY * 0.0015);
		SetZoomAtPoint(zoom * factor, event.clientX, event.clientY);
	}

	function BeginResize(
		type: "left" | "right" | "project" | "source",
		event: ReactPointerEvent<HTMLDivElement>
	) {
		event.preventDefault();
		const startX = event.clientX;
		const startY = event.clientY;
		const startLeft = leftWidth;
		const startRight = rightWidth;
		const startProject = projectHeight;
		const startSource = sourceHeight;

		window.document.body.classList.add("resizing-panels");

		function OnMove(moveEvent: PointerEvent) {
			if (type === "left")
				setLeftWidth(Math.max(190, Math.min(520, startLeft + moveEvent.clientX - startX)));
			else if (type === "right")
				setRightWidth(Math.max(240, Math.min(560, startRight - (moveEvent.clientX - startX))));
			else if (type === "project")
				setProjectHeight(Math.max(120, Math.min(700, startProject + moveEvent.clientY - startY)));
			else
				setSourceHeight(Math.max(120, Math.min(650, startSource - (moveEvent.clientY - startY))));
		}

		function OnUp() {
			window.document.body.classList.remove("resizing-panels");
			window.removeEventListener("pointermove", OnMove);
			window.removeEventListener("pointerup", OnUp);
		}

		window.addEventListener("pointermove", OnMove);
		window.addEventListener("pointerup", OnUp);
	}

	function FitPreview() {
		const viewport = previewRef.current;
		if (!viewport)
			return;
		const horizontalPadding = 36;
		const verticalPadding = 36;
		const availableWidth = Math.max(1, viewport.clientWidth - horizontalPadding);
		const availableHeight = Math.max(1, viewport.clientHeight - verticalPadding);
		const fitZoom = Math.min(availableWidth / resolution.width, availableHeight / resolution.height);
		const clamped = ClampZoom(fitZoom);
		setZoom(clamped);
		requestAnimationFrame(() => {
			viewport.scrollLeft = Math.max(0, (resolution.width * clamped - viewport.clientWidth) / 2);
			viewport.scrollTop = Math.max(0, (resolution.height * clamped - viewport.clientHeight) / 2);
		});
	}

	const activeLoadKind = projectLoading ? "project" : dependencyLoading ? "dependency" : vanillaLoading ? "vanilla" : null;
	const activeTextureProgress = activeLoadKind ? textureProgress[activeLoadKind] : null;
	const activeLoadLabel = activeLoadKind === "project" ? "Loading project files and indexing resources…" : activeLoadKind === "dependency" ? "Indexing dependency resources…" : activeLoadKind === "vanilla" ? "Indexing vanilla GUI resources…" : "";
	const activeLoadMessage = activeLoadLabel + (activeTextureProgress && activeTextureProgress.total > 0 ? ` · Decoding textures (${activeTextureProgress.completed}/${activeTextureProgress.total})` : "");

	return (
		<div className="app">
			<div className="resource-loading-announcement" role="status" aria-live="polite" aria-atomic="true">
				{activeLoadMessage}
			</div>
			{activeLoadKind && (
				<div className="resource-loading-status" aria-hidden="true">
					<span className="resource-loading-spinner" />
					<span>{activeLoadMessage}</span>
				</div>
			)}
			<header className="toolbar">
				<div className="brand"><strong>NIH</strong> Layout Studio <span>{appVersion}</span></div>
				<span className="workspace-mode">{project ? (localSourceMode ? "PROJECT SOURCE" : "PROJECT UPLOAD") : (localSourceMode ? "LOCAL SOURCE" : "STANDALONE")}</span>
				<span className={`source-mode ${sourcePreserving ? "aware" : "canonical"}`}>{sourcePreserving ? "SOURCE-AWARE" : "CANONICAL"}</span>
				{dirty && <span className="dirty-indicator">UNSAVED</span>}
				{dependencyProjects.length > 0 && <span className="dependency-indicator" title={dependencyProjects.map((dependency, index) => `${index + 1}. ${dependency.name}`).join("\n")}>DEPS {dependencyProjects.length}</span>}
				{vanillaProject && <span className="vanilla-indicator">VANILLA P:\gui</span>}
				<span className="local-processing-indicator" title="Project, dependency, vanilla GUI, layout, image, font, imageset, and EDDS files are processed locally in your browser. NIH Layout Studio does not upload your selected files to a server.">LOCAL PROCESSING</span>

				<details className="toolbar-menu">
					<summary>File ▾</summary>
					<div className="toolbar-menu-popover">
						<div className="toolbar-menu-label">Open</div>
						<button onClick={() => { CloseToolbarMenus(); folderRef.current?.click(); }} disabled={projectLoading}>{projectLoading ? "Indexing…" : "Project (Upload)…"}</button>
						<button onClick={() => { CloseToolbarMenus(); void OpenLocalProject(); }} disabled={projectLoading || !sourceAccessSupported} title={!sourceAccessSupported ? "Source mode requires the File System Access API. Use Upload mode in this browser." : undefined}>Project (Source)…</button>
						<button onClick={() => { CloseToolbarMenus(); fileRef.current?.click(); }}>Layout (Upload)…</button>
						<button onClick={() => { CloseToolbarMenus(); void OpenLocalLayout(); }} disabled={!sourceAccessSupported} title={!sourceAccessSupported ? "Source mode requires the File System Access API. Use Upload mode in this browser." : undefined}>Layout (Source)…</button>
						<div className="toolbar-menu-separator" />
						<div className="toolbar-menu-label">Dependency mod resources</div>
						<button onClick={() => { CloseToolbarMenus(); dependencyFolderRef.current?.click(); }} disabled={dependencyLoading}>{dependencyLoading ? "Indexing…" : "Dependency Mod (Upload)…"}</button>
						<button onClick={() => { CloseToolbarMenus(); void OpenLocalDependencyMod(); }} disabled={dependencyLoading || !sourceAccessSupported} title={!sourceAccessSupported ? "Source mode requires the File System Access API. Use Upload mode in this browser." : undefined}>Dependency Mod (Source)…</button>
						{dependencyProjects.map((dependency, index) => <button key={`${dependency.name}:${index}`} onClick={() => { CloseToolbarMenus(); RemoveDependencyProject(index); }}>Unload {dependency.name}<span className="menu-shortcut">#{index + 1}</span></button>)}
						{dependencyProjects.length > 1 && <button onClick={() => { CloseToolbarMenus(); UnloadDependencyProjects(); }}>Unload All Dependencies<span className="menu-shortcut">{dependencyProjects.length}</span></button>}
						<div className="toolbar-menu-separator" />
						<div className="toolbar-menu-label">Vanilla DayZ resources</div>
						<button onClick={() => { CloseToolbarMenus(); vanillaFolderRef.current?.click(); }} disabled={vanillaLoading || !!vanillaProject}>Vanilla GUI (Upload)…<span className="menu-shortcut">P:\gui</span></button>
						<button onClick={() => { CloseToolbarMenus(); void OpenLocalVanillaGui(); }} disabled={vanillaLoading || !!vanillaProject || !sourceAccessSupported} title={!sourceAccessSupported ? "Source mode requires the File System Access API. Use Upload mode in this browser." : undefined}>Vanilla GUI (Source)…<span className="menu-shortcut">P:\gui</span></button>
						{vanillaProject && <button onClick={() => { CloseToolbarMenus(); setVanillaProject(null); }}>Unload Vanilla GUI</button>}
						<div className="toolbar-menu-separator" />
						<button onClick={() => { CloseToolbarMenus(); RequestLayoutOutput("save"); }} disabled={!dirty}>{localSourceMode ? "Save" : "Export"}<span className="menu-shortcut">Ctrl+S</span></button>
						<button onClick={() => { CloseToolbarMenus(); RequestLayoutOutput("download"); }}>Export As…</button>
					</div>
				</details>
				<input
					ref={folderRef}
					type="file"
					multiple
					hidden
					{...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
					onChange={(event) => void OpenProjectFiles(Array.from(event.target.files ?? []))}
				/>
				<input ref={fileRef} type="file" accept=".layout,text/plain" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void OpenFile(file); }} />
				<input ref={dependencyFolderRef} type="file" multiple hidden {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(event) => void OpenDependencyFiles(Array.from(event.target.files ?? []))} />
				<input ref={vanillaFolderRef} type="file" multiple hidden {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(event) => void OpenVanillaFiles(Array.from(event.target.files ?? []))} />

				<details className="toolbar-menu">
					<summary>Tools ▾</summary>
					<div className="toolbar-menu-popover">
						<div className="toolbar-menu-label">Texture tools</div>
						<button onClick={() => { CloseToolbarMenus(); OpenTextureTool(); }}>PNG/TGA → EDDS…</button>
						<button onClick={() => { CloseToolbarMenus(); setImageSetToolOpen(true); setImageSetStatus(null); }}>Imageset / Atlas Builder…</button>
					</div>
				</details>

				<button className="toolbar-action" onClick={() => void RefreshSource()}>{localSourceMode ? "Reload / Refresh" : "Parse / Refresh"}</button>

				<details className="toolbar-menu">
					<summary>Edit ▾</summary>
					<div className="toolbar-menu-popover">
						<button disabled={undoStack.length === 0} onClick={() => { CloseToolbarMenus(); Undo(); }}>Undo<span className="menu-shortcut">Ctrl+Z</span></button>
						<button disabled={redoStack.length === 0} onClick={() => { CloseToolbarMenus(); Redo(); }}>Redo<span className="menu-shortcut">Ctrl+Y</span></button>
						<div className="toolbar-menu-separator" />
						<button disabled={!selected} onClick={() => { CloseToolbarMenus(); CopySelected(); }}>Copy Widget<span className="menu-shortcut">Ctrl+C</span></button>
						<button disabled={!selected || !copiedWidget} onClick={() => { CloseToolbarMenus(); PasteWidgetAsSibling(); }}>Paste as Sibling<span className="menu-shortcut">Ctrl+V</span></button>
						<button disabled={!selected || !copiedWidget} onClick={() => { CloseToolbarMenus(); PasteWidgetAsChild(); }}>Paste as Child</button>
						<button disabled={!selected} onClick={() => { CloseToolbarMenus(); DuplicateSelected(); }}>Duplicate</button>
						<button disabled={!selected} onClick={() => { CloseToolbarMenus(); DeleteSelected(); }}>Delete<span className="menu-shortcut">Del</span></button>
						<div className="toolbar-menu-separator" />
						<div className="toolbar-menu-label">Align selected</div>
						<div className="menu-grid">
							<button disabled={selectedIds.length < 2} onClick={() => { CloseToolbarMenus(); AlignSelected("left"); }}>Left</button>
							<button disabled={selectedIds.length < 2} onClick={() => { CloseToolbarMenus(); AlignSelected("centerH"); }}>Center H</button>
							<button disabled={selectedIds.length < 2} onClick={() => { CloseToolbarMenus(); AlignSelected("right"); }}>Right</button>
							<button disabled={selectedIds.length < 2} onClick={() => { CloseToolbarMenus(); AlignSelected("top"); }}>Top</button>
							<button disabled={selectedIds.length < 2} onClick={() => { CloseToolbarMenus(); AlignSelected("centerV"); }}>Center V</button>
							<button disabled={selectedIds.length < 2} onClick={() => { CloseToolbarMenus(); AlignSelected("bottom"); }}>Bottom</button>
						</div>
						<button disabled={selectedIds.length < 3} onClick={() => { CloseToolbarMenus(); DistributeSelected("horizontal"); }}>Distribute Horizontally</button>
						<button disabled={selectedIds.length < 3} onClick={() => { CloseToolbarMenus(); DistributeSelected("vertical"); }}>Distribute Vertically</button>
					</div>
				</details>

				<details className="toolbar-menu add-widget-menu">
					<summary>Add Widget ▾</summary>
					<div className="toolbar-menu-popover widget-palette">
						<div className="toolbar-menu-label">{selected ? `Add child to ${selected.name}` : "Add root widget"}</div>
						{commonWidgetTemplates.map((template) => <button key={template.type} onClick={() => { CloseToolbarMenus(); AddWidget(template); }}>{template.label}<span className="widget-palette-type">{template.type.replace(/Class$/, "")}</span></button>)}
						<div className="toolbar-menu-separator" />
						<div className="toolbar-menu-label">Advanced / Specialized</div>
						<div className="widget-palette-note">Audited Workbench types. Some specialized widgets require game/runtime data to render fully.</div>
						{advancedWidgetTemplates.map((template) => <button key={template.type} onClick={() => { CloseToolbarMenus(); AddWidget(template); }}>{template.label}<span className="widget-palette-type">{template.type.replace(/Class$/, "")}</span></button>)}
					</div>
				</details>
				<details className="toolbar-menu">
					<summary>View ▾</summary>
					<div className="toolbar-menu-popover view-menu">
						<label><input type="checkbox" checked={debug.showBounds} onChange={() => ToggleDebug("showBounds")} /> Widget Bounds</label>
						<label><input type="checkbox" checked={debug.showNames} onChange={() => ToggleDebug("showNames")} /> Widget Names</label>
						<label><input type="checkbox" checked={debug.showAnchors} onChange={() => ToggleDebug("showAnchors")} /> Anchors</label>
						<div className="toolbar-menu-separator" />
						<label><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Snap to Grid</label>
						<label><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /> Show Grid</label>
						<label className="snap-size-row">Grid <input type="number" min="1" max="100" value={snapSize} onChange={(event) => setSnapSize(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /> px</label>
					</div>
				</details>
				<div className="spacer" />
				<select value={resolutionIndex} onChange={(event) => setResolutionIndex(Number(event.target.value))}>
					{resolutions.map((item, index) => <option value={index} key={item.label}>{item.label}</option>)}
				</select>
			</header>

			<main className="workspace" style={{ gridTemplateColumns: `${leftWidth}px 5px minmax(420px, 1fr) 5px ${rightWidth}px` }}>
				<aside className="left-column" style={{ gridTemplateRows: `minmax(120px, ${projectHeight}px) 5px minmax(160px, 1fr)` }}>
					<section className="left-panel project-panel">
						<div className="panel-title split-title">
							<span>PROJECT</span>
							{project && <span>{project.files.length} files · {project.imageSets.size} imagesets · {project.fontFamilies.size + new Set(project.bitmapFonts.values()).size} fonts · {project.widgetStyles.size} style widget types · {project.eddsDecoded.size} EDDS decoded{project.eddsFailed.size ? ` · ${project.eddsFailed.size} EDDS unsupported` : ""}{dependencyProjects.length ? ` · Dependencies: ${dependencyProjects.length}` : ""}{vanillaProject ? ` · Vanilla: ${vanillaProject.imageSets.size} sets / ${vanillaProject.fontFamilies.size + new Set(vanillaProject.bitmapFonts.values()).size} fonts` : ""}</span>}
						</div>
						<div className="left-panel-scroll"><ProjectPanel project={project} activePath={activeProjectPath} onOpenFile={(file) => void OpenProjectFile(file)} onConvertTexture={(file) => OpenTextureTool(file.file, file.path)} /></div>
					</section>
					<div className="left-divider panel-resizer horizontal-resizer" title="Drag to resize Project / Hierarchy" onPointerDown={(event) => BeginResize("project", event)} onDoubleClick={() => setProjectHeight(DEFAULT_PROJECT_HEIGHT)} />
					<section className="left-panel hierarchy-panel">
						<div className="panel-title split-title"><span>HIERARCHY</span><span>{fileName}</span></div>
						<div className="left-panel-scroll hierarchy-scroll">
							<WidgetTree nodes={document.roots} selected={selected} selectedIds={selectedIds} onSelect={SelectNode} onReparent={ReparentNode} onMove={MoveNode} onCopy={(node) => { SelectNode(node); CopySelected(node); }} onPasteChild={(node) => { SelectNode(node); PasteWidgetAsChild(node); }} onDuplicate={(node) => DuplicateSelected(node)} onDelete={(node) => DeleteSelected(node)} />
							<RenderStatus nodes={document.roots} />
						</div>
					</section>
				</aside>

				<div className="workspace-resizer vertical-resizer" title="Drag to resize Project / Hierarchy panels" onPointerDown={(event) => BeginResize("left", event)} onDoubleClick={() => setLeftWidth(DEFAULT_LEFT_WIDTH)} />

				<section className="center-column" style={{ gridTemplateRows: workspaceStarted ? `34px minmax(180px, 1fr) 5px ${sourceHeight}px` : "minmax(0, 1fr)" }}>
					{!workspaceStarted ? (
						<div className="welcome-screen">
							<div className="welcome-card">
								<div className="welcome-kicker">NIH LAYOUT STUDIO</div>
								<h1>DayZ / Enfusion layout editing in your browser</h1>
								<p className="welcome-intro">Open a project or layout to begin. Files stay on your device and are processed locally in the browser.</p>
								<div className="welcome-actions">
									<button className="welcome-action primary" onClick={() => void OpenLocalProject()} disabled={projectLoading || !sourceAccessSupported} title={!sourceAccessSupported ? "Source mode requires the File System Access API. Use Project Upload instead." : undefined}>
										<strong>Open Project (Source)</strong>
										<span>Writable project folder with source-aware saving</span>
									</button>
									<button className="welcome-action" onClick={() => folderRef.current?.click()} disabled={projectLoading}>
										<strong>Open Project</strong>
										<span>Upload a project folder for browser-only editing</span>
									</button>
									<button className="welcome-action" onClick={() => fileRef.current?.click()}>
										<strong>Open Layout</strong>
										<span>Open a standalone .layout file</span>
									</button>
									<button className="welcome-action" onClick={LoadSampleLayout}>
										<strong>Load Sample</strong>
										<span>Explore a neutral example layout</span>
									</button>
								</div>
								<button className="welcome-start-blank" onClick={StartBlankLayout}>Start Blank Layout — open an empty editor</button>
								<div className="welcome-resource-section">
									<div>
										<strong>Optional resources</strong>
										<span>Load dependencies or vanilla GUI resources to populate styles, fonts, imagesets, and previews.</span>
									</div>
									<div className="welcome-resource-actions">
										<button onClick={() => dependencyFolderRef.current?.click()} disabled={dependencyLoading}>Dependency Mod (Upload)</button>
										{sourceAccessSupported && <button onClick={() => void OpenLocalDependencyMod()} disabled={dependencyLoading}>Dependency Mod (Source)</button>}
										<button onClick={() => vanillaFolderRef.current?.click()} disabled={vanillaLoading || !!vanillaProject}>{vanillaProject ? "Vanilla GUI Loaded" : "Vanilla GUI (Upload)"}</button>
										{sourceAccessSupported && <button onClick={() => void OpenLocalVanillaGui()} disabled={vanillaLoading || !!vanillaProject}>Vanilla GUI (Source)</button>}
									</div>
								</div>
								<div className="welcome-local-note">LOCAL PROCESSING · Selected files are not uploaded to an NIH server.</div>
							</div>
						</div>
					) : (<>

					<div className="preview-header">
						<span>PREVIEW</span>
						<div className="preview-controls">
							<span>{resolution.label}</span>
							<span className="preview-hint">Wheel to zoom</span>
							<button className="zoom-button" title="Zoom out" onClick={() => SetZoomAtPoint(zoom / 1.15)}>−</button>
							<button className="zoom-value" title="Reset zoom" onClick={() => SetZoomAtPoint(DEFAULT_ZOOM)}>{Math.round(zoom * 100)}%</button>
							<button className="zoom-button" title="Zoom in" onClick={() => SetZoomAtPoint(zoom * 1.15)}>+</button>
							<button className="fit-button" title="Fit layout to preview" onClick={FitPreview}>Fit</button>
						</div>
					</div>
					<div ref={previewRef} className="preview-viewport" onWheel={HandlePreviewWheel}>
						<div className="canvas-stage" style={{ width: resolution.width * zoom, height: resolution.height * zoom }}>
							<div className="scaled-canvas" style={{ width: resolution.width, height: resolution.height, transform: `scale(${zoom})` }}>
								<Canvas nodes={document.roots} selected={selected} selectedIds={selectedIds} onSelect={SelectNode} onGeometryChange={ChangeGeometry} width={resolution.width} height={resolution.height} zoom={zoom} debug={debug} project={project} dependencyProjects={dependencyProjects} vanillaProject={vanillaProject} snapEnabled={snapEnabled} snapSize={snapSize} showGrid={showGrid} onContextMenu={(node, x, y) => setContextMenu({ nodeId: node.id, x, y })} />
							</div>
						</div>
					</div>
					<div className="source-resizer panel-resizer horizontal-resizer" title="Drag to resize Source" onPointerDown={(event) => BeginResize("source", event)} onDoubleClick={() => setSourceHeight(DEFAULT_SOURCE_HEIGHT)} />
					<div className="source-pane">
						<div className="panel-title source-title source-tabs">
							<div className="source-tab-buttons">
								<button className={sourceTab === "source" ? "active" : ""} onClick={() => setSourceTab("source")}>SOURCE</button>
								<button className={sourceTab === "problems" ? "active" : ""} onClick={() => setSourceTab("problems")}>PROBLEMS {layoutProblems.length + nativeCompatibilityWarnings.length > 0 ? `(${layoutProblems.length + nativeCompatibilityWarnings.length})` : ""}</button>
							</div>
							<span>{activeProjectPath ?? fileName}</span>
						</div>
						{sourceTab === "source" ? <>
							<textarea value={source} onChange={(event) => { setSource(event.target.value); setDirty(event.target.value !== savedSourceRef.current); }} spellCheck={false} />
							{parseError && <div className="error">{parseError}</div>}
						</> : <div className="problems-pane">
							<div className="problems-toolbar"><span>{layoutProblems.length + nativeCompatibilityWarnings.length === 0 ? "No issues detected by current checks." : `${layoutProblems.length} formatting · ${nativeCompatibilityWarnings.length} native compatibility`}</span><button disabled={!layoutProblems.some((problem) => problem.canNormalize)} onClick={NormalizeAllFormatting}>Normalize All</button></div>
							{layoutProblems.map((problem, index) => <div className={`problem-row ${problem.severity}`} key={`${problem.line}-${problem.message}-${index}`}>
								<div className="problem-main"><b>Line {problem.line}</b><span>{problem.message}</span></div>
								{problem.detail && <div className="problem-detail">{problem.detail}</div>}
								{problem.canNormalize && <button onClick={() => NormalizeProblem(problem)}>Normalize Line</button>}
							</div>)}
							{nativeCompatibilityWarnings.length > 0 && (
								<section className="native-compatibility-problems" aria-label="Native compatibility warnings">
									<div className="native-compatibility-problems-heading">
										Native loader compatibility · {nativeCompatibilityWarnings.length} warning{nativeCompatibilityWarnings.length === 1 ? "" : "s"}
									</div>
									<p>Native DayZ tests found class/property-order risks. These findings are read-only. Normalizing formatting does not repair them.</p>
									<NativeCompatibilityWarnings warnings={nativeCompatibilityWarnings} />
								</section>
							)}
						</div>}
					</div>
				
					</>)}
</section>

				<div className="workspace-resizer vertical-resizer" title="Drag to resize Properties" onPointerDown={(event) => BeginResize("right", event)} onDoubleClick={() => setRightWidth(DEFAULT_RIGHT_WIDTH)} />

				<aside className="panel properties-panel">
					<div className="panel-title">PROPERTIES</div>
					<div className="properties-panel-scroll">
						<PropertyInspector node={selected} onRename={RenameNode} onPropertyChange={UpdateProperty} onAddProperty={UpdateProperty}
						onDeleteProperty={DeleteProperty} fontOptions={fontOptions} imageSetOptions={imageSetOptions} styleOptions={styleOptions} />
					</div>
				</aside>
			</main>
			{contextMenu && (() => {
				const node = FindNodeById(document.roots, contextMenu.nodeId);
				if (!node) return null;
				return <div className="canvas-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
					<button onClick={() => { CopySelected(node); setContextMenu(null); }}>Copy <span>Ctrl+C</span></button>
					<button onClick={() => { DuplicateSelected(node); setContextMenu(null); }}>Duplicate</button>
					<button disabled={!copiedWidget} onClick={() => { SelectNode(node); PasteWidgetAsChild(node); setContextMenu(null); }}>Paste Child</button>
					<div className="context-separator" />
					<button className="danger" onClick={() => { DeleteSelected(node); setContextMenu(null); }}>Delete <span>Del</span></button>
				</div>;
			})()}

			{textureToolOpen && (
				<div className="modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) CloseTextureTool(); }}>
					<div className="texture-tool-dialog">
						<div className="texture-tool-title">PNG/TGA → EDDS</div>
						<label className="texture-tool-file">
							<span>Source</span>
							<input type="file" accept=".png,.tga,image/png" disabled={textureToolBusy} onChange={(event) => { const file = event.target.files?.[0] ?? null; setTextureToolFile(file); setTextureToolProjectPath(null); setTextureToolStatus(null); }} />
							<strong>{textureToolFile?.name ?? "Choose a PNG or TGA file"}</strong>
						</label>
						<label className="texture-tool-row"><span>Format</span><select value={textureToolFormat} disabled={textureToolBusy} onChange={(event) => setTextureToolFormat(event.target.value as EddsPixelFormat)}><option value="bgra8">BGRA8 — lossless UI default</option><option value="dxt5">DXT5 / BC3 — alpha + compression</option><option value="dxt1">DXT1 / BC1 — compression, no smooth alpha</option></select></label>
						<label className="texture-tool-check"><input type="checkbox" checked={textureToolMipmaps} disabled={textureToolBusy} onChange={(event) => setTextureToolMipmaps(event.target.checked)} /> Generate full mip chain <span className="texture-tool-muted">(single mip is the UI default)</span></label>
						<div className="texture-tool-note">EDDS output uses native COPY blocks. BGRA8 preserves source pixels; DXT1/DXT5 use the built-in block compressor. In writable project-source mode, Project-tree conversions are saved beside the source image and resources are refreshed automatically.</div>
						{textureToolStatus && <div className="texture-tool-status">{textureToolStatus}</div>}
						<div className="texture-tool-actions">
							<button onClick={CloseTextureTool} disabled={textureToolBusy}>Close</button>
							<button className="primary" onClick={() => void ConvertTextureToEdds()} disabled={textureToolBusy || !textureToolFile}>{textureToolBusy ? "Converting…" : projectDirectoryHandleRef.current && textureToolProjectPath ? "Convert + Save to Project" : "Convert + Export"}</button>
						</div>
					</div>
				</div>
			)}

			{pendingLayoutOutput && (
				<NativeCompatibilityReview
					actionLabel={pendingLayoutOutput.action === "save" && localSourceMode ? "Save" : "Export"}
					warnings={nativeCompatibilityWarnings}
					onCancel={() => setPendingLayoutOutput(null)}
					onContinue={ContinueLayoutOutput}
				/>
			)}
			{imageSetInspector && <ImageSetInspector
				path={imageSetInspector.file.path}
				source={imageSetInspector.source}
				definition={imageSetInspector.definition}
				atlasUrl={imageSetInspector.atlasUrl}
				canSave={projectFileHandlesRef.current.has(imageSetInspector.file.path.toLowerCase())}
				onClose={() => setImageSetInspector(null)}
				onSave={async (nextSource) => {
					const handle = projectFileHandlesRef.current.get(imageSetInspector.file.path.toLowerCase());
					if (!handle)
						throw new Error("This imageset is read-only. Open the project with Project (Source) to save changes.");
					const writable = await handle.createWritable();
					await writable.write(nextSource);
					await writable.close();
					await RefreshWritableProjectIndex();
					const freshFile = await handle.getFile();
					const freshSource = await freshFile.text();
					const freshDefinition = ParseImageSetSource(imageSetInspector.file.path, freshSource);
					if (freshDefinition)
						setImageSetInspector((current) => current ? { ...current, source: freshSource, definition: freshDefinition, atlasUrl: ResolveImageSetAtlasUrl(project, freshDefinition) } : null);
				}}
			/>}
			{imageSetToolOpen && (
				<div className="modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !imageSetBusy) setImageSetToolOpen(false); }}>
					<div className="texture-tool-dialog imageset-tool-dialog">
						<div className="texture-tool-title">Imageset / Atlas Builder</div>
						<label className="texture-tool-file"><span>Source images</span><input type="file" multiple accept=".png,.tga,image/png" disabled={imageSetBusy} onChange={(event) => { const files = Array.from(event.target.files ?? []); setImageSetFiles(files); setImageSetFlags(Object.fromEntries(files.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, 0]))); setImageSetStatus(null); }} /><strong>{imageSetFiles.length ? `${imageSetFiles.length} image${imageSetFiles.length === 1 ? "" : "s"} selected` : "Choose PNG/TGA files"}</strong></label>
						<label className="texture-tool-row"><span>Imageset name</span><input value={imageSetName} disabled={imageSetBusy} onChange={(event) => setImageSetName(event.target.value)} /></label>
						{projectDirectoryHandleRef.current && <label className="texture-tool-row"><span>Project output folder</span><input value={imageSetOutputFolder} disabled={imageSetBusy} onChange={(event) => setImageSetOutputFolder(event.target.value)} placeholder="GUI/Imagesets" /></label>}
						<label className="texture-tool-row"><span>Atlas padding</span><input type="number" min="0" max="32" value={imageSetPadding} disabled={imageSetBusy} onChange={(event) => setImageSetPadding(Math.max(0, Math.min(32, Number(event.target.value) || 0)))} /></label>
						<label className="texture-tool-row"><span>Format</span><select value={imageSetFormat} disabled={imageSetBusy} onChange={(event) => setImageSetFormat(event.target.value as EddsPixelFormat)}><option value="bgra8">BGRA8 — lossless UI default</option><option value="dxt5">DXT5 / BC3 — alpha + compression</option><option value="dxt1">DXT1 / BC1 — compression, no smooth alpha</option></select></label>
						<label className="texture-tool-check"><input type="checkbox" checked={imageSetMipmaps} disabled={imageSetBusy} onChange={(event) => setImageSetMipmaps(event.target.checked)} /> Generate full mip chain <span className="texture-tool-muted">(single mip is the UI default)</span></label>
						<div className="texture-tool-note">Files are packed into power-of-two atlases capped at 4096×4096. If the sprites do not fit in one atlas, the builder automatically creates numbered sets such as Name_1, Name_2, etc. Sprite names come from filenames and are made unique automatically.</div>
						{imageSetFiles.length > 0 && <div className="imageset-file-list imageset-source-list">{imageSetFiles.map((file) => { const key = `${file.name}:${file.size}:${file.lastModified}`; const flags = imageSetFlags[key] ?? 0; return <div className="imageset-source-row" key={key}><span title={file.name}>{file.name}</span><label title="ISHorizontalTile"><input type="checkbox" checked={(flags & 1) !== 0} disabled={imageSetBusy} onChange={(event) => setImageSetFlags((current) => ({ ...current, [key]: event.target.checked ? flags | 1 : flags & ~1 }))} /> H Tile</label><label title="ISVerticalTile"><input type="checkbox" checked={(flags & 2) !== 0} disabled={imageSetBusy} onChange={(event) => setImageSetFlags((current) => ({ ...current, [key]: event.target.checked ? flags | 2 : flags & ~2 }))} /> V Tile</label><small>Flags {flags}</small></div>; })}</div>}
						{imageSetStatus && <div className="texture-tool-status">{imageSetStatus}</div>}
						<div className="texture-tool-actions"><button onClick={() => setImageSetToolOpen(false)} disabled={imageSetBusy}>Close</button><button className="primary" onClick={() => void BuildAtlasImageset()} disabled={imageSetBusy || imageSetFiles.length === 0}>{imageSetBusy ? "Building…" : projectDirectoryHandleRef.current ? "Build + Save to Project" : "Build + Export"}</button></div>
					</div>
				</div>
			)}

		</div>
	);
}
