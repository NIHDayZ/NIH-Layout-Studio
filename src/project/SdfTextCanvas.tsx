import { useEffect, useRef } from "react";
import type { SdfFontMetadata, SdfGlyphMetric } from "./Fnt5Metadata";
import { SdfCellSize, SdfGlyphAdvance, SdfSampleAlpha } from "./SdfRasterMath";

export interface SdfFontResource {
 metadata: SdfFontMetadata;
 glyphs: Map<number, SdfGlyphMetric>;
 atlasUrl: string;
}
interface CachedAtlas {
 source: HTMLCanvasElement;
 glyphs: Map<number, HTMLCanvasElement>;
}
const atlases = new WeakMap<SdfFontResource, Promise<CachedAtlas>>();
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
 const cell = SdfCellSize(resource.metadata.fontSize, resource.metadata.charScale);
 if (cell <= 0 || glyph.x < 0 || glyph.y < 0 || glyph.x + cell > atlas.source.width || glyph.y + cell > atlas.source.height)
  return null;
 const sourceCtx = atlas.source.getContext("2d", { willReadFrequently: true });
 if (!sourceCtx)
  return null;
 const pixels = sourceCtx.getImageData(glyph.x, glyph.y, cell, cell);
 for (let p = 0; p < pixels.data.length; p += 4) {
  const alpha = SdfSampleAlpha(pixels.data[p], resource.metadata.inverted);
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
  if (line || paragraph.length === 0 || result.length === 0)
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
       ink.drawImage(sprite, x, y, sprite.width * scale, sprite.height * scale);
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
