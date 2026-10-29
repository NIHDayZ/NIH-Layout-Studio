import test from "node:test";
import assert from "node:assert/strict";
import { WrapPreviewText, MeasurePreviewFlow } from "../.geometry-engine-test-build/TextFlow.js";

const count=(s)=>Array.from(s).length;

test("no-wrap and zero-width modes preserve explicit line breaks",()=>{
 for(const enabled of [false,true]) {
  const width=enabled?0:4;
  assert.deepEqual(WrapPreviewText("hello world\n\nend",width,count,enabled),["hello world","","end"]);
 }
});

test("existing preview breaks at spaces and preserves empty paragraphs",()=>{
 assert.deepEqual(WrapPreviewText("hello world",6,count,true),["hello","world"]);
 assert.deepEqual(WrapPreviewText("one\n\ntwo",100,count,true),["one","","two"]);
});

test("oversized unbroken identifiers are split by Unicode code point",()=>{
 assert.deepEqual(WrapPreviewText("abcdefgh",3,count,true),["abc","def","gh"]);
 assert.deepEqual(WrapPreviewText("😀😀😀",2,count,true),["😀😀","😀"]);
});

test("constrained preview metrics remain separate from intrinsic content sizing",()=>{
 const result=MeasurePreviewFlow("ab cd ef",5,12,count,true);
 assert.deepEqual(result,{lines:["ab cd","ef"],width:5,height:24});
 assert.equal(MeasurePreviewFlow("a",10,0,count,true),null);
 assert.equal(MeasurePreviewFlow("a",Infinity,12,count,true),null);
 assert.equal(MeasurePreviewFlow("a",10,12,()=>NaN,true),null);
});

test("preview measurement cannot assume intrinsic width independence",()=>{
 const wide=MeasurePreviewFlow("hello world",100,10,count,true);
 const narrow=MeasurePreviewFlow("hello world",5,10,count,true);
 assert.deepEqual(wide.lines,["hello world"]);
 assert.deepEqual(narrow.lines,["hello","world"]);
 assert.equal(wide.height,10);
 assert.equal(narrow.height,20);
});
