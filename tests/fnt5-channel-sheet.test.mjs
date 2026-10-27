import test from "node:test";
import assert from "node:assert/strict";
import {channelSheetSvg} from "../tools/fnt5-channel-sheet.mjs";

test("contact sheet exposes channel and threshold views with candidate overlay",()=>{
 const rgba=new Uint8ClampedArray(40*40*4);
 const pos=(1*40+1)*4;
 rgba[pos]=200;rgba[pos+1]=100;rgba[pos+2]=20;rgba[pos+3]=255;
 const glyph=[{character:"A",recordIndex:33,origin:{x:0,y:0},candidateInk:{x:1,y:1,width:10,height:12}}];
 const svg=channelSheetSvg({width:40,height:40,rgba},glyph,{scale:2,thresholds:[16,160,224]});
 assert.match(svg,/A #33 RGB/);
 assert.match(svg,/A #33 R&gt;16|A #33 R>16/);
 assert.match(svg,/rgb\(200,100,20\)/);
 assert.match(svg,/rgb\(200,200,200\)/);
 assert.match(svg,/stroke="#f59e0b"/);
 assert.match(svg,/width="20" height="24"/);
});
test("reject invalid decoded atlas or cell bounds",()=>{
 assert.throws(()=>channelSheetSvg({width:4,height:4,rgba:[]},[]),/Invalid decoded atlas/);
 const rgba=new Uint8ClampedArray(40*40*4);
 assert.throws(()=>channelSheetSvg({width:40,height:40,rgba},[{character:"F",origin:{x:4,y:4},candidateInk:{x:4,y:4,width:1,height:1}}]),/outside atlas/);
});
