import assert from "node:assert/strict";
import test from "node:test";
import { ParseFsdf, InspectFnt5 } from "../.fnt5-test-build/Fnt5Metadata.js";

test("Metron FSDF fields and character list", () => {
 const parsed = ParseFsdf('SDFFontResourceClass {\n FontFile "MetronBook.ttf"\n FontSize 24\n FontSDFType 2\n FontIsInverted 0\n FontCharScale 1.375\n AtlasWidth 512\n AtlasHeight 256\n Characters { 32 33 34 35 }\n}');
 assert.equal(parsed?.fontFile, "MetronBook.ttf");
 assert.equal(parsed?.sdfType, 2);
 assert.equal(parsed?.charScale, 1.375);
 assert.deepEqual(parsed?.characters, [32, 33, 34, 35]);
 const empty = ParseFsdf('SDFFontResourceClass {\n FontFile "MetronBook.ttf"\n FontSize 24\n FontSDFType 2\n FontIsInverted 0\n FontCharScale 1.375\n AtlasWidth 512\n AtlasHeight 256\n Characters { }\n}');
 assert.deepEqual(empty?.characters, []);
 assert.equal(ParseFsdf("invalid"), null);
});

test("FNT5 big-endian IFF chunks and bounded TCRD records", () => {
 const head = new Uint8Array(8);
 new DataView(head.buffer).setUint32(0, 4, true);
 head.set([84, 101, 115, 116], 4);
 const encode = (tag, body) => {
  const bytes = new Uint8Array(8 + body.length);
  for (let i = 0; i < 4; ++i) bytes[i] = tag.charCodeAt(i);
  new DataView(bytes.buffer).setUint32(4, body.length, false);
  bytes.set(body, 8);
  return bytes;
 };
 const chunks = [encode("HEAD", head), encode("GLPS", new Uint8Array(4)), encode("TCRD", new Uint8Array(28)), encode("KERN", new Uint8Array(0))];
 const bytes = new Uint8Array(12 + chunks.reduce((sum, c) => sum + c.length, 0));
 bytes.set([70, 79, 82, 77], 0);
 bytes.set([70, 78, 84, 53], 8);
 let offset = 12;
 for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
 assert.deepEqual(InspectFnt5(bytes), {fontName: "Test", chunks: ["HEAD", "GLPS", "TCRD", "KERN"], glyphRecordBytes: 14, glyphRecordCount: 2});
 assert.equal(InspectFnt5(bytes.subarray(0, bytes.length - 1)), null);
});