import assert from "node:assert/strict";
import test from "node:test";
import {inspectGlpsStructure} from "../tools/inspect-glps-structure.mjs";

function fixture() {
 const bytes=Buffer.alloc(40);
 bytes.write("RICH",0,"utf16le");
 bytes.writeUInt32LE(3,8);
 bytes.writeUInt32LE(2,12);
 bytes.writeUInt32LE(32,16);
 bytes.writeUInt32LE(95,20);
 bytes.writeUInt32LE(160,24);
 bytes.writeUInt32LE(152,28);
 return {glpsHex:bytes.toString("hex"),rawRecords:Array.from({length:3},()=>[1,1,0,0,0,0,0])};
}
test("recognizes GLPS UTF-16LE framing and matching TCRD count",()=>{
 const report=inspectGlpsStructure(fixture());
 assert.equal(report.signature,"RICH");
 assert.equal(report.declaredCount,3);
 assert.equal(report.declaredCountMatchesTcrd,true);
 assert.equal(report.candidateCount,2);
 assert.equal(report.fullPairsAfter16,3);
 assert.deepEqual(report.firstRawPairs[0],{offset:16,left:32,right:95});
 assert.match(report.caution,/not established/);
});
test("reports mismatched count without inventing mapping",()=>{
 const f=fixture();
 f.rawRecords.pop();
 assert.equal(inspectGlpsStructure(f).declaredCountMatchesTcrd,false);
});
test("rejects incomplete GLPS framing",()=>{
 assert.throws(()=>inspectGlpsStructure({glpsHex:"52004900",rawRecords:[]}),/truncated/);
});
test("reports trailing bytes rather than parsing incomplete word pair",()=>{
 const f=fixture();
 f.glpsHex += "010203";
 assert.equal(inspectGlpsStructure(f).trailingBytes,3);
});
