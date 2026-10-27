import test from "node:test";
import assert from "node:assert/strict";
import {examineGlyphPixels} from "../tools/fnt5-atlas-pixels.mjs";

test("reports per-channel sampled bounds and pixel count outside candidate ink",()=>{
 const width=8,height=8,rgba=new Uint8ClampedArray(width*height*4);
 function set(x,y,ch,value){rgba[(y*width+x)*4+ch]=value;}
 set(2,2,0,255);set(3,2,0,100);set(5,5,0,200);
 set(3,2,3,255);
 const glyph={character:"A",recordIndex:0,origin:{x:1,y:1},cell:{width:5,height:5},
  candidateInk:{x:2,y:2,width:2,height:1}};
 const result=examineGlyphPixels({width,height,rgba},[glyph])[0];
 assert.deepEqual(result.channels[0],{channel:"red",aboveThreshold:3,withinCandidate:2,
  outsideCandidate:1,bounds:{x:2,y:2,width:4,height:4}});
 assert.equal(result.channels[3].withinCandidate,1);
 assert.equal(result.channels[1].bounds,null);
});
test("rejects invalid atlas and out of bounds cells",()=>{
 assert.throws(()=>examineGlyphPixels({width:4,height:4,rgba:[]},[]),/Invalid decoded atlas/);
 const rgba=new Uint8ClampedArray(4*4*4);
 assert.throws(()=>examineGlyphPixels({width:4,height:4,rgba},[
  {character:"Z",origin:{x:3,y:3},cell:{width:2,height:2},candidateInk:{x:3,y:3,width:1,height:1}}
 ]),/outside atlas/);
});
