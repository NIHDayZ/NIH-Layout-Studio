import assert from "node:assert/strict";
import test from "node:test";
import {probeMapping} from "../tools/probe-fnt5-mapping.mjs";

test("probing GLPS does not silently assert a character mapping",()=>{
 const words=Buffer.alloc(20);
 words.write("RICH",0,"ascii");
 words.writeUInt32LE(4,4);
 words.writeUInt32LE(32,8);
 words.writeUInt32LE(65,12);
 const font={glpsHex:words.toString("hex"),rawRecords:[[1,1,0,0,0,0,7],[39,1,2,17,2,17,6],[77,1,6,6,2,17,10],[115,1,14,18,1,18,16]]};
 const report=probeMapping(font,[{character:"A",codePoint:65,x:176,y:71,width:10,height:12}]);
 assert.equal(report.recordCount,4);
 assert.equal(report.interpretations.offset4.firstU32[0],4);
 assert.equal(report.fsdfSamples[0].indexCodepoint,null);
 assert.equal(report.fsdfSamples[0].indexAsciiFromSpace,null);
 assert.match(report.warning,/Hypotheses only/);
});
test("short GLPS chunks do not trigger out of bounds reads",()=>{
 const report=probeMapping({glpsHex:"0102",rawRecords:[[1,1,0,0,0,0,7]]});
 assert.deepEqual(report.interpretations.offset0.firstU16,[513]);
 assert.equal(report.fsdfSamples.length,0);
});

test("successful codepoint and ASCII-offset hypotheses select distinct correct records", () => {
 const rawRecords=Array.from({length:80},(_,index)=>[index+1000,index,0,0,0,0,index]);
 const font={glpsHex:Buffer.alloc(8).toString("hex"),rawRecords};
 const glyphs=["A","F","0","1"].map(character=>({character,codePoint:character.codePointAt(0),x:0,y:0,width:1,height:1}));
 const report=probeMapping(font,glyphs);
 for (const sample of report.fsdfSamples) {
  assert.equal(sample.indexCodepoint.index,sample.codePoint);
  assert.deepEqual(sample.indexCodepoint.raw,rawRecords[sample.codePoint]);
  assert.equal(sample.indexAsciiFromSpace.index,sample.codePoint-32);
  assert.deepEqual(sample.indexAsciiFromSpace.raw,rawRecords[sample.codePoint-32]);
  assert.notDeepEqual(sample.indexCodepoint.raw,sample.indexAsciiFromSpace.raw);
 }
 assert.deepEqual(report.fsdfSamples.map(sample=>sample.character),["A","F","0","1"]);
});
