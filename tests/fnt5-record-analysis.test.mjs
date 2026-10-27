import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFnt5 } from "../tools/analyze-fnt5.mjs";

test("GLPS words and TCRD deltas are observations, not decoded character names", () => {
 const bytes = Buffer.alloc(16);
 bytes.write("RICH", 0, "latin1");
 bytes.writeUInt32LE(4, 4);
 bytes.writeUInt32LE(62, 8);
 bytes.writeUInt32LE(32, 12);
 const font = {
  glpsHex: bytes.toString("hex"),
  rawRecords: [[1,1,0,0,0,0,7],[39,1,2,17,2,17,6],[77,1,6,6,2,17,10],[1,2,7,9,1,8,4]]
 };
 const result = analyzeFnt5(font, [{character:"A",codePoint:65,x:176,y:71}]);
 assert.equal(result.glps.signature,"RICH");
 assert.equal(result.glps.matchesRecordCount[0],0);
 assert.deepEqual(result.tcrd.prevalentNonnegativeField0Deltas[0],{delta:38,count:2});
 assert.equal(result.tcrd.rowResetCount,1);
 assert.deepEqual(result.tcrd.firstRowResets[0],{record:3,previous:[77,1],next:[1,2]});
 assert.equal(result.tcrd.columns[0].max,77);
 assert.equal(result.fsdf.samples[0].codePoint,65);
 assert.match(result.limitations,/unverified/);
});
test("GLPS trailing incomplete bytes are not interpreted as full words", () => {
 const font={glpsHex:"5249434801000000ab",rawRecords:[[1,1,0,0,0,0,7]]};
 const report=analyzeFnt5(font);
 assert.deepEqual(report.glps.firstWordsU32LE,[1]);
 assert.equal(report.fsdf,null);
});
