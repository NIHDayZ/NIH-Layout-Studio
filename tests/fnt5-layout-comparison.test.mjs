import test from "node:test";
import assert from "node:assert/strict";
import {layoutFnt5Entries,fnt5LayoutSvg} from "../tools/fnt5-layout-comparison.mjs";

test("two layout hypotheses use the same glyph order and advances but different placement",()=>{
 const entries=[{character:"A",record:[1,1,16,18,2,17,15]},{character:"B",record:[39,1,14,17,1,16,13]}];
 const cell=layoutFnt5Entries(entries,38,24,24,"cell");
 const bearing=layoutFnt5Entries(entries,38,24,24,"bearing");
 assert.deepEqual(cell.map(g=>g.character),["A","B"]);
 assert.equal(cell[1].x,15);
 assert.equal(bearing[1].x,15+1-(38-14)/2);
 assert.notEqual(bearing[0].y,cell[0].y);
 assert.throws(()=>layoutFnt5Entries(entries,38,24,24,"unknown"),/Invalid layout options/);
});
test("full-string SVG displays both un-clipped placement modes",()=>{
 const rgba=new Uint8ClampedArray(40*40*4);
 rgba.set([255,200,0,255],(1*40+1)*4);
 const glyphs=[{character:"A",record:[1,1,16,18,2,17,15]}];
 const svg=fnt5LayoutSvg({width:40,height:40,rgba},glyphs,{pitch:38,nominalSize:24,sizes:[16]});
 assert.match(svg,/16px \/ cell/);
 assert.match(svg,/16px \/ bearing/);
 assert.match(svg,/fill="white"/);
 assert.throws(()=>fnt5LayoutSvg({width:40,height:40,rgba},glyphs,{pitch:40,nominalSize:24,sizes:[16]}),/Glyph outside atlas/);
});
