import assert from "node:assert/strict";
import test from "node:test";
import { inspectFnt5, inspectFsdf } from "../tools/inspect-fnt5.mjs";

function chunk(name, payload) {
 const result = Buffer.alloc(8 + payload.length + (payload.length & 1));
 result.write(name, 0, "ascii");
 result.writeUInt32BE(payload.length, 4);
 payload.copy(result, 8);
 return result;
}
function fixture() {
 const head = chunk("HEAD", Buffer.from([3, 0, 0, 0]));
 const glps = chunk("GLPS", Buffer.alloc(4));
 const records = Buffer.alloc(28);
 for (let i = 0; i < 14; ++i)
  records.writeUInt16LE(i + 1, i * 2);
 const tcrd = chunk("TCRD", records);
 const kern = chunk("KERN", Buffer.alloc(0));
 const body = Buffer.concat([Buffer.from("FNT5"), head, glps, tcrd, kern]);
 const form = Buffer.alloc(8);
 form.write("FORM", 0, "ascii");
 form.writeUInt32BE(body.length, 4);
 return Buffer.concat([form, body]);
}
test("FNT5 chunk bounds and raw 14-byte records", () => {
 const result = inspectFnt5(fixture());
 assert.equal(result.tcrdRecordCount, 2);
 assert.deepEqual(result.rawRecords[0], [1, 2, 3, 4, 5, 6, 7]);
 assert.deepEqual(result.rawRecords[1], [8, 9, 10, 11, 12, 13, 14]);
 assert.deepEqual(result.chunks.map((v) => v.name), ["HEAD", "GLPS", "TCRD", "KERN"]);
});
test("rejects truncated binary records", () => {
 const truncated = fixture().subarray(0, -1);
 assert.throws(() => inspectFnt5(truncated), /FORM length/);
});
test("FSDF glyph observations don't imply record mapping", () => {
 const fields = ["Characters { 65 70 }", "GlyphCoordsX { 36 71 }", "GlyphCoordsY { 1 1 }", "SizesX { 10 8 }", "SizesY { 12 11 }", "BearingsX { 0 1 }", "BearingsY { 11 11 }", "Advances { 639 559 }"].join("\n");
 const glyphs = inspectFsdf(fields);
 assert.equal(glyphs[0].character, "A");
 assert.equal(glyphs[0].x, 36);
 assert.equal(glyphs[1].character, "F");
 assert.throws(() => inspectFsdf(fields.replace("Advances { 639 559 }", "Advances { 639 }")), /lengths disagree/);
});
