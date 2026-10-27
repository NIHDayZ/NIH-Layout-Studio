import { SdfTextCanvas } from "../project/SdfTextCanvas";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { LayoutNode } from "../model/LayoutTypes";
import type { ProjectWorkspaceModel, WidgetStyleDefinition } from "../project/ProjectTypes";
import { ResolveProjectBitmapFont, ResolveProjectSdfFont, ResolveProjectFont, ResolveProjectImage, ResolveProjectWidgetStyle } from "../project/ProjectWorkspace";
import type { BitmapFontDefinition } from "../project/FntParser";
import {
	GetFlag,
	GetNodeProperty,
	IsRenderableNode,
	ParseColor,
	ResolveRect,
	ResolveTextStyle,
	type Rect
} from "../renderer/LayoutMath";

export interface CanvasDebugOptions {
	showBounds: boolean;
	showNames: boolean;
	showAnchors: boolean;
}

interface CanvasProps {
	nodes: LayoutNode[];
	selected: LayoutNode | null;
	selectedIds: string[];
	onSelect: (node: LayoutNode, additive?: boolean) => void;
	onGeometryChange: (node: LayoutNode, parent: Rect, rect: Rect) => void;
	width: number;
	height: number;
	zoom: number;
	debug: CanvasDebugOptions;
	project: ProjectWorkspaceModel | null;
	dependencyProjects: ProjectWorkspaceModel[];
	vanillaProject: ProjectWorkspaceModel | null;
	snapEnabled: boolean;
	snapSize: number;
	showGrid: boolean;
	onContextMenu: (node: LayoutNode, x: number, y: number) => void;
}


interface ResolvedWidgetStyle {
	definition: WidgetStyleDefinition;
	workspace: ProjectWorkspaceModel;
	source: "project" | "dependency" | "vanilla";
}

type WidgetVisualState = "normal" | "focus" | "disabled" | "pressed" | "hover";

function GetStyleItems(definition: WidgetStyleDefinition, state: WidgetVisualState): Map<string, string> {
	const aliases: Record<WidgetVisualState, string[]> = {
		normal: ["normal"],
		focus: ["focus", "focused", "selected"],
		disabled: ["disabled"],
		pressed: ["pressed", "clicked", "active", "down"],
		hover: ["hover", "mouseover", "highlight", "focused", "focus"]
	};
	for (const candidate of aliases[state]) {
		const items = definition.states.get(candidate);
		if (items)
			return items;
	}
	return definition.states.get("normal") ?? definition.normalItems;
}

function SelectVisualState(definition: WidgetStyleDefinition, disabled: boolean, pressed: boolean, hovered: boolean, focused: boolean): WidgetVisualState {
	if (disabled && definition.states.has("disabled"))
		return "disabled";
	if (pressed && ["pressed", "clicked", "active", "down"].some((name) => definition.states.has(name)))
		return "pressed";
	if (hovered && ["hover", "mouseover", "highlight"].some((name) => definition.states.has(name)))
		return "hover";
	if (focused && ["focus", "focused", "selected"].some((name) => definition.states.has(name)))
		return "focus";
	return "normal";
}

function ResolveWidgetStyle(node: LayoutNode, project: ProjectWorkspaceModel | null, dependencyProjects: ProjectWorkspaceModel[], vanillaProject: ProjectWorkspaceModel | null): ResolvedWidgetStyle | null {
	const styleName = GetNodeProperty(node, "style");
	if (!styleName)
		return null;
	const projectStyle = ResolveProjectWidgetStyle(project, node.type, styleName);
	if (project && projectStyle)
		return { definition: projectStyle, workspace: project, source: "project" };
	for (const dependency of dependencyProjects) {
		const style = ResolveProjectWidgetStyle(dependency, node.type, styleName);
		if (style)
			return { definition: style, workspace: dependency, source: "dependency" };
	}
	const vanillaStyle = ResolveProjectWidgetStyle(vanillaProject, node.type, styleName);
	if (vanillaProject && vanillaStyle)
		return { definition: vanillaStyle, workspace: vanillaProject, source: "vanilla" };
	return null;
}

function StyleColorModulation(color: number | null): [number, number, number, number] {
	if (color === null || !Number.isFinite(color))
		return [1, 1, 1, 1];
	const value = color >>> 0;
	return [((value >>> 16) & 255) / 255, ((value >>> 8) & 255) / 255, (value & 255) / 255, ((value >>> 24) & 255) / 255];
}

function MultiplyModulation(left: [number, number, number, number], right: [number, number, number, number]): [number, number, number, number] {
	return [left[0] * right[0], left[1] * right[1], left[2] * right[2], left[3] * right[3]];
}

function ModulationToCss(value: [number, number, number, number]) {
	return `rgba(${Math.round(value[0] * 255)}, ${Math.round(value[1] * 255)}, ${Math.round(value[2] * 255)}, ${value[3]})`;
}

interface RenderNodeProps {
	node: LayoutNode;
	forcedRect?: Rect;
	parent: Rect;
	selected: LayoutNode | null;
	selectedIds: string[];
	onSelect: (node: LayoutNode, additive?: boolean) => void;
	onGeometryChange: (node: LayoutNode, parent: Rect, rect: Rect) => void;
	zoom: number;
	debug: CanvasDebugOptions;
	project: ProjectWorkspaceModel | null;
	dependencyProjects: ProjectWorkspaceModel[];
	vanillaProject: ProjectWorkspaceModel | null;
	snapEnabled: boolean;
	snapSize: number;
	onContextMenu: (node: LayoutNode, x: number, y: number) => void;
}

function GetWidgetKind(node: LayoutNode) {
	const type = node.type.toLowerCase();
	return {
		isFrame: type.includes("framewidget"),
		isPanel: type.includes("panelwidget"),
		isText: type.includes("textwidget") || type.includes("richtextwidget") || type.includes("multilinetextwidget"),
		isButton: type.includes("buttonwidget"),
		isImage: type.includes("imagewidget"),
		isEditBox: type.includes("editboxwidget"),
		isComboBox: type.includes("comboboxwidget"),
		isCheckBox: type.includes("checkboxwidget"),
		isSlider: type.includes("sliderwidget"),
		isListBox: type.includes("listboxwidget"),
		isProgress: type.includes("progressbarwidget"),
		isSpacer: type.includes("spacerwidget"),
		isScroll: type.includes("scrollwidget"),
		isVideo: type.includes("videowidget"),
		isRenderTarget: type.includes("rendertargetwidget") || type.includes("rttexturewidget"),
		isMap: type.includes("mapwidget")
	};
}

function GetPanelBackground(node: LayoutNode): string | undefined {
	const color = ParseColor(GetNodeProperty(node, "color"));
	if (!color)
		return undefined;

	const style = (GetNodeProperty(node, "style") ?? "").toLowerCase();
	if (!style || style === "blank" || style === "empty")
		return style === "blank" || style === "empty" ? undefined : color;

	if (style.includes("colorable") || style.includes("panel") || style.includes("expansion"))
		return color;

	return color;
}

function GetImageCandidates(node: LayoutNode): string[] {
	const candidates: string[] = [];
	const image = GetNodeProperty(node, "image0");
	const texture = GetNodeProperty(node, "imageTexture");
	if (image && image.trim() && image.trim() !== '""')
		candidates.push(image);
	if (texture && texture.trim() && texture.trim() !== '""')
		candidates.push(texture);
	return candidates;
}

function BuildWidgetStyle(node: LayoutNode, rect: Rect, selected: boolean, debug: CanvasDebugOptions): CSSProperties {
	const kind = GetWidgetKind(node);
	const color = ParseColor(GetNodeProperty(node, "color"));
	const style: CSSProperties = {
		left: rect.x,
		top: rect.y,
		width: Math.max(0, rect.width),
		height: Math.max(0, rect.height),
		zIndex: Number(GetNodeProperty(node, "priority") ?? 0) + 1,
		overflow: GetFlag(node, "clipchildren") ? "hidden" : "visible"
	};

	if (kind.isPanel)
		style.background = GetPanelBackground(node);
	else if (kind.isButton) {
		const widgetStyle = (GetNodeProperty(node, "style") ?? "").toLowerCase();
		if (widgetStyle !== "empty" && widgetStyle !== "blank")
			style.background = color ?? "rgba(50, 68, 86, 0.78)";
	} else if (kind.isEditBox || kind.isComboBox || kind.isCheckBox || kind.isSlider || kind.isListBox) {
		style.background = "rgba(12, 18, 25, 0.72)";
		style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,.12)";
	} else if (kind.isProgress)
		style.background = "rgba(255,255,255,.08)";

	if (selected)
		style.outline = "2px solid #7dd3fc";
	else if (debug.showBounds)
		style.outline = "1px solid rgba(125,211,252,.28)";

	return style;
}

function MeasureBitmapLine(font: BitmapFontDefinition, text: string, scale: number) {
	let width = 0;
	let previous = -1;
	for (const character of Array.from(text)) {
		const codePoint = character.codePointAt(0) ?? 0;
		if (previous >= 0)
			width += (font.kerning.get(`${previous}:${codePoint}`) ?? 0) * scale;
		const glyph = font.glyphs.get(codePoint);
		width += (glyph?.advance ?? font.nominalSize * 0.5) * scale;
		previous = codePoint;
	}
	return width;
}

function RenderBitmapText(node: LayoutNode, rect: Rect, font: BitmapFontDefinition, color: string, textStyle = ResolveControlTextStyle(node, rect)) {
	const text = GetNodeProperty(node, "text") ?? "";
	const scale = Math.max(0.05, textStyle.fontSize / Math.max(1, font.nominalSize));
	const lineHeight = Math.max(1, font.lineHeight * scale);
	const lines = text.split("\n");
	const totalHeight = lines.length * lineHeight;
	let startY = 0;
	if (textStyle.vAlign === "center")
		startY = (rect.height - totalHeight) * 0.5;
	else if (textStyle.vAlign === "bottom")
		startY = rect.height - totalHeight;

	const glyphNodes = [];
	for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
		const line = lines[lineIndex];
		const lineWidth = MeasureBitmapLine(font, line, scale);
		let cursorX = textStyle.hAlign === "center" ? (rect.width - lineWidth) * 0.5 : textStyle.hAlign === "right" ? rect.width - lineWidth : 0;
		let previous = -1;
		for (const [characterIndex, character] of Array.from(line).entries()) {
			const codePoint = character.codePointAt(0) ?? 0;
			if (previous >= 0)
				cursorX += (font.kerning.get(`${previous}:${codePoint}`) ?? 0) * scale;
			const glyph = font.glyphs.get(codePoint);
			if (glyph && glyph.width > 0 && glyph.height > 0) {
				const width = glyph.width * scale;
				const height = glyph.height * scale;
				const left = cursorX + glyph.leftBearing * scale;
				const top = startY + lineIndex * lineHeight;
				const maskSize = `${font.atlasWidth * scale}px ${font.atlasHeight * scale}px`;
				const maskPosition = `${-glyph.x * scale}px ${-glyph.y * scale}px`;
				glyphNodes.push(
					<span key={`${lineIndex}-${characterIndex}`} className="bitmap-font-glyph" style={{
						left,
						top,
						width,
						height,
						backgroundColor: color,
						WebkitMaskImage: `url(${font.atlasUrl})`,
						maskImage: `url(${font.atlasUrl})`,
						WebkitMaskRepeat: "no-repeat",
						maskRepeat: "no-repeat",
						WebkitMaskSize: maskSize,
						maskSize,
						WebkitMaskPosition: maskPosition,
						maskPosition
					}} />
				);
			}
			cursorX += (glyph?.advance ?? font.nominalSize * 0.5) * scale;
			previous = codePoint;
		}
	}

	return <span className="widget-text bitmap-font-text">{glyphNodes}</span>;
}

function ResolveControlTextStyle(node: LayoutNode, rect: Rect, fontFamilyOverride?: string) {
	const textStyle = ResolveTextStyle(node, rect, fontFamilyOverride);
	const type = node.type.toLowerCase();
	const hasHAlign = GetNodeProperty(node, "text halign") !== undefined;
	const hasVAlign = GetNodeProperty(node, "text valign") !== undefined;

	// DayZ control widgets do not share TextWidget's left/top defaults. In particular,
	// ButtonWidget text is centered by default (the native API exposes dedicated
	// SetTextHorizontalAlignment/SetTextVerticalAlignment methods). Layouts often
	// rely on this and use leading spaces to reserve room for a sibling icon.
	if (type.includes("buttonwidget")) {
		if (!hasHAlign)
			textStyle.hAlign = "center";
		if (!hasVAlign)
			textStyle.vAlign = "center";
	} else if (type.includes("comboboxwidget") || type.includes("editboxwidget") || type.includes("checkboxwidget")) {
		if (!hasVAlign)
			textStyle.vAlign = "center";
	}

	return textStyle;
}

const experimentalFnt5Fit = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("experimentalFnt5Fit") === "1";
const debugTextResolution = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugFnt5Sampling") === "1";
const loggedTextRoutes = new Set<string>();
function RenderText(node: LayoutNode, rect: Rect, project: ProjectWorkspaceModel | null, dependencyProjects: ProjectWorkspaceModel[], vanillaProject: ProjectWorkspaceModel | null) {
	const text = GetNodeProperty(node, "text") ?? "";
	const resolvedStyle = ResolveWidgetStyle(node, project, dependencyProjects, vanillaProject);
	const styleColor = resolvedStyle ? ModulationToCss(StyleColorModulation(resolvedStyle.definition.color)) : undefined;
	const color = ParseColor(GetNodeProperty(node, "color")) ?? ParseColor(GetNodeProperty(node, "text color")) ?? styleColor ?? "white";
	const explicitFont = GetNodeProperty(node, "font");
	const styleFont = resolvedStyle?.definition.font?.trim() || undefined;
	const fontPath = explicitFont && explicitFont.trim() && explicitFont.trim() !== '""' ? explicitFont : styleFont;
	const fontOverride = ResolveProjectFont(project, fontPath) ?? dependencyProjects.map((dependency) => ResolveProjectFont(dependency, fontPath)).find(Boolean) ?? ResolveProjectFont(vanillaProject, fontPath);
	const textStyle = ResolveControlTextStyle(node, rect, fontOverride);

	// Resolve formats in each workspace before continuing to the next workspace.
	// A project FNT3 override must beat a dependency or vanilla SDF font.
	const workspaces = [project, ...dependencyProjects, vanillaProject];
	let sdfFont;
	let bitmapFont;
	for (const workspace of workspaces) {
		if (!workspace)
			continue;
		bitmapFont = ResolveProjectBitmapFont(workspace, fontPath);
		sdfFont = ResolveProjectSdfFont(workspace, fontPath);
		if (bitmapFont || sdfFont)
			break;
	}
	if (debugTextResolution && text.trim() && loggedTextRoutes.size < 100) {
		const route = sdfFont ? "SDF" : bitmapFont ? "FNT3 bitmap" : fontOverride ? "webfont" : "CSS fallback";
		const key = JSON.stringify([node.id, route, text, fontPath ?? null, sdfFont?.atlasUrl ?? null, bitmapFont?.atlasUrl ?? null, fontOverride ?? null]);
		if (!loggedTextRoutes.has(key)) {
			loggedTextRoutes.add(key);
			console.info("[NIH Layout Studio][Text route]", {
				widget: node.name, widgetId: node.id, text: text.slice(0, 100),
				fontPath: fontPath ?? null, route,
				resolvedSdf: sdfFont?.fnt5Name ?? null,
				resolvedBitmap: bitmapFont?.name ?? null,
				fontOverride: fontOverride ?? null,
				availableSdfFonts: workspaces.flatMap((ws, index) => ws ? Array.from(ws.sdfFonts.keys()).filter(key => !key.includes("/")).map(key => ({ workspace: index, name: key })) : []),
				availableBitmapFonts: workspaces.flatMap((ws, index) => ws ? Array.from(ws.bitmapFonts.keys()).filter(key => !key.includes("/")).map(key => ({ workspace: index, name: key })) : [])
			});
		}
	}
	if (sdfFont) {
		// Diagnostic only: compare nominal-size inference against a font size
		// that fits the widget. Explicit author-provided sizes remain untouched.
		const explicitTextSize = ["exact text size", "fontsize", "font size"].some((name) => {
			const value = Number(GetNodeProperty(node, name));
			return Number.isFinite(value) && value > 0;
		});
		const fittedSize = experimentalFnt5Fit && sdfFont.fnt5PixelMetrics && !explicitTextSize
			? Math.min(textStyle.fontSize, Math.max(1, rect.height * 0.8))
			: textStyle.fontSize;
		return <SdfTextCanvas resource={sdfFont} text={text} color={color} fontSize={fittedSize} width={rect.width} height={rect.height} hAlign={textStyle.hAlign} vAlign={textStyle.vAlign} wrap={GetNodeProperty(node, "wrap") !== "0"} shadowSize={textStyle.shadowSize} shadowOffsetX={textStyle.shadowOffsetX} shadowOffsetY={textStyle.shadowOffsetY} shadowColor={textStyle.shadowColor} />;
	}
	if (bitmapFont)
		return RenderBitmapText(node, rect, bitmapFont, color, textStyle);

	const justifyContent = textStyle.hAlign === "center" ? "center" : textStyle.hAlign === "right" ? "flex-end" : "flex-start";
	const alignItems = textStyle.vAlign === "center" ? "center" : textStyle.vAlign === "bottom" ? "flex-end" : "flex-start";
	const shadow = textStyle.shadowSize > 0
		? `${textStyle.shadowOffsetX}px ${textStyle.shadowOffsetY}px ${Math.max(1, textStyle.shadowSize / 4)}px ${textStyle.shadowColor ?? "rgba(0,0,0,.85)"}`
		: undefined;

	return (
		<span className="widget-text" style={{
			color,
			fontFamily: textStyle.fontFamily,
			fontSize: textStyle.fontSize,
			fontWeight: textStyle.fontWeight,
			justifyContent,
			alignItems,
			textAlign: textStyle.hAlign,
			textShadow: shadow
		}}>{text}</span>
	);
}


function ParseImageModulation(raw: string | undefined): [number, number, number, number] {
	if (!raw)
		return [1, 1, 1, 1];
	const parts = raw.trim().replace(/^"|"$/g, "").split(/\s+/).map(Number);
	const normalized = [0, 1, 2, 3].map((index) => {
		const value = Number.isFinite(parts[index]) ? parts[index] : 1;
		return Math.max(0, Math.min(1, value > 1 ? value / 255 : value));
	});
	return normalized as [number, number, number, number];
}

function IsNeutralImageModulation(modulation: [number, number, number, number]) {
	return modulation.every((value) => Math.abs(value - 1) < 0.0001);
}

function ModulatedImageSprite({
	resolved,
	destination,
	rect,
	modulation,
	description,
	showName
}: {
	resolved: NonNullable<ReturnType<typeof ResolveProjectImage>>;
	destination: CSSProperties;
	rect: Rect;
	modulation: [number, number, number, number];
	description: string;
	showName: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const destinationWidth = typeof destination.width === "number" ? destination.width : rect.width;
	const destinationHeight = typeof destination.height === "number" ? destination.height : rect.height;
	const pixelWidth = Math.max(1, Math.round(destinationWidth));
	const pixelHeight = Math.max(1, Math.round(destinationHeight));

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas)
			return;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context)
			return;
		let cancelled = false;
		const image = new Image();
		image.onload = () => {
			if (cancelled)
				return;
			canvas.width = pixelWidth;
			canvas.height = pixelHeight;
			context.clearRect(0, 0, pixelWidth, pixelHeight);
			if (resolved.atlasWidth === 1 && resolved.atlasHeight === 1)
				context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
			else
				context.drawImage(image, resolved.x, resolved.y, resolved.width, resolved.height, 0, 0, pixelWidth, pixelHeight);

			const [red, green, blue, alpha] = modulation;
			if (!IsNeutralImageModulation(modulation)) {
				const pixels = context.getImageData(0, 0, pixelWidth, pixelHeight);
				for (let i = 0; i < pixels.data.length; i += 4) {
					pixels.data[i] = Math.round(pixels.data[i] * red);
					pixels.data[i + 1] = Math.round(pixels.data[i + 1] * green);
					pixels.data[i + 2] = Math.round(pixels.data[i + 2] * blue);
					pixels.data[i + 3] = Math.round(pixels.data[i + 3] * alpha);
				}
				context.putImageData(pixels, 0, 0);
			}
		};
		image.src = resolved.url;
		return () => { cancelled = true; };
	}, [resolved.url, resolved.x, resolved.y, resolved.width, resolved.height, resolved.atlasWidth, resolved.atlasHeight, pixelWidth, pixelHeight, modulation[0], modulation[1], modulation[2], modulation[3]]);

	return (
		<div className="resolved-image" style={destination} title={description}>
			<canvas ref={canvasRef} className="resolved-image-canvas" style={{ width: "100%", height: "100%", display: "block" }} />
			{showName && <span className="resolved-image-label">{description}</span>}
		</div>
	);
}


function ResolveStyleImage(imageSet: string | null, imageName: string, project: ProjectWorkspaceModel | null, dependencyProjects: ProjectWorkspaceModel[], vanillaProject: ProjectWorkspaceModel | null) {
	if (!imageSet || !imageName)
		return null;
	const reference = `set:${imageSet} image:${imageName}`;
	return ResolveProjectImage(project, reference) ?? dependencyProjects.map((dependency) => ResolveProjectImage(dependency, reference)).find(Boolean) ?? ResolveProjectImage(vanillaProject, reference);
}

function RenderStyleChrome(node: LayoutNode, rect: Rect, visualState: WidgetVisualState, project: ProjectWorkspaceModel | null, dependencyProjects: ProjectWorkspaceModel[], vanillaProject: ProjectWorkspaceModel | null) {
	const resolvedStyle = ResolveWidgetStyle(node, project, dependencyProjects, vanillaProject);
	if (!resolvedStyle)
		return null;
	const definition = resolvedStyle.definition;
	const stateItems = GetStyleItems(definition, visualState);
	if (!definition.imageSet || stateItems.size === 0)
		return null;

	const names = ["lefttop", "top", "righttop", "right", "rightbottom", "bottom", "leftbottom", "left", "center"] as const;
	const pieces = new Map<string, NonNullable<ReturnType<typeof ResolveProjectImage>>>();
	for (const name of names) {
		const imageName = stateItems.get(name) ?? "";
		const image = ResolveStyleImage(definition.imageSet, imageName, project, dependencyProjects, vanillaProject);
		if (image)
			pieces.set(name, image);
	}
	if (pieces.size === 0)
		return null;

	const maxWidth = (...keys: string[]) => Math.max(0, ...keys.map((key) => pieces.get(key)?.logicalWidth ?? pieces.get(key)?.width ?? 0));
	const maxHeight = (...keys: string[]) => Math.max(0, ...keys.map((key) => pieces.get(key)?.logicalHeight ?? pieces.get(key)?.height ?? 0));
	let left = maxWidth("lefttop", "left", "leftbottom");
	let right = maxWidth("righttop", "right", "rightbottom");
	let top = maxHeight("lefttop", "top", "righttop");
	let bottom = maxHeight("leftbottom", "bottom", "rightbottom");
	if (left + right > rect.width && left + right > 0) {
		const scale = rect.width / (left + right);
		left *= scale;
		right *= scale;
	}
	if (top + bottom > rect.height && top + bottom > 0) {
		const scale = rect.height / (top + bottom);
		top *= scale;
		bottom *= scale;
	}
	const middleWidth = Math.max(0, rect.width - left - right);
	const middleHeight = Math.max(0, rect.height - top - bottom);
	const destinations: Record<string, CSSProperties> = {
		lefttop: { position: "absolute", left: 0, top: 0, width: left, height: top },
		top: { position: "absolute", left, top: 0, width: middleWidth, height: top },
		righttop: { position: "absolute", right: 0, top: 0, width: right, height: top },
		left: { position: "absolute", left: 0, top, width: left, height: middleHeight },
		center: { position: "absolute", left, top, width: middleWidth, height: middleHeight },
		right: { position: "absolute", right: 0, top, width: right, height: middleHeight },
		leftbottom: { position: "absolute", left: 0, bottom: 0, width: left, height: bottom },
		bottom: { position: "absolute", left, bottom: 0, width: middleWidth, height: bottom },
		rightbottom: { position: "absolute", right: 0, bottom: 0, width: right, height: bottom }
	};
	const widgetModulation = ParseImageModulation(GetNodeProperty(node, "color"));
	const styleModulation = StyleColorModulation(definition.color);
	const modulation = MultiplyModulation(styleModulation, widgetModulation);

	return (
		<div className="widget-style-chrome" title={`${definition.name} — ${visualState} — ${resolvedStyle.source}`}>
			{names.map((name) => {
				const image = pieces.get(name);
				const destination = destinations[name];
				if (!image || !destination || Number(destination.width ?? 0) <= 0 || Number(destination.height ?? 0) <= 0)
					return null;
				return <ModulatedImageSprite key={name} resolved={image} destination={destination} rect={rect} modulation={modulation} description={`${definition.imageSet}:${stateItems.get(name) ?? name}`} showName={false} />;
			})}
		</div>
	);
}

function GetImageDestination(node: LayoutNode, rect: Rect, sourceWidth: number, sourceHeight: number): CSSProperties {
	const fixAspect = (GetNodeProperty(node, "fixaspect") ?? "").toLowerCase();
	if (!fixAspect || sourceWidth <= 0 || sourceHeight <= 0 || rect.width <= 0 || rect.height <= 0)
		return { position: "absolute", inset: 0 };

	const sourceAspect = sourceWidth / sourceHeight;
	let width = rect.width;
	let height = rect.height;

	if (fixAspect.includes("inside")) {
		if (rect.width / rect.height > sourceAspect)
			width = rect.height * sourceAspect;
		else
			height = rect.width / sourceAspect;
	} else if (fixAspect.includes("fixwidth")) {
		height = rect.width / sourceAspect;
	} else if (fixAspect.includes("fixheight")) {
		width = rect.height * sourceAspect;
	} else {
		return { position: "absolute", inset: 0 };
	}

	return {
		position: "absolute",
		left: (rect.width - width) * 0.5,
		top: (rect.height - height) * 0.5,
		width,
		height
	};
}

function RenderWidgetContent(node: LayoutNode, rect: Rect, visualState: WidgetVisualState, debug: CanvasDebugOptions, project: ProjectWorkspaceModel | null, dependencyProjects: ProjectWorkspaceModel[], vanillaProject: ProjectWorkspaceModel | null) {
	const kind = GetWidgetKind(node);
	if (kind.isText || kind.isButton || kind.isEditBox || kind.isComboBox)
		return RenderText(node, rect, project, dependencyProjects, vanillaProject);

	if (kind.isImage) {
		const candidates = GetImageCandidates(node);
		const description = candidates[0] ?? null;
		if (!description)
			return debug.showNames ? <span className="resource-placeholder">ImageWidget</span> : null;
		let resolved = null;
		for (const candidate of candidates) {
			resolved = ResolveProjectImage(project, candidate) ?? dependencyProjects.map((dependency) => ResolveProjectImage(dependency, candidate)).find(Boolean) ?? ResolveProjectImage(vanillaProject, candidate);
			if (resolved)
				break;
		}
		if (resolved) {
			const destination = GetImageDestination(node, rect, resolved.width, resolved.height);
			const modulation = ParseImageModulation(GetNodeProperty(node, "color"));
			if (!IsNeutralImageModulation(modulation))
				return <ModulatedImageSprite resolved={resolved} destination={destination} rect={rect} modulation={modulation} description={description} showName={debug.showNames} />;

			const isDirect = resolved.atlasWidth === 1 && resolved.atlasHeight === 1;
			const destinationWidth = typeof destination.width === "number" ? destination.width : rect.width;
			const destinationHeight = typeof destination.height === "number" ? destination.height : rect.height;
			const imageStyle: CSSProperties = isDirect
				? { ...destination, backgroundImage: `url(${resolved.url})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }
				: {
					...destination,
					backgroundImage: `url(${resolved.url})`,
					backgroundRepeat: "no-repeat",
					backgroundSize: `${destinationWidth * resolved.atlasWidth / Math.max(1, resolved.width)}px ${destinationHeight * resolved.atlasHeight / Math.max(1, resolved.height)}px`,
					backgroundPosition: `${-resolved.x * destinationWidth / Math.max(1, resolved.width)}px ${-resolved.y * destinationHeight / Math.max(1, resolved.height)}px`
				};
			return <div className="resolved-image" style={imageStyle} title={description}>{debug.showNames && <span className="resolved-image-label">{description}</span>}</div>;
		}
		return (
			<div className="image-placeholder" title={description}>
				{debug.showNames && <span>{description}</span>}
			</div>
		);
	}

	if (kind.isProgress) {
		const minimumRaw = Number(GetNodeProperty(node, "minimum") ?? 0);
		const maximumRaw = Number(GetNodeProperty(node, "maximum") ?? 1);
		const currentRaw = Number(GetNodeProperty(node, "current") ?? GetNodeProperty(node, "Progress") ?? minimumRaw);
		const minimum = Number.isFinite(minimumRaw) ? minimumRaw : 0;
		const maximum = Number.isFinite(maximumRaw) ? maximumRaw : 1;
		const current = Number.isFinite(currentRaw) ? currentRaw : minimum;
		const range = maximum - minimum;
		const progress = Math.max(0, Math.min(1, Math.abs(range) > 0.000001 ? (current - minimum) / range : 0));
		const vertical = GetFlag(node, "vertical");
		const flipped = GetFlag(node, "flipped");
		const fillStyle: CSSProperties = vertical
			? { width: "100%", height: `${progress * 100}%`, top: flipped ? 0 : "auto", bottom: flipped ? "auto" : 0 }
			: { height: "100%", width: `${progress * 100}%`, left: flipped ? "auto" : 0, right: flipped ? 0 : "auto" };
		const resolvedStyle = ResolveWidgetStyle(node, project, dependencyProjects, vanillaProject);
		const barImageName = resolvedStyle ? GetStyleItems(resolvedStyle.definition, visualState).get("barcenter") ?? "" : "";
		const barImage = resolvedStyle ? ResolveStyleImage(resolvedStyle.definition.imageSet, barImageName, project, dependencyProjects, vanillaProject) : null;
		if (barImage && resolvedStyle) {
			const modulation = MultiplyModulation(StyleColorModulation(resolvedStyle.definition.color), ParseImageModulation(GetNodeProperty(node, "color")));
			return (
				<div className="progress-fill styled-progress-fill" style={fillStyle}>
					<ModulatedImageSprite resolved={barImage} destination={{ position: "absolute", inset: 0 }} rect={rect} modulation={modulation} description={`${resolvedStyle.definition.imageSet}:${barImageName}`} showName={false} />
				</div>
			);
		}
		return <div className="progress-fill" style={fillStyle} />;
	}

	if (kind.isMap && debug.showNames)
		return <div className="map-placeholder">MapWidget</div>;

	return null;
}

function AnchorOverlay({ node }: { node: LayoutNode }) {
	const hAlign = (GetNodeProperty(node, "halign") ?? "left").toLowerCase();
	const vAlign = (GetNodeProperty(node, "valign") ?? "top").toLowerCase();
	const x = hAlign.includes("right") ? "100%" : hAlign.includes("center") ? "50%" : "0%";
	const y = vAlign.includes("bottom") ? "100%" : vAlign.includes("center") ? "50%" : "0%";
	return <span className="anchor-dot" style={{ left: x, top: y }} />;
}

function GetSpacerDirection(node: LayoutNode): "row" | "column" {
	const orientation = (GetNodeProperty(node, "orientation") ?? GetNodeProperty(node, "Orientation") ?? "").toLowerCase();
	if (orientation.includes("horizontal") || orientation === "h" || orientation === "0")
		return "row";
	return "column";
}

function GetSpacerGap(node: LayoutNode): number {
	const raw = Number(GetNodeProperty(node, "Spacing") ?? GetNodeProperty(node, "spacing") ?? GetNodeProperty(node, "Gap") ?? 0);
	return Number.isFinite(raw) ? Math.max(0, raw) : 0;
}

function RenderChildren(node: LayoutNode, rect: Rect, selected: LayoutNode | null, selectedIds: string[], onSelect: (node: LayoutNode, additive?: boolean) => void, onGeometryChange: RenderNodeProps["onGeometryChange"], zoom: number, debug: CanvasDebugOptions, project: ProjectWorkspaceModel | null, dependencyProjects: ProjectWorkspaceModel[], vanillaProject: ProjectWorkspaceModel | null, snapEnabled: boolean, snapSize: number, onContextMenu: RenderNodeProps["onContextMenu"]) {
	const kind = GetWidgetKind(node);
	const childParent: Rect = { x: 0, y: 0, width: Math.max(0, rect.width), height: Math.max(0, rect.height) };

	if (!kind.isSpacer)
		return node.children.map((child, index) => (
			<RenderNode key={`${child.name}-${index}`} node={child} parent={childParent} selected={selected} selectedIds={selectedIds} onSelect={onSelect} onGeometryChange={onGeometryChange} zoom={zoom} debug={debug} project={project} dependencyProjects={dependencyProjects} vanillaProject={vanillaProject} snapEnabled={snapEnabled} snapSize={snapSize} onContextMenu={onContextMenu} />
		));

	// Spacer widgets own child layout on the native side. Approximate that here
	// rather than interpreting every child position as an independent absolute
	// coordinate. This is especially important for runtime-populated WrapSpacer
	// and GridSpacer containers inside ScrollWidget.
	const direction = GetSpacerDirection(node);
	const gap = GetSpacerGap(node);
	let cursor = 0;
	return node.children.map((child, index) => {
		const natural = ResolveRect(child, childParent);
		let childRect = natural;
		if (direction === "column") {
			const height = natural.height > 0 ? natural.height : childParent.height;
			childRect = { x: natural.x, y: cursor, width: natural.width, height };
			cursor += height + gap;
		} else {
			const width = natural.width > 0 ? natural.width : childParent.width;
			childRect = { x: cursor, y: natural.y, width, height: natural.height };
			cursor += width + gap;
		}
		return <RenderNode key={`${child.name}-${index}`} node={child} parent={{ x: childRect.x, y: childRect.y, width: childRect.width, height: childRect.height }} forcedRect={childRect} selected={selected} selectedIds={selectedIds} onSelect={onSelect} onGeometryChange={onGeometryChange} zoom={zoom} debug={debug} project={project} dependencyProjects={dependencyProjects} vanillaProject={vanillaProject} snapEnabled={snapEnabled} snapSize={snapSize} onContextMenu={onContextMenu} />;
	});
}

function RenderNode({ node, parent, forcedRect, selected, selectedIds, onSelect, onGeometryChange, zoom, debug, project, dependencyProjects, vanillaProject, snapEnabled, snapSize, onContextMenu }: RenderNodeProps) {
	if (!IsRenderableNode(node))
		return null;
	if (GetNodeProperty(node, "visible") === "0")
		return null;

	const resolvedRect = forcedRect ?? ResolveRect(node, parent);
	const [dragRect, setDragRect] = useState<Rect | null>(null);
	const [hovered, setHovered] = useState(false);
	const [pressed, setPressed] = useState(false);
	const rect = dragRect ?? resolvedRect;
	const kind = GetWidgetKind(node);
	const isSelected = selected?.id === node.id;
	const isMultiSelected = selectedIds.includes(node.id);
	const resolvedWidgetStyle = ResolveWidgetStyle(node, project, dependencyProjects, vanillaProject);
	const disabled = GetFlag(node, "disabled");
	const visualState = resolvedWidgetStyle ? SelectVisualState(resolvedWidgetStyle.definition, disabled, pressed, hovered, isSelected) : "normal";
	const style = BuildWidgetStyle(node, rect, isSelected, debug);
	if (!isSelected && isMultiSelected)
		style.outline = "1px dashed #5aa7d7";
	if (kind.isScroll)
		style.overflow = "hidden";

	function BeginGeometryDrag(event: ReactPointerEvent<HTMLElement>, handle: string) {
		if (event.button !== 0)
			return;
		event.preventDefault();
		event.stopPropagation();
		setPressed(true);
		if (event.ctrlKey || event.metaKey) {
			onSelect(node, true);
			return;
		}
		onSelect(node, false);
		const startX = event.clientX;
		const startY = event.clientY;
		const start = { ...resolvedRect };
		let latest = start;

		function OnMove(moveEvent: PointerEvent) {
			const dx = (moveEvent.clientX - startX) / Math.max(0.01, zoom);
			const dy = (moveEvent.clientY - startY) / Math.max(0.01, zoom);
			let x = start.x;
			let y = start.y;
			let width = start.width;
			let height = start.height;
			if (handle === "move") {
				x += dx;
				y += dy;
			} else {
				if (handle.includes("e")) width = Math.max(2, start.width + dx);
				if (handle.includes("s")) height = Math.max(2, start.height + dy);
				if (handle.includes("w")) { x = start.x + dx; width = Math.max(2, start.width - dx); if (width === 2) x = start.x + start.width - 2; }
				if (handle.includes("n")) { y = start.y + dy; height = Math.max(2, start.height - dy); if (height === 2) y = start.y + start.height - 2; }
			}
			if (snapEnabled && snapSize > 0) {
				const Snap = (value: number) => Math.round(value / snapSize) * snapSize;
				if (handle === "move") {
					x = Snap(x);
					y = Snap(y);
				} else {
					if (handle.includes("w")) x = Snap(x);
					if (handle.includes("n")) y = Snap(y);
					if (handle.includes("e") || handle.includes("w")) width = Math.max(2, Snap(width));
					if (handle.includes("s") || handle.includes("n")) height = Math.max(2, Snap(height));
				}
			}
			latest = { x, y, width, height };
			setDragRect(latest);
		}

		function OnUp() {
			setPressed(false);
			window.removeEventListener("pointermove", OnMove);
			window.removeEventListener("pointerup", OnUp);
			setDragRect(null);
			if (latest.x !== start.x || latest.y !== start.y || latest.width !== start.width || latest.height !== start.height)
				onGeometryChange(node, parent, latest);
		}

		window.addEventListener("pointermove", OnMove);
		window.addEventListener("pointerup", OnUp);
	}

	return (
		<div
			className={`canvas-widget ${kind.isFrame ? "frame-widget" : ""} ${kind.isPanel ? "panel-widget" : ""} ${kind.isText ? "text-widget" : ""} ${kind.isButton ? "button-widget" : ""} ${kind.isImage ? "image-widget" : ""} ${kind.isSpacer ? "spacer-widget" : ""} ${kind.isScroll ? "scroll-widget" : ""} ${isSelected ? "editor-selected" : ""}`}
			style={style}
			onPointerDown={(event) => BeginGeometryDrag(event, "move")}
			onPointerEnter={() => setHovered(true)}
			onPointerLeave={() => { setHovered(false); setPressed(false); }}
			onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(node, false); onContextMenu(node, event.clientX, event.clientY); }}
		>
			{RenderStyleChrome(node, rect, visualState, project, dependencyProjects, vanillaProject)}
			{RenderWidgetContent(node, rect, visualState, debug, project, dependencyProjects, vanillaProject)}
			{debug.showNames && isSelected && <span className="widget-name-badge">{node.name}</span>}
			{debug.showAnchors && isSelected && <AnchorOverlay node={node} />}
			{RenderChildren(node, rect, selected, selectedIds, onSelect, onGeometryChange, zoom, debug, project, dependencyProjects, vanillaProject, snapEnabled, snapSize, onContextMenu)}
			{isSelected && (
				<>
					{["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => (
						<span key={handle} className={`resize-handle resize-${handle}`} onPointerDown={(event) => BeginGeometryDrag(event, handle)} />
					))}
				</>
			)}
		</div>
	);
}

export function Canvas({ nodes, selected, selectedIds, onSelect, onGeometryChange, width, height, zoom, debug, project, dependencyProjects, vanillaProject, snapEnabled, snapSize, showGrid, onContextMenu }: CanvasProps) {
	const root: Rect = { x: 0, y: 0, width, height };
	return (
		<div className="canvas-shell">
			<div className={`canvas ${showGrid ? "canvas-grid" : ""}`} style={{ width, height, ...(showGrid ? { ["--grid-size" as string]: `${snapSize}px` } : {}) }} onMouseDown={() => undefined}>
				{nodes.map((node, index) => (
					<RenderNode
						key={`${node.name}-${index}`}
						node={node}
						parent={root}
						selected={selected}
						selectedIds={selectedIds}
						onSelect={onSelect}
						onGeometryChange={onGeometryChange}
						zoom={zoom}
						debug={debug}
						project={project}
						dependencyProjects={dependencyProjects}
						vanillaProject={vanillaProject}
						snapEnabled={snapEnabled}
						snapSize={snapSize}
						onContextMenu={onContextMenu}
					/>
				))}
			</div>
		</div>
	);
}
