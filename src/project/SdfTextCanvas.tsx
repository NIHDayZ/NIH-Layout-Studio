import { useEffect, useRef } from "react";
import type { SdfGlyphMetric } from "./Fnt5Metadata";
import type { SdfFontResource } from "./SdfFontResource";
export type { SdfFontResource } from "./SdfFontResource";
import { SdfGlyphAdvance } from "./SdfRasterMath";
import { ResolveSdfGlyphAtlasSample, ResolveSdfGlyphCacheKey, RasterizeSdfGlyphAlpha } from "./SdfGlyphRasterPlan";
import { ResolveSdfGlyphDrawPlan } from "./SdfGlyphDrawPlan";
import { ResolveExperimentalFnt5LineOrigin } from "../renderer/engine/Fnt5LineOriginExperiment";
import { ReadFnt5ResearchOptions } from "../renderer/engine/Fnt5ResearchOptions";
import { WrapPreviewText } from "../renderer/engine/TextFlow";

interface CachedAtlas {
 source: HTMLCanvasElement;
 sourceContext: CanvasRenderingContext2D;
 glyphs: Map<string, HTMLCanvasElement>;
}
const atlases = new WeakMap<SdfFontResource, Promise<CachedAtlas>>();
// Preserve the original module-initialization snapshot and opt-in semantics.
const {
	cells: experimentalFnt5Cells,
	placement: experimentalFnt5Placement,
	cellLayout: experimentalFnt5CellLayout,
	lineOrigin: experimentalFnt5LineOrigin,
	debugClip: debugFnt5Clip,
	debugSampling: debugFnt5Sampling,
	msdf: experimentalMsdf,
	msdfSmoothing: experimentalMsdfSmoothing,
	msdfStroke: experimentalMsdfStroke
} = ReadFnt5ResearchOptions();
const loggedGlyphs = new Set<string>();
const loggedWidgets = new Set<string>();
const loggedPlacements = new Set<string>();
const resourceIds = new WeakMap<SdfFontResource, number>();
let nextResourceId = 1;
function ResourceId(resource: SdfFontResource): number {
 let id = resourceIds.get(resource);
 if (id === undefined) {
  id = nextResourceId++;
  resourceIds.set(resource, id);
 }
 return id;
}
function LogFnt5Placement(resource: SdfFontResource, glyph: SdfGlyphMetric, character: string, mode: string, requestedFontSize: number, penX: number, baseY: number, drawX: number, drawY: number, drawWidth: number, drawHeight: number, widgetWidth: number, widgetHeight: number, clipPadding: number, sprite: HTMLCanvasElement) {
 if (!debugFnt5Sampling || loggedPlacements.size >= 120)
  return;
 const key = JSON.stringify([ResourceId(resource), glyph.codePoint, mode, requestedFontSize, widgetWidth, widgetHeight, baseY, penX]);
 if (loggedPlacements.has(key))
  return;
 loggedPlacements.add(key);
 // The atlas cell includes MSDF padding, so its draw rectangle alone is not an ink-clipping test.
 const pixels = sprite.getContext("2d", { willReadFrequently: true })?.getImageData(0, 0, sprite.width, sprite.height);
 let minX = sprite.width, minY = sprite.height, maxX = -1, maxY = -1;
 if (pixels) {
  for (let y = 0; y < sprite.height; ++y) {
   for (let x = 0; x < sprite.width; ++x) {
    if (pixels.data[(y * sprite.width + x) * 4 + 3] <= 128)
     continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
   }
  }
 }
 const inkRect = maxX >= minX && maxY >= minY
  ? { x: drawX + minX * drawWidth / sprite.width, y: drawY + minY * drawHeight / sprite.height,
     width: (maxX + 1 - minX) * drawWidth / sprite.width, height: (maxY + 1 - minY) * drawHeight / sprite.height }
  : null;
 const inkOutsideWidget = inkRect
  ? inkRect.x < 0 || inkRect.y < 0 || inkRect.x + inkRect.width > widgetWidth || inkRect.y + inkRect.height > widgetHeight
  : null;
 const details = {
  font: resource.fnt5Name ?? resource.metadata.fontFile,
  character, codePoint: glyph.codePoint, mode,
  nominalFontSize: resource.metadata.fontSize, requestedFontSize,
  metric: { width: glyph.width, height: glyph.height, bearingX: glyph.bearingX, bearingY: glyph.bearingY, advance: glyph.advance },
  penX, baseY,
  drawRect: { x: drawX, y: drawY, width: drawWidth, height: drawHeight },
  inkRect,
  widgetRect: { x: 0, y: 0, width: widgetWidth, height: widgetHeight },
  cellOutsideWidget: drawX < 0 || drawY < 0 || drawX + drawWidth > widgetWidth || drawY + drawHeight > widgetHeight,
  inkOutsideWidget,
  inkThreshold: 128,
  debugExpandedCanvas: clipPadding > 0
 };
 console.info("[NIH Layout Studio][FNT5 placement] " + JSON.stringify(details));
}
function LoadAtlas(resource: SdfFontResource): Promise<CachedAtlas> {
 const existing = atlases.get(resource);
 if (existing)
  return existing;
 const task = new Promise<CachedAtlas>((resolve, reject) => {
  const image = new Image();
  image.onerror = () => reject(new Error("Unable to load SDF atlas"));
  image.onload = () => {
   const source = document.createElement("canvas");
   source.width = image.naturalWidth;
   source.height = image.naturalHeight;
   const ctx = source.getContext("2d", { willReadFrequently: true });
   if (!ctx) { reject(new Error("SDF canvas context unavailable")); return; }
   ctx.drawImage(image, 0, 0);
   resolve({ source, sourceContext: ctx, glyphs: new Map() });
  };
  image.src = resource.atlasUrl;
 });
 atlases.set(resource, task);
 void task.catch(() => { if (atlases.get(resource) === task) atlases.delete(resource); });
 return task;
}
function RasterGlyph(resource: SdfFontResource, atlas: CachedAtlas, glyph: SdfGlyphMetric, displayedFontSize: number): HTMLCanvasElement | null {
 const cacheKey = ResolveSdfGlyphCacheKey(glyph.codePoint, displayedFontSize, experimentalMsdf, experimentalMsdfSmoothing, experimentalMsdfStroke);
 const cached = atlas.glyphs.get(cacheKey);
 if (cached)
  return cached;
 const sample = ResolveSdfGlyphAtlasSample({
  nativeOrigin: resource.fnt5Origins?.get(glyph.codePoint),
  useExperimentalCells: experimentalFnt5Cells,
  hasFnt5PixelMetrics: !!resource.fnt5PixelMetrics,
  fnt5CellSize: resource.fnt5CellSize,
  fnt5Name: resource.fnt5Name,
  nominalFontSize: resource.metadata.fontSize,
  charScale: resource.metadata.charScale,
  glyphX: glyph.x,
  glyphY: glyph.y,
  referenceAtlasWidth: resource.metadata.atlasWidth,
  atlasWidth: atlas.source.width,
  atlasHeight: atlas.source.height
 });
 const { rect, origin } = sample;
 if (debugFnt5Sampling && loggedGlyphs.size < 120) {
  const key = ResourceId(resource) + ":" + glyph.codePoint + ":" + experimentalFnt5Cells + ":" + experimentalMsdf;
  if (!loggedGlyphs.has(key)) {
   loggedGlyphs.add(key);
   console.info("[NIH Layout Studio][FNT5 sampling]", {
    font: resource.fnt5Name ?? resource.metadata.fontFile,
    resourceId: ResourceId(resource),
    codePoint: glyph.codePoint,
    character: String.fromCodePoint(glyph.codePoint),
    atlas: [atlas.source.width, atlas.source.height],
    referenceAtlas: [resource.metadata.atlasWidth, resource.metadata.atlasHeight],
    fontSize: resource.metadata.fontSize,
    fnt5OriginsCount: resource.fnt5Origins?.size ?? 0,
    origin: origin ?? null,
    selected: sample.selected,
    rectangle: rect,
    msdf: experimentalMsdf
   });
  }
 }
 if (!rect || rect.left < 0 || rect.top < 0 || rect.left + rect.size > atlas.source.width || rect.top + rect.size > atlas.source.height)
  return null;
 const { left: sourceX, top: sourceY, size: cell } = rect;
 // The atlas source context was validated during LoadAtlas, so reuse it
 // instead of looking up the same 2D context for every newly cached glyph.
 const pixels = atlas.sourceContext.getImageData(sourceX, sourceY, cell, cell);
 RasterizeSdfGlyphAlpha(pixels.data, {
  msdf: experimentalMsdf,
  smoothing: experimentalMsdfSmoothing,
  stroke: experimentalMsdfStroke,
  inverted: resource.metadata.inverted,
  displayedFontSize,
  nominalFontSize: resource.metadata.fontSize
 });
 const canvas = document.createElement("canvas");
 canvas.width = cell;
 canvas.height = cell;
 canvas.getContext("2d")?.putImageData(pixels, 0, 0);
 atlas.glyphs.set(cacheKey, canvas);
 return canvas;
}
export function SdfTextCanvas({ resource, text, color, fontSize, width, height, hAlign, vAlign, wrap, shadowSize, shadowOffsetX, shadowOffsetY, shadowColor }: {
 resource: SdfFontResource;
 text: string;
 color: string;
 fontSize: number;
 width: number;
 height: number;
 hAlign: string;
 vAlign: string;
 wrap: boolean;
 shadowSize: number;
 shadowOffsetX: number;
 shadowOffsetY: number;
 shadowColor: string | undefined;
}) {
 const canvasRef = useRef<HTMLCanvasElement>(null);
 useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas)
   return;
  let cancelled = false;
  if (debugFnt5Sampling && loggedWidgets.size < 40) {
   const key = JSON.stringify([ResourceId(resource), text, fontSize, width, height, hAlign, vAlign]);
   if (!loggedWidgets.has(key)) {
    loggedWidgets.add(key);
    console.info("[NIH Layout Studio][SDF widget]", { font: resource.fnt5Name ?? resource.metadata.fontFile, resourceId: ResourceId(resource), text: text.slice(0, 120), originCount: resource.fnt5Origins?.size ?? 0, experimentalFnt5Cells, experimentalMsdf, placementMode: resource.fnt5PixelMetrics && resource.fnt5CellSize ? (experimentalFnt5CellLayout ? "cell" : experimentalFnt5Placement ? "bearing" : "legacy") : "legacy", requestedFontSize: fontSize, nominalFontSize: resource.metadata.fontSize, widgetSize: [width, height], hAlign, vAlign, debugExpandedCanvas: debugFnt5Clip && !!resource.fnt5PixelMetrics });
   }
  }
  void LoadAtlas(resource).then((atlas) => {
   if (cancelled)
    return;
   const context = canvas.getContext("2d");
   if (!context)
    return;
   const clipPadding = debugFnt5Clip && resource.fnt5PixelMetrics ? Math.min(256, Math.max(80, Math.ceil(fontSize * 1.5))) : 0;
   const pixelWidth = Math.max(1, Math.ceil(width) + clipPadding * 2);
   const pixelHeight = Math.max(1, Math.ceil(height) + clipPadding * 2);
   canvas.width = pixelWidth;
   canvas.height = pixelHeight;
   const meta = resource.metadata;
   const scale = fontSize / meta.fontSize;
   const advance = (value: string) => Array.from(value).reduce((sum, letter) => {
    const glyph = resource.glyphs.get(letter.codePointAt(0) ?? 0);
    return sum + (glyph ? (resource.fnt5PixelMetrics ? glyph.advance * scale : SdfGlyphAdvance(glyph.advance, fontSize)) : fontSize / 2);
   }, 0);
   const lines = WrapPreviewText(text, width, advance, wrap);
   const lineHeight = fontSize * 1.25;
   let baseY = vAlign === "center" ? (height - lines.length * lineHeight) / 2 : vAlign === "bottom" ? height - lines.length * lineHeight : 0;
   // Research-only shared origin; does not affect default rendering or multiline text.
   baseY = ResolveExperimentalFnt5LineOrigin(experimentalFnt5LineOrigin, height, baseY, !!resource.fnt5PixelMetrics, lines.length);
   const initialBaseY = baseY;
   // Render a tinted text layer first, then composite its shadow behind it.
   const layer = document.createElement("canvas");
   layer.width = pixelWidth;
   layer.height = pixelHeight;
   const ink = layer.getContext("2d");
   if (!ink)
    return;
   if (clipPadding)
    ink.translate(clipPadding, clipPadding);
   for (const line of lines) {
    let penX = hAlign === "center" ? (width - advance(line)) / 2 : hAlign === "right" ? width - advance(line) : 0;
    for (const character of Array.from(line)) {
     const glyph = resource.glyphs.get(character.codePointAt(0) ?? 0);
     if (!glyph) { penX += fontSize / 2; continue; }
     if (glyph.width > 0 && glyph.height > 0) {
      const sprite = RasterGlyph(resource, atlas, glyph, fontSize);
      if (sprite) {
       const plan = ResolveSdfGlyphDrawPlan({
        cellLayout: experimentalFnt5CellLayout,
        bearingPlacement: experimentalFnt5Placement,
        hasFnt5PixelMetrics: !!resource.fnt5PixelMetrics,
        cellSize: resource.fnt5CellSize,
        glyphWidth: glyph.width,
        glyphHeight: glyph.height,
        bearingX: glyph.bearingX,
        bearingY: glyph.bearingY,
        nominalFontSize: meta.fontSize,
        requestedFontSize: fontSize,
        penX,
        baseY,
        spriteWidth: sprite.width,
        spriteHeight: sprite.height,
        atlasWidth: atlas.source.width,
        referenceAtlasWidth: meta.atlasWidth
       });
       if (plan) {
        ink.drawImage(sprite, plan.x, plan.y, plan.width, plan.height);
        LogFnt5Placement(resource, glyph, character, plan.mode, fontSize, penX, baseY, plan.x, plan.y, plan.width, plan.height, width, height, clipPadding, sprite);
       }
      }
     }
     penX += resource.fnt5PixelMetrics ? glyph.advance * scale : SdfGlyphAdvance(glyph.advance, fontSize);
    }
    baseY += lineHeight;
   }
   if (clipPadding)
    ink.setTransform(1, 0, 0, 1, 0, 0);
   ink.globalCompositeOperation = "source-in";
   ink.fillStyle = color;
   ink.fillRect(0, 0, pixelWidth, pixelHeight);
   ink.globalCompositeOperation = "source-over";
   if (shadowSize > 0) {
    context.shadowColor = shadowColor ?? "rgba(0,0,0,.85)";
    context.shadowOffsetX = shadowOffsetX;
    context.shadowOffsetY = shadowOffsetY;
    context.shadowBlur = Math.max(1, shadowSize / 4);
    context.drawImage(layer, 0, 0);
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
   } else {
    context.drawImage(layer, 0, 0);
   }
   if (clipPadding) {
    context.strokeStyle = "#38bdf8";
    context.lineWidth = 1;
    context.setLineDash([4, 3]);
    context.strokeRect(clipPadding + 0.5, clipPadding + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
    context.setLineDash([]);
    context.fillStyle = "#f59e0b";
    context.fillRect(clipPadding, clipPadding + initialBaseY, Math.max(1, width), 1);
   }
  }).catch((error) => { if (!cancelled) console.warn("[NIH Layout Studio] SDF preview unavailable", error); });
  return () => { cancelled = true; };
 }, [resource, text, color, fontSize, width, height, hAlign, vAlign, wrap, shadowSize, shadowOffsetX, shadowOffsetY, shadowColor]);
 if (debugFnt5Clip && resource.fnt5PixelMetrics) {
  const margin = Math.min(256, Math.max(80, Math.ceil(fontSize * 1.5)));
  return <span style={{ display: "block", position: "relative", width, height, overflow: "visible", pointerEvents: "none" }}><canvas className="widget-text" ref={canvasRef} style={{ position: "absolute", left: -margin, top: -margin, width: Math.ceil(width) + margin * 2, height: Math.ceil(height) + margin * 2, maxWidth: "none" }} /></span>;
 }
 return <canvas className="widget-text" ref={canvasRef} style={{ width, height, display: "block" }} />;
}
