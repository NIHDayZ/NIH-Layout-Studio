import { useEffect, useRef } from "react";
import type { SdfFontMetadata, SdfGlyphMetric } from "./Fnt5Metadata";
import { SdfAtlasCell, SdfCellSize, SdfGlyphAdvance, SdfSampleAlpha } from "./SdfRasterMath";
import { MsdfAlpha } from "./SdfMsdfMath";

export interface SdfFontResource {
 metadata: SdfFontMetadata;
 glyphs: Map<number, SdfGlyphMetric>;
 atlasUrl: string;
 fnt5Origins?: Map<number, { x: number; y: number }>;
 fnt5Name?: string;
}
interface CachedAtlas {
 source: HTMLCanvasElement;
 glyphs: Map<number, HTMLCanvasElement>;
}
const atlases = new WeakMap<SdfFontResource, Promise<CachedAtlas>>();
// Explicit opt-in via ?experimentalMsdf=1; production remains on legacy red-channel SDF.
const experimentalFnt5Cells = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("experimentalFnt5Cells") === "1";
const debugFnt5Sampling = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugFnt5Sampling") === "1";
const loggedGlyphs = new Set<string>();
const loggedWidgets = new Set<string>();
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
   const ctx = source.getContext("2d");
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
function RasterGlyph(resource: SdfFontResource, atlas: CachedAtlas, glyph: SdfGlyphMetric): HTMLCanvasElement | null {
 const cached = atlas.glyphs.get(glyph.codePoint);
 if (cached)
  return cached;
 const origin = experimentalFnt5Cells ? resource.fnt5Origins?.get(glyph.codePoint) : undefined;
 // Only the tested MetronBook24 atlas has a verified 38px grid pitch.
 const usesTcrd = !!(origin && resource.fnt5Name?.toLowerCase() === "sdf_metronbook24" && resource.metadata.fontSize === 24 && atlas.source.width === 1024 && atlas.source.height === 1024);
 const rect = usesTcrd
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
    selected: usesTcrd ? "TCRD" : "FSDF fallback",
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
   ? MsdfAlpha(pixels.data[p], pixels.data[p + 1], pixels.data[p + 2], resource.metadata.inverted)
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
 atlas.glyphs.set(glyph.codePoint, canvas);
 return canvas;
}
function WrapLines(text: string, width: number, advance: (text: string) => number, enabled: boolean): string[] {
 if (!enabled || width <= 0)
  return text.split("\n");
 const result: string[] = [];
 for (const paragraph of text.split("\n")) {
  const paragraphStart = result.length;
  let line = "";
  for (const token of paragraph.match(/\s+|\S+/g) ?? []) {
   if (line && advance(line + token) > width) {
    result.push(line.trimEnd());
    line = token.trimStart();
   } else {
    line += token;
   }
   // Handle unbroken identifiers that cannot fit on one line.
   if (line && advance(line) > width) {
    let fragment = "";
    for (const letter of Array.from(line)) {
     if (fragment && advance(fragment + letter) > width) {
      result.push(fragment);
      fragment = "";
     }
     fragment += letter;
    }
    line = fragment;
   }
  }
  if (line || result.length === paragraphStart)
   result.push(line.trimEnd());
 }
 return result;
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
   const key = ResourceId(resource) + ":" + text;
   if (!loggedWidgets.has(key)) {
    loggedWidgets.add(key);
    console.info("[NIH Layout Studio][SDF widget]", { font: resource.fnt5Name ?? resource.metadata.fontFile, resourceId: ResourceId(resource), text: text.slice(0, 120), originCount: resource.fnt5Origins?.size ?? 0, experimentalFnt5Cells, experimentalMsdf });
   }
  }
  void LoadAtlas(resource).then((atlas) => {
   if (cancelled)
    return;
   const context = canvas.getContext("2d");
   if (!context)
    return;
   const pixelWidth = Math.max(1, Math.ceil(width));
   const pixelHeight = Math.max(1, Math.ceil(height));
   canvas.width = pixelWidth;
   canvas.height = pixelHeight;
   const meta = resource.metadata;
   const scale = fontSize / meta.fontSize;
   const atlasScale = atlas.source.width / meta.atlasWidth;
   const advance = (value: string) => Array.from(value).reduce((sum, letter) => {
    const glyph = resource.glyphs.get(letter.codePointAt(0) ?? 0);
    return sum + (glyph ? SdfGlyphAdvance(glyph.advance, fontSize) : fontSize / 2);
   }, 0);
   const lines = WrapLines(text, width, advance, wrap);
   const lineHeight = fontSize * 1.25;
   let baseY = vAlign === "center" ? (height - lines.length * lineHeight) / 2 : vAlign === "bottom" ? height - lines.length * lineHeight : 0;
   // Render a tinted text layer first, then composite its shadow behind it.
   const layer = document.createElement("canvas");
   layer.width = pixelWidth;
   layer.height = pixelHeight;
   const ink = layer.getContext("2d");
   if (!ink)
    return;
   for (const line of lines) {
    let penX = hAlign === "center" ? (width - advance(line)) / 2 : hAlign === "right" ? width - advance(line) : 0;
    for (const character of Array.from(line)) {
     const glyph = resource.glyphs.get(character.codePointAt(0) ?? 0);
     if (!glyph) { penX += fontSize / 2; continue; }
     if (glyph.width > 0 && glyph.height > 0) {
      const sprite = RasterGlyph(resource, atlas, glyph);
      if (sprite) {
       const x = penX + glyph.bearingX * scale;
       const y = baseY + (meta.fontSize - glyph.bearingY) * scale;
       ink.drawImage(sprite, x, y, sprite.width * scale / atlasScale, sprite.height * scale / atlasScale);
      }
     }
     penX += SdfGlyphAdvance(glyph.advance, fontSize);
    }
    baseY += lineHeight;
   }
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
  }).catch((error) => { if (!cancelled) console.warn("[NIH Layout Studio] SDF preview unavailable", error); });
  return () => { cancelled = true; };
 }, [resource, text, color, fontSize, width, height, hAlign, vAlign, wrap, shadowSize, shadowOffsetX, shadowOffsetY, shadowColor]);
 return <canvas className="widget-text" ref={canvasRef} style={{ width, height, display: "block" }} />;
}
