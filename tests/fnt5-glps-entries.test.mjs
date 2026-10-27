import test from "node:test";
import assert from "node:assert/strict";
import {analyzeGlpsEntries} from "../tools/analyze-glps-entries.mjs";
function fixture(count=3) {
 const bytes=Buffer.alloc(16+count*8);
 bytes.write("RICH",0,"utf16le");
 bytes.writeUInt32LE(5,8);
 bytes.writeUInt32LE(count,12);
 for(let i=0;i<count;++i) {
  bytes.writeUInt32LE(32+i,16+i*8);
  bytes.writeUInt32LE(i,20+i*8);
 }
 return {glpsHex:bytes.toString("hex"),rawRecords:Array.from({length:5},()=>[0,0,0,0,0,0,0])};
}
test("header count divides payload into bounded candidate entries",()=>{
 const report=analyzeGlpsEntries(fixture());
 assert.equal(report.uniformCandidate.stride,8);
 assert.equal(report.uniformCandidate.entries.length,3);
 assert.deepEqual(report.uniformCandidate.entries[1].u32,[33,1]);
 assert.equal(report.uniformCandidate.coverageBytes,24);
 assert.equal(report.uniformCandidate.firstU32WithinTcrd,0);
 assert.equal(report.uniformCandidate.secondU32WithinTcrd,3);
 assert.match(report.reason,/no character-to-TCRD mapping is verified/);
});
test("uneven payload cannot produce a uniform candidate",()=>{
 const bytes=Buffer.from(fixture().glpsHex,"hex");
 bytes.writeUInt32LE(5,12);
 const report=analyzeGlpsEntries({glpsHex:bytes.toString("hex"),rawRecords:[]});
 assert.equal(report.uniformCandidate,null);
});
test("rejects truncated or incorrect GLPS framing",()=>{
 assert.throws(()=>analyzeGlpsEntries({glpsHex:"52004900",rawRecords:[]}),/Unsupported or truncated/);
 const bytes=Buffer.from(fixture().glpsHex,"hex");
 bytes.write("BOOM",0,"utf16le");
 assert.throws(()=>analyzeGlpsEntries({glpsHex:bytes.toString("hex"),rawRecords:[]}),/Unsupported or truncated/);
});
test("actual MetronBook24 observed header shape gives 62 eight-byte candidates",()=>{
 const bytes=Buffer.alloc(512);
 bytes.write("RICH",0,"utf16le");
 bytes.writeUInt32LE(504,8);
 bytes.writeUInt32LE(62,12);
 const report=analyzeGlpsEntries({glpsHex:bytes.toString("hex"),rawRecords:Array.from({length:504},()=>[])});
 assert.equal(report.uniformCandidate.stride,8);
 assert.equal(report.uniformCandidate.entries.length,62);
 assert.equal(report.uniformCandidate.coverageBytes,496);
});
