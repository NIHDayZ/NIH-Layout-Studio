import { useEffect, useRef } from "react";
import type { SdfFontMetadata, SdfGlyphMetric } from "./Fnt5Metadata";
import { SdfAtlasCell, SdfCellSize, SdfGlyphAdvance, SdfSampleAlpha } from "./SdfRasterMath";
import { MsdfAlpha, MsdfAlphaWithBias, MsdfScaledSmoothing } from "./SdfMsdfMath";
import { Fnt5Placement } from "./Fnt5Placement";
import { ResolveExperimentalFnt5LineOrigin } from "../renderer/engine/Fnt5LineOriginExperiment";
import { WrapPreviewText } from "../renderer/engine/TextFlow";

export interface SdfFontResource {
 metadata: SdfFontMetadata;
 glyphs: Map<number, SdfGlyphMetric>;
 atlasUrl: string;
 fnt5Origins?: Map<number, { x: number; y: number }>;
 fnt5Name?: string;
 fnt5CellSize?: number;
 fnt5PixelMetrics?: boolean;
}
interface CachedAtlas {
 source: HTMLCanvasElement;
 glyphs: Map<string, HTMLCanvasElement>;
}
const atlases = new WeakMap<SdfFontResource, Promise<CachedAtlas>>();
// Explicit opt-in via ?experimentalMsdf=1; production remains on legacy red-channel SDF.
const experimentalFnt5Cells = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("experimentalFnt5Cells") === "1";
const experimentalFnt5Placement = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("experimentalFnt5Placement") === "1";
const experimentalFnt5CellLayout = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("experimentalFnt5Layout") === "cell";
const experimentalFnt5LineOrigin = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("experimentalFnt5LineOrigin") : null;
const debugFnt5Clip = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugFnt5Clip") === "1";
const debugFnt5Sampling = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugFnt5Sampling") === "1";
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
const experimentalMsdf = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("experimentalMsdf") === "1";
const experimentalMsdfSmoothing = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("experimentalMsdfSmoothing") === "1";
const experimentalMsdfStroke = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("experimentalMsdfStroke") === "1";
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
   resolve({ source, glyphs: new Map() });
  };
  image.src = resource.atlasUrl;
 });
 atlases.set(resource, task);
 void task.catch(() => { if (atlases.get(resource) === task) atlases.delete(resource); });
 return task;
}
function RasterGlyph(resource: SdfFontResource, atlas: CachedAtlas, glyph: SdfGlyphMetric, displayedFontSize: number): HTMLCanvasElement | null {
 const cacheKey = experimentalMsdf && (experimentalMsdfSmoothing || experimentalMsdfStroke) ? `${glyph.codePoint}:${displayedFontSize}` : `${glyph.codePoint}`;
 const cached = atlas.glyphs.get(cacheKey);
 if (cached)
  return cached;
 const origin = experimentalFnt5Cells ? resource.fnt5Origins?.get(glyph.codePoint) : undefined;
 // Only the tested MetronBook24 atlas has a verified 38px grid pitch.
 const usesTcrd = !!(origin && resource.fnt5Name?.toLowerCase() === "sdf_metronbook24" && resource.metadata.fontSize === 24 && atlas.source.width === 1024 && atlas.source.height === 1024);
 const rect = resource.fnt5PixelMetrics && resource.fnt5CellSize && resource.fnt5Origins?.has(glyph.codePoint)
  ? { left: resource.fnt5Origins.get(glyph.codePoint)!.x, top: resource.fnt5Origins.get(glyph.codePoint)!.y, size: resource.fnt5CellSize, scale: 1 }
  : usesTcrd
  ? { left: origin.x, top: origin.y, size: 38, scale: 1 }
  : SdfAtlasCell(glyph.x, glyph.y, SdfCellSize(resource.metadata.fontSize, resource.metadata.charScale), resource.metadata.atlasWidth, atlas.source.width, atlas.source.height);
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
    selected: resource.fnt5PixelMetrics && resource.fnt5CellSize && resource.fnt5Origins?.has(glyph.codePoint) ? "Standalone FNT5 cell" : usesTcrd ? "TCRD" : "FSDF fallback",
    rectangle: rect,
    msdf: experimentalMsdf
   });
  }
 }
 if (!rect || rect.left < 0 || rect.top < 0 || rect.left + rect.size > atlas.source.width || rect.top + rect.size > atlas.source.height)
  return null;
 const { left: sourceX, top: sourceY, size: cell } = rect;
 const sourceCtx = atlas.source.getContext("2d", { willReadFrequently: true });
 if (!sourceCtx)
  return null;
 const pixels = sourceCtx.getImageData(sourceX, sourceY, cell, cell);
 for (let p = 0; p < pixels.data.length; p += 4) {
  const alpha = experimentalMsdf
   ? experimentalMsdfStroke
    ? MsdfAlphaWithBias(pixels.data[p], pixels.data[p + 1], pixels.data[p + 2], resource.metadata.inverted, experimentalMsdfSmoothing ? MsdfScaledSmoothing(displayedFontSize, resource.metadata.fontSize) : 12, 2)
    : MsdfAlpha(pixels.data[p], pixels.data[p + 1], pixels.data[p + 2], resource.metadata.inverted, experimentalMsdfSmoothing ? MsdfScaledSmoothing(displayedFontSize, resource.metadata.fontSize) : 12)
   : SdfSampleAlpha(pixels.data[p], resource.metadata.inverted);
  pixels.data[p] = 255;
  pixels.data[p + 1] = 255;
  pixels.data[p + 2] = 255;
  pixels.data[p + 3] = alpha;
 }
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
   const atlasScale = atlas.source.width / meta.atlasWidth;
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
       // The standalone FNT5 cell includes distance-field padding. A provisional
       // centering path keeps that padding around the nominal glyph bounds and
       // scales the entire cell using the font's actual FNT5 nominal size.
       if (experimentalFnt5CellLayout && resource.fnt5PixelMetrics && resource.fnt5CellSize) {
        // Diagnostic: align the entire reconstructed glyph cell at the line origin.
        // Keep the existing advance, wrapping and widget clipping unchanged.
        ink.drawImage(sprite, penX, baseY, resource.fnt5CellSize * scale, resource.fnt5CellSize * scale);
        LogFnt5Placement(resource, glyph, character, "cell", fontSize, penX, baseY, penX, baseY, resource.fnt5CellSize * scale, resource.fnt5CellSize * scale, width, height, clipPadding, sprite);
       } else if (experimentalFnt5Placement && resource.fnt5PixelMetrics && resource.fnt5CellSize) {
        const placement = Fnt5Placement(resource.fnt5CellSize, glyph.width, glyph.height, glyph.bearingX, glyph.bearingY, meta.fontSize, fontSize, penX, baseY);
        if (placement) {
         ink.drawImage(sprite, placement.x, placement.y, placement.size, placement.size);
         LogFnt5Placement(resource, glyph, character, "bearing", fontSize, penX, baseY, placement.x, placement.y, placement.size, placement.size, width, height, clipPadding, sprite);
        }
       } else {
        const x = penX + glyph.bearingX * scale;
        const y = baseY + (meta.fontSize - glyph.bearingY) * scale;
        ink.drawImage(sprite, x, y, sprite.width * scale / atlasScale, sprite.height * scale / atlasScale);
        LogFnt5Placement(resource, glyph, character, "legacy", fontSize, penX, baseY, x, y, sprite.width * scale / atlasScale, sprite.height * scale / atlasScale, width, height, clipPadding, sprite);
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
