import test from "node:test";
import assert from "node:assert/strict";
import {selectFnt5Glyphs,unclippedFnt5Svg} from "../tools/fnt5-unclipped-preview.mjs";
test("multi-range glyph selection retains holes and record ordering",()=>{
 const glps=Buffer.alloc(40);glps.writeUInt32LE(3,8);glps.writeUInt32LE(3,12);
 for(const [i,cp] of [65,67,49].entries()){glps.writeUInt32LE(cp,16+i*8);glps.writeUInt16LE(1,20+i*8);}
 // Deliberately reorder into ascending ranges.
 glps.writeUInt32LE(49,16);glps.writeUInt32LE(65,24);glps.writeUInt32LE(67,32);
 const f={glpsHex:glps.toString("hex"),rawRecords:[[1,1,10,10,0,0,10],[4,1,10,10,0,0,10],[7,1,10,10,0,0,10]]};
 const selected=selectFnt5Glyphs(f,"1ABC");
 assert.deepEqual(selected.map(g=>g.record?.[0]??null),[1,4,null,7]);
});
test("unclipped contact sheet uses median threshold and explicit nominal size",()=>{
 const rgba=new Uint8ClampedArray(4*4*4);
 rgba.set([255,128,0,255],0);rgba.set([255,129,0,255],4);
 const entry=[{character:"A",record:[0,0,2,2,0,0,2]}];
 const svg=unclippedFnt5Svg({width:4,height:4,rgba},entry,{pitch:2,nominalSize:24,sizes:[24,72]});
 assert.match(svg,/fill="#111"/);assert.match(svg,/fill="#fff"/);
 assert.match(svg,/24px/);assert.match(svg,/72px/);
 assert.throws(()=>unclippedFnt5Svg({width:4,height:4,rgba},entry,{pitch:5}),/Cell outside atlas/);
});
