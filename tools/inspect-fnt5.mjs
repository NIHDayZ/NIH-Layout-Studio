/**
 * Diagnostic-only FNT5 chunk reader. The seven u16 values in each 14-byte
 * TCRD record are intentionally unnamed: their meaning is not yet verified.
 * Do not use these raw fields as production glyph coordinates.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function ascii(bytes, start, size) {
 return Buffer.from(bytes.subarray(start, start + size)).toString("latin1");
}

export function inspectFnt5(buffer) {
 const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
 if (bytes.length < 12 || ascii(bytes, 0, 4) !== "FORM" || ascii(bytes, 8, 4) !== "FNT5")
  throw new Error("Not a FNT5 FORM file");
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 const formLength = view.getUint32(4, false);
 if (formLength + 8 !== bytes.length)
  throw new Error("FORM length does not match file length");
 const chunks = [];
 let offset = 12;
 while (offset < bytes.length) {
  if (offset + 8 > bytes.length)
   throw new Error("Truncated chunk header");
  const name = ascii(bytes, offset, 4);
  const length = view.getUint32(offset + 4, false);
  const dataStart = offset + 8;
  if (length > bytes.length - dataStart)
   throw new Error("Chunk exceeds file bounds: " + name);
  chunks.push({ name, offset: dataStart, length });
  offset = dataStart + length + (length & 1);
 }
 if (offset !== bytes.length)
  throw new Error("Invalid IFF chunk padding");
 const byName = (name) => chunks.find((chunk) => chunk.name === name);
 const head = byName("HEAD");
 const glps = byName("GLPS");
 const tcrd = byName("TCRD");
 if (!head || !glps || !tcrd || tcrd.length % 14 !== 0)
  throw new Error("Missing required chunk or non-14-byte TCRD records");
 const rawRecords = [];
 for (let offset = tcrd.offset; offset < tcrd.offset + tcrd.length; offset += 14) {
  const fields = [];
  for (let i = 0; i < 7; ++i)
   fields.push(view.getUint16(offset + i * 2, true));
  rawRecords.push(fields);
 }
 return {
  formLength,
  chunks: chunks.map(({name,length}) => ({name,length})),
  headHex: Buffer.from(bytes.subarray(head.offset, head.offset + head.length)).toString("hex"),
  glpsHex: Buffer.from(bytes.subarray(glps.offset, glps.offset + glps.length)).toString("hex"),
  tcrdRecordCount: rawRecords.length,
  rawRecords
 };
}

export function inspectFsdf(source) {
 const grab = (key) => {
  const match = source.match(new RegExp("\\b" + key + "\\s*\\{([^}]*)\\}", "i"));
  return match ? match[1].trim().split(/\s+/).filter(Boolean).map(Number) : null;
 };
 const names = ["Characters", "GlyphCoordsX", "GlyphCoordsY", "SizesX", "SizesY", "BearingsX", "BearingsY", "Advances"];
 const arrays = Object.fromEntries(names.map((name) => [name, grab(name)]));
 if (names.some((name) => !arrays[name] || arrays[name].some((n) => !Number.isFinite(n))))
  throw new Error("Missing or malformed FSDF metric arrays");
 if (names.some((name) => arrays[name].length !== arrays.Characters.length))
  throw new Error("FSDF metric array lengths disagree");
 return arrays.Characters.map((codePoint, index) => ({
  codePoint,
  character: String.fromCodePoint(codePoint),
  x: arrays.GlyphCoordsX[index],
  y: arrays.GlyphCoordsY[index],
  width: arrays.SizesX[index],
  height: arrays.SizesY[index],
  bearingX: arrays.BearingsX[index],
  bearingY: arrays.BearingsY[index],
  advance: arrays.Advances[index]
 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const [, , fntPath, fsdfPath] = process.argv;
 if (!fntPath) {
  console.error("Usage: node tools/inspect-fnt5.mjs <font.fnt> [font.fsdf]");
  process.exitCode = 1;
 } else {
  try {
   const fnt = inspectFnt5(readFileSync(fntPath));
   const fsdf = fsdfPath ? inspectFsdf(readFileSync(fsdfPath, "utf8")) : null;
   console.log(JSON.stringify({
    fnt: { formLength: fnt.formLength, chunks: fnt.chunks, tcrdRecordCount: fnt.tcrdRecordCount,
     headHex: fnt.headHex, glpsLengthBytes: fnt.glpsHex.length / 2,
     firstTcrdRecordsRawU16LE: fnt.rawRecords.slice(0, 12) },
    fsdf: fsdf ? { glyphCount: fsdf.length, sample: fsdf.filter((g) => "AF01".includes(g.character)) } : null,
    note: "FNT5 raw records and FSDF glyph entries are separate views; mapping and field semantics are NOT verified."
   }, null, 2));
  } catch (error) {
   console.error(error);
   process.exitCode = 1;
  }
 }
}
