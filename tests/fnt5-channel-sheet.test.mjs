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

test("channel panels and strict thresholds render correct exact pixel values",()=>{
 const width=38,height=38,rgba=new Uint8ClampedArray(width*height*4);
 const pixel=(x,y,r,g,b)=>{const i=(y*width+x)*4;rgba[i]=r;rgba[i+1]=g;rgba[i+2]=b;rgba[i+3]=255;};
 pixel(0,0,16,96,224);
 pixel(1,0,160,20,40);
 pixel(2,0,225,30,50);
 const glyph=[{character:"F",recordIndex:38,origin:{x:0,y:0},candidateInk:{x:1,y:1,width:3,height:4}}];
 const svg=channelSheetSvg({width,height,rgba},glyph,{scale:1,thresholds:[16,96,160,224]});
 const panel=(mode)=>{
  const modes=["RGB","R","G","B","R>16","R>96","R>160","R>224"];
  const col=modes.indexOf(mode),left=12+col*50,top=12+23;
  const at=svg.indexOf('x="'+left+'" y="'+top+'" width="1" height="1" fill="');
  assert.notEqual(at,-1,"missing "+mode+" first pixel");
  return svg.slice(at).match(/fill="([^"]+)"/)[1];
 };
 assert.equal(panel("RGB"),"rgb(16,96,224)");
 assert.equal(panel("R"),"rgb(16,16,16)");
 assert.equal(panel("G"),"rgb(96,96,96)");
 assert.equal(panel("B"),"rgb(224,224,224)");
 for(const mode of ["R>16","R>96","R>160","R>224"])assert.equal(panel(mode),"#000000");
 const thresholdAt=(col,x)=>svg.includes('x="'+(12+col*50+x)+'" y="35" width="1" height="1" fill="#ffffff"');
 assert.equal(thresholdAt(4,1),true);
 assert.equal(thresholdAt(6,1),false);
 assert.equal(thresholdAt(6,2),true);
 assert.equal(thresholdAt(7,2),true);
});
