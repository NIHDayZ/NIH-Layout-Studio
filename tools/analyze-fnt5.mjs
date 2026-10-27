/** Evidence-only exploratory report for FNT5 GLPS and TCRD. No rendering semantics assumed. */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { inspectFnt5, inspectFsdf } from "./inspect-fnt5.mjs";

export function analyzeFnt5(font, glyphs = null) {
 const bytes = Buffer.from(font.glpsHex, "hex");
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 const signature = bytes.length >= 4 ? bytes.toString("latin1", 0, 4) : "";
 // Expose independently observable words; don't presume this is a codepoint table.
 const glpsU32LE = [];
 for (let i = 4; i + 4 <= bytes.length; i += 4)
  glpsU32LE.push(view.getUint32(i, true));
 const records = font.rawRecords;
 const deltas = [];
 const rowResets = [];
 for (let i = 1; i < records.length; ++i) {
  const delta = records[i][0] - records[i - 1][0];
  if (delta < 0)
   rowResets.push({ record: i, previous: records[i - 1].slice(0, 2), next: records[i].slice(0, 2) });
  else
   deltas.push(delta);
 }
 const frequencies = Object.entries(deltas.reduce((counts, delta) => {
  counts[delta] = (counts[delta] ?? 0) + 1;
  return counts;
 }, {})).map(([delta, count]) => ({delta: Number(delta), count})).sort((a,b) => b.count - a.count);
 const columns = Array.from({length:7}, (_, index) => {
  const values = records.map((row) => row[index]);
  return { index, min: Math.min(...values), max: Math.max(...values), unique: new Set(values).size };
 });
 const knownGlyphs = glyphs ? glyphs.filter((glyph) => "AF01".includes(glyph.character)) : [];
 return {
  glps: { signature, byteCount: bytes.length, wordsAfterSignature: glpsU32LE.length,
   firstWordsU32LE: glpsU32LE.slice(0, 24), matchesRecordCount: glpsU32LE.map((value,i) => value === records.length ? i : -1).filter((i) => i >= 0) },
  tcrd: { count: records.length, columns, prevalentNonnegativeField0Deltas: frequencies.slice(0, 8),
   firstRecords: records.slice(0, 16), rowResetCount: rowResets.length, firstRowResets: rowResets.slice(0, 12) },
  fsdf: glyphs ? { characterCount: glyphs.length, samples: knownGlyphs } : null,
  limitations: "Field names, GLPS code-point mapping, and GLPS/TCRD index correspondence are unverified."
 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const [, , fntPath, fsdfPath] = process.argv;
 if (!fntPath) {
  console.error("Usage: node tools/analyze-fnt5.mjs <font.fnt> [font.fsdf]");
  process.exitCode = 1;
 } else {
  try {
   const font = inspectFnt5(readFileSync(fntPath));
   const glyphs = fsdfPath ? inspectFsdf(readFileSync(fsdfPath, "utf8")) : null;
   console.log(JSON.stringify(analyzeFnt5(font, glyphs), null, 2));
  } catch (error) {
   console.error(error);
   process.exitCode = 1;
  }
 }
}
