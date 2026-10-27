/** Read-only metadata discovery, not an SDF rendering implementation. */
export interface SdfFontMetadata {
 fontFile: string;
 fontSize: number;
 sdfType: number;
 inverted: boolean;
 charScale: number;
 atlasWidth: number;
 atlasHeight: number;
 characters: number[];
}
export interface Fnt5Structure {
 fontName: string;
 chunks: string[];
 glyphRecordBytes: number;
 glyphRecordCount: number;
}
function Property(source: string, key: string): string | undefined {
 const match = source.match(new RegExp("(?:^|\\n)\\s*" + key + "\\s+([^\\r\\n]+)", "i"));
 return match?.[1]?.trim();
}
function Numeric(source: string, key: string): number {
 const value = Number(Property(source, key));
 if (!Number.isFinite(value))
  throw new Error("Invalid FSDF " + key);
 return value;
}
export function ParseFsdf(source: string): SdfFontMetadata | null {
 if (!/^\s*SDFFontResourceClass\s*\{/i.test(source))
  return null;
 try {
  const fontFile = Property(source, "FontFile")?.replace(/^"|"$/g, "");
  const block = source.match(/\bCharacters\s*\{([^}]*)\}/i);
  if (!fontFile || !block)
   return null;
  const characters = block[1].trim() ? block[1].trim().split(/\s+/).map(Number) : [];
  if (characters.some((v) => !Number.isInteger(v) || v < 0 || v > 0x10ffff))
   return null;
  const fontSize = Numeric(source, "FontSize");
  const sdfType = Numeric(source, "FontSDFType");
  const charScale = Numeric(source, "FontCharScale");
  const atlasWidth = Numeric(source, "AtlasWidth");
  const atlasHeight = Numeric(source, "AtlasHeight");
  if (fontSize <= 0 || charScale <= 0 || atlasWidth <= 0 || atlasHeight <= 0)
   return null;
  return { fontFile, fontSize, sdfType, inverted: Numeric(source, "FontIsInverted") !== 0, charScale, atlasWidth, atlasHeight, characters };
 } catch { return null; }
}
export function InspectFnt5(bytes: Uint8Array): Fnt5Structure | null {
 if (bytes.length < 12)
  return null;
 const fourCC = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
 if (fourCC(0) !== "FORM" || fourCC(8) !== "FNT5")
  return null;
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 let offset = 12;
 let fontName = "";
 let tcrdLength = 0;
 const chunks: string[] = [];
 while (offset + 8 <= bytes.length) {
  const tag = fourCC(offset);
  const length = view.getUint32(offset + 4, false);
  const start = offset + 8;
  if (length > bytes.length - start)
   return null;
  chunks.push(tag);
  if (tag === "HEAD" && length >= 4) {
   const count = view.getUint32(start, true);
   if (count > 0 && count <= length - 4)
    fontName = new TextDecoder().decode(bytes.subarray(start + 4, start + 4 + count)).replace(/\0+$/, "");
  }
  if (tag === "TCRD")
   tcrdLength = length;
  offset = start + length;
 }
 if (offset !== bytes.length || !chunks.includes("HEAD") || !chunks.includes("GLPS") || !chunks.includes("TCRD"))
  return null;
 const glyphRecordBytes = 14;
 return { fontName, chunks, glyphRecordBytes, glyphRecordCount: tcrdLength % glyphRecordBytes === 0 ? tcrdLength / glyphRecordBytes : 0 };
}


/** FSDF glyph geometry remains in its source-atlas coordinate space. */
export interface SdfGlyphMetric {
 codePoint: number;
 x: number;
 y: number;
 width: number;
 height: number;
 bearingX: number;
 bearingY: number;
 advance: number;
}
function NumberList(source: string, key: string): number[] | null {
 const block = source.match(new RegExp("\\b" + key + "\\s*\\{([^}]*)\\}", "i"));
 if (!block)
  return null;
 const text = block[1].trim();
 if (!text)
  return [];
 const entries = text.split(/\s+/).map(Number);
 if (entries.some((v) => !Number.isFinite(v)))
  return null;
 return entries;
}
export function ParseFsdfGlyphMetrics(source: string): SdfGlyphMetric[] | null {
 const metadata = ParseFsdf(source);
 if (!metadata)
  return null;
 const keys = ["SizesX", "SizesY", "BearingsX", "BearingsY", "Advances", "GlyphCoordsX", "GlyphCoordsY"];
 const arrays = keys.map((key) => NumberList(source, key));
 if (arrays.some((values) => !values || values.length !== metadata.characters.length))
  return null;
 const [widths, heights, bearingXs, bearingYs, advances, xs, ys] = arrays as number[][];
 const glyphs: SdfGlyphMetric[] = [];
 for (let i = 0; i < metadata.characters.length; ++i) {
  const width = widths[i];
  const height = heights[i];
  const x = xs[i];
  const y = ys[i];
  if (width < 0 || height < 0 || x < 0 || y < 0 || x + width > metadata.atlasWidth || y + height > metadata.atlasHeight || advances[i] < 0)
   return null;
  glyphs.push({ codePoint: metadata.characters[i], x, y, width, height, bearingX: bearingXs[i], bearingY: bearingYs[i], advance: advances[i] });
 }
 return glyphs;
}
