import { SdfCellSize, SdfGlyphAdvance, SdfSampleAlpha } from "./SdfRasterMath";
import { useEffect, useRef } from "react";
import type { SdfFontMetadata, SdfGlyphMetric } from "./Fnt5Metadata";

export interface SdfFontResource {
 metadata: SdfFontMetadata;
 glyphs: Map<number, SdfGlyphMetric>;
 atlasUrl: string;
}

export function SdfTextCanvas({ resource, text, color, fontSize, width, height, hAlign, vAlign }: {
 resource: SdfFontResource;
 text: string;
 color: string;
 fontSize: number;
 width: number;
 height: number;
 hAlign: string;
 vAlign: string;
}) {
 const canvasRef = useRef<HTMLCanvasElement>(null);
 useEffect(() => {
  const canvas = canvasRef.current;
  const context = canvas?.getContext("2d", { willReadFrequently: true });
  if (!canvas || !context)
   return;
  let cancelled = false;
  const image = new Image();
  image.onload = () => {
   if (cancelled)
    return;
   const pixelWidth = Math.max(1, Math.ceil(width));
   const pixelHeight = Math.max(1, Math.ceil(height));
   canvas.width = pixelWidth;
   canvas.height = pixelHeight;
   const source = document.createElement("canvas");
   source.width = image.naturalWidth;
   source.height = image.naturalHeight;
   const sourceCtx = source.getContext("2d", { willReadFrequently: true });
   if (!sourceCtx)
    return;
   sourceCtx.drawImage(image, 0, 0);
   // FSDF source coordinates are expressed relative to the packed reference area.
   // Never upsample glyph rectangles using the full cooked EDDS dimensions.
   const meta = resource.metadata;
   const scale = fontSize / meta.fontSize;
   const lines = text.split("\n");
   const lineHeight = fontSize * 1.25;
   let baseY = vAlign === "center" ? (height - lines.length * lineHeight) / 2 : vAlign === "bottom" ? height - lines.length * lineHeight : 0;
   for (const line of lines) {
    const glyphs = Array.from(line).map((c) => resource.glyphs.get(c.codePointAt(0) ?? 0));
    const lineWidth = glyphs.reduce((sum, g) => sum + (g ? SdfGlyphAdvance(g.advance, fontSize) : fontSize / 2), 0);
    let penX = hAlign === "center" ? (width - lineWidth) / 2 : hAlign === "right" ? width - lineWidth : 0;
    for (const glyph of glyphs) {
     if (!glyph) { penX += fontSize / 2; continue; }
     if (glyph.width > 0 && glyph.height > 0) {
      // SDF type 2 is stored as a grayscale distance field. Use a smooth
      // threshold at the center value, then tint the resulting glyph.
      const cell = SdfCellSize(meta.fontSize, meta.charScale);
      const sourceX = glyph.x;
      const sourceY = glyph.y;
      if (sourceX + cell <= source.width && sourceY + cell <= source.height) {
       const rgba = sourceCtx.getImageData(sourceX, sourceY, cell, cell);
       for (let p = 0; p < rgba.data.length; p += 4) {
        const distance = rgba.data[p];
        const alpha = SdfSampleAlpha(distance, meta.inverted);
        rgba.data[p] = 255;
        rgba.data[p + 1] = 255;
        rgba.data[p + 2] = 255;
        rgba.data[p + 3] = alpha;
       }
       const glyphCanvas = document.createElement("canvas");
       glyphCanvas.width = cell;
       glyphCanvas.height = cell;
       glyphCanvas.getContext("2d")?.putImageData(rgba, 0, 0);
       const glyphWidth = cell * scale;
       const glyphHeight = cell * scale;
       const x = penX + glyph.bearingX * scale;
       const y = baseY + (meta.fontSize - glyph.bearingY) * scale;
       context.drawImage(glyphCanvas, x, y, glyphWidth, glyphHeight);
      }
     }
     penX += SdfGlyphAdvance(glyph.advance, fontSize);
    }
    baseY += lineHeight;
   }
   context.globalCompositeOperation = "source-in";
   context.fillStyle = color;
   context.fillRect(0, 0, pixelWidth, pixelHeight);
   context.globalCompositeOperation = "source-over";
  };
  image.src = resource.atlasUrl;
  return () => { cancelled = true; image.onload = null; };
 }, [resource, text, color, fontSize, width, height, hAlign, vAlign]);
 return <canvas className="widget-text" ref={canvasRef} style={{ width, height, display: "block" }} />;
}
