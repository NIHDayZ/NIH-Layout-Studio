import test from "node:test";
import assert from "node:assert/strict";
import {medianRgb,msdfPreviewSvg} from "../tools/fnt5-msdf-preview.mjs";

test("median RGB picks middle channel independent of order",()=>{
 for(const values of [[10,80,220],[220,10,80],[80,220,10],[10,220,80],[80,10,220],[220,80,10]])
  assert.equal(medianRgb(...values),80);
 assert.equal(medianRgb(128,128,255),128);
});
test("renders median grayscale and strict threshold panels at exact pixel values",()=>{
 const rgba=new Uint8ClampedArray(38*38*4);
 const pixel=(x,r,g,b)=>{const p=x*4;rgba[p]=r;rgba[p+1]=g;rgba[p+2]=b;rgba[p+3]=255;};
 pixel(0,255,128,0);
 pixel(1,255,129,0);
 const glyphs=[{character:"A",recordIndex:33,origin:{x:0,y:0}}];
 const svg=msdfPreviewSvg({width:38,height:38,rgba},glyphs,{scale:1,thresholds:[128]});
 const firstFill=(column,x)=>{
  const left=12+column*50+x;
  const match=svg.match(new RegExp('<rect x="'+left+'" y="35" width="1" height="1" fill="([^"]+)"'));
  assert.ok(match,"Missing pixel for column "+column+" offset "+x);
  return match[1];
 };
 assert.equal(firstFill(0,0),"rgb(255,128,0)");
 assert.equal(firstFill(1,0),"rgb(128,128,128)");
 assert.equal(firstFill(1,1),"rgb(129,129,129)");
 assert.equal(firstFill(2,0),"#000000");
 assert.equal(firstFill(2,1),"#ffffff");
 assert.doesNotMatch(svg,/#f59e0b/);
});
test("rejects malformed atlas, invalid thresholds and out-of-range cells",()=>{
 assert.throws(()=>msdfPreviewSvg({width:2,height:2,rgba:[]},[]),/Invalid decoded atlas/);
 const rgba=new Uint8ClampedArray(38*38*4);
 assert.throws(()=>msdfPreviewSvg({width:38,height:38,rgba},[],{thresholds:[-1]}),/Invalid thresholds/);
 assert.throws(()=>msdfPreviewSvg({width:38,height:38,rgba},[{character:"F",origin:{x:1,y:0}}]),/outside atlas/);
});
