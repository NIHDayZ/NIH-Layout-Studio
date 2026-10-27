import test from "node:test";
import assert from "node:assert/strict";
import {glyphGeometryReport,geometrySvg} from "../tools/preview-fnt5-geometry.mjs";
const chars=["0","1","A","F"];
function fixture(){
 const glps=Buffer.alloc(24);glps.write("RICH",0,"utf16le");glps.writeUInt32LE(95,8);glps.writeUInt32LE(1,12);glps.writeUInt32LE(32,16);glps.writeUInt16LE(95,20);
 const rawRecords=Array.from({length:95},()=>[1,1,0,0,0,0,0]);
 rawRecords[16]=[609,1,13,17,1,17,15];rawRecords[17]=[647,1,9,18,2,18,16];
 rawRecords[33]=[267,39,16,18,0,17,15];rawRecords[38]=[457,39,11,17,2,17,14];
 return {glpsHex:glps.toString("hex"),rawRecords};
}
test("mapped four glyphs retain raw record indices and candidate cell bounds",()=>{
 const fsdf=chars.map(character=>({character,codePoint:character.codePointAt(0),x:0,y:0,width:1,height:1}));
 const report=glyphGeometryReport(fixture(),fsdf);
 assert.deepEqual(report.map(g=>g.recordIndex),[33,38,16,17]);
 assert.deepEqual(report[0].origin,{x:267,y:39});
 assert.deepEqual(report[0].candidateInk,{x:267,y:56,width:16,height:18});
 const svg=geometrySvg(report);
 assert.match(svg,/A #33/);
 assert.match(svg,/width="38" height="38"/);
 assert.match(svg,/stroke="#f59e0b"/);
 assert.ok(!svg.includes("<image"));
});
test("optional atlas image is embedded and escaped",()=>{
 const svg=geometrySvg([],"data:image/png;base64,AA==");
 assert.match(svg,/<image href="data:image\/png;base64,AA=="/);
});
test("unsupported code point is reported without guessing a glyph record",()=>{
 const result=glyphGeometryReport(fixture(),[],"€");
 assert.equal(result[0].missing,true);
});
