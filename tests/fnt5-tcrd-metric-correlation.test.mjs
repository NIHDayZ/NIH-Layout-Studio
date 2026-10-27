import test from "node:test";
import assert from "node:assert/strict";
import { correlateTcrdMetrics } from "../tools/correlate-fnt5-metrics.mjs";

function fixture() {
 const bytes=Buffer.alloc(24);
 bytes.write("RICH",0,"utf16le");
 bytes.writeUInt32LE(95,8);
 bytes.writeUInt32LE(1,12);
 bytes.writeUInt32LE(32,16);
 bytes.writeUInt16LE(95,20);
 const records=Array.from({length:95},(_,i)=>[1+i*38,1,1,1,0,1,1]);
 records[16]=[609,1,13,17,1,17,15];
 records[17]=[647,1,9,18,2,18,16];
 records[33]=[267,39,16,18,0,17,15];
 records[38]=[457,39,11,17,2,17,14];
 return {glpsHex:bytes.toString("hex"),rawRecords:records};
}
const glyphs=[
 {character:"0",codePoint:48,x:71,y:36,width:10,height:13,bearingX:0,bearingY:12,advance:636},
 {character:"1",codePoint:49,x:106,y:36,width:6,height:12,bearingX:1,bearingY:12,advance:636},
 {character:"A",codePoint:65,x:176,y:71,width:10,height:12,bearingX:0,bearingY:11,advance:639},
 {character:"F",codePoint:70,x:351,y:71,width:8,height:11,bearingX:1,bearingY:11,advance:559},
 {character:"€",codePoint:8364,x:0,y:0,width:1,height:1,bearingX:0,bearingY:0,advance:100}
];
test("maps real MetronBook24 sample record values without treating candidates as proven metrics",()=>{
 const report=correlateTcrdMetrics(fixture(),glyphs);
 assert.equal(report.mappedFsdfCount,4);
 assert.equal(report.totalFsdfCount,5);
 assert.deepEqual(report.samples.map(s=>s.recordIndex),[16,17,33,38]);
 assert.deepEqual(report.samples.map(s=>s.rawTcrdU16LE),[
  [609,1,13,17,1,17,15],
  [647,1,9,18,2,18,16],
  [267,39,16,18,0,17,15],
  [457,39,11,17,2,17,14]
 ]);
 assert.equal(report.samples[2].fsdf.advance,639);
 assert.match(report.caveat,/candidates only/);
});
test("rejects mismatched glyph record shape",()=>{
 const f=fixture();
 f.rawRecords[33]=[1,2];
 assert.throws(()=>correlateTcrdMetrics(f,glyphs),/Invalid mapped TCRD/);
});
