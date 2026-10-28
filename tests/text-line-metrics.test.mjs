import test from "node:test";
import assert from "node:assert/strict";
import {
 MeasureBitmapAdvance, MeasureBitmapSingleLine, MeasureSdfSingleLineWidth,
 CreateSingleLineTextIntrinsicProvider
} from "../.geometry-engine-test-build/TextLineMetrics.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const cp=(s)=>s.codePointAt(0);
const font={
 nominalSize:12,lineHeight:14.25,
 glyphs:new Map([[cp("A"),{advance:7}],[cp("V"),{advance:8}],[cp(" "),{advance:4}],[cp("😀"),{advance:12}]]),
 kerning:new Map([[cp("A")+":"+cp("V"),-2]])
};
const widget=(id,props)=>({
 id,name:id,type:"TextWidgetClass",
 properties:props.map(([name,value])=>({name,value})),children:[]
});

test("FNT3 advance measures kerned glyphs and Unicode by code point",()=>{
 assert.equal(MeasureBitmapAdvance(font,"AV",1),13);
 assert.equal(MeasureBitmapAdvance(font,"AV",2),26);
 assert.equal(MeasureBitmapAdvance(font,"😀 A",1),23);
 assert.equal(MeasureBitmapAdvance(font,"AZ",1),null);
 assert.equal(MeasureBitmapAdvance(font,"AZ",1,"renderer-fallback"),13);
 assert.deepEqual(MeasureBitmapSingleLine(font,"AV",24),{width:26,height:28.5});
});

test("FNT3 sizing refuses missing glyphs, unbounded multiline and invalid metrics",()=>{
 assert.equal(MeasureBitmapSingleLine(font,"A\nV",12),null);
 assert.equal(MeasureBitmapSingleLine(font,"",12),null);
 assert.equal(MeasureBitmapSingleLine(font,"Z",12),null);
 assert.equal(MeasureBitmapSingleLine(font,"A",0),null);
 assert.equal(MeasureBitmapAdvance({...font,nominalSize:0},"A",1),null);
 assert.equal(MeasureBitmapAdvance(font,"A",0),null);
});

test("frozen original Canvas renderer FNT3 advance formula is preserved",()=>{
 const reference=(text,scale)=>{
  let width=0,previous=-1;
  for (const character of Array.from(text)) {
   const codePoint=character.codePointAt(0)??0;
   if(previous>=0) width+=(font.kerning.get(previous+":"+codePoint)??0)*scale;
   const glyph=font.glyphs.get(codePoint);
   width+=(glyph?.advance??font.nominalSize*0.5)*scale;
   previous=codePoint;
  }
  return width;
 };
 for(const value of ["A","AV","VA","AV AV","😀 AV","AZ","A😀V",""]) {
  for(const scale of [.25,1,2.5]) {
   assert.equal(MeasureBitmapAdvance(font,value,scale,"renderer-fallback"),reference(value,scale));
  }
 }
});

test("FNT5 pixel advances and FSDF 1000-unit em advances are distinct",()=>{
 const glyphs=new Map([[cp("A"),{advance:500}],[cp("V"),{advance:300}]]);
 assert.equal(MeasureSdfSingleLineWidth({fontSize:20,pixelAdvances:false,glyphs},"AV",40),32);
 assert.equal(MeasureSdfSingleLineWidth({fontSize:20,pixelAdvances:true,glyphs},"AV",40),1600);
 assert.equal(MeasureSdfSingleLineWidth({fontSize:20,pixelAdvances:false,glyphs},"AZ",40),null);
 assert.equal(MeasureSdfSingleLineWidth({fontSize:20,pixelAdvances:false,glyphs},"A\nV",40),null);
 assert.equal(MeasureSdfSingleLineWidth({fontSize:20,pixelAdvances:false,glyphs},"",40),null);
});

test("font-aware FNT3 provider supplies independent measured axes only when requested",()=>{
 const txt=widget("title",[
  ["text","AV"],["Size To Content H","1"],["Size To Content V","1"],
  ["size","1 1"],["halign","right_ref"],["position","10 0"],
  ["hexactpos","1"]
 ]);
 const provider=CreateSingleLineTextIntrinsicProvider(()=>({kind:"fnt3",font,displaySize:24}));
 const measured=MeasureLayoutTree([txt],{intrinsics:{text:provider}});
 const rect=ArrangeMeasuredGeometry(measured,{x:0,y:0,width:200,height:100},1,{
  providedIntrinsicContent:true
 });
 assert.deepEqual(rect.byId.get("title").localRect,{x:164,y:0,width:26,height:28.5});
 assert.deepEqual(rect.appliedIntrinsics,[{
  id:"title",family:"text",evidence:"font-metrics",axes:["horizontal","vertical"]
 }]);
 assert.deepEqual(rect.issues,[]);
});

test("FSDF/FNT5 metrics supply width only, never invented native line height",()=>{
 const txt=widget("title",[["text","AV"],["Size To Content H","1"],["Size To Content V","1"],
  ["size","100 50"],["hexactsize","1"],["vexactsize","1"]]);
 const glyphs=new Map([[cp("A"),{advance:500}],[cp("V"),{advance:300}]]);
 const provider=CreateSingleLineTextIntrinsicProvider(()=>({
  kind:"fsdf",font:{fontSize:20,pixelAdvances:false,glyphs},displaySize:40
 }));
 const tree=MeasureLayoutTree([txt],{intrinsics:{text:provider}});
 const resolved=ArrangeMeasuredGeometry(tree,{x:0,y:0,width:500,height:500},1,{
  providedIntrinsicContent:true
 });
 assert.deepEqual(resolved.byId.get("title").localRect,{x:0,y:0,width:32,height:50});
 assert.deepEqual(resolved.appliedIntrinsics[0].axes,["horizontal"]);
 assert.deepEqual(resolved.issues.map(x=>x.code),["unresolved-size-to-content"]);
});

test("no missing-glyph, font-size or multiline guesses can escape provider",()=>{
 const txt=widget("title",[["text","UNKNOWN"],["Size To Content H","1"]]);
 const provider=CreateSingleLineTextIntrinsicProvider(()=>({kind:"fnt3",font,displaySize:16}));
 const measured=MeasureLayoutTree([txt],{intrinsics:{text:provider}});
 assert.equal(measured.roots[0].intrinsic,null);
 const resolved=ArrangeMeasuredGeometry(measured,{x:0,y:0,width:100,height:100},1,{
  providedIntrinsicContent:true
 });
 assert.deepEqual(resolved.appliedIntrinsics,[]);
 assert.equal(resolved.issues[0].code,"unresolved-size-to-content");
});
