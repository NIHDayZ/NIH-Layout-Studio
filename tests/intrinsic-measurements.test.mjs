import test from "node:test";
import assert from "node:assert/strict";
import { CreateImageIntrinsicProvider } from "../.geometry-engine-test-build/ProjectIntrinsicSources.js";
import { ResolveIntrinsicMeasurement, NormalizeIntrinsicMeasurement } from "../.geometry-engine-test-build/IntrinsicMeasurements.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const node=(id,type,properties=[],children=[])=>({
 id,name:id,type,properties:properties.map(([name,value])=>({name,value})),children
});
const root={x:0,y:0,width:500,height:300};
const content=[["Size To Content H","1"],["Size To Content V","1"]];
const exactpos=[["hexactpos","1"],["vexactpos","1"]];

test("imageset logical size is consumed without confusing it with atlas pixel dimensions",()=>{
 const queried=[];
 const image=CreateImageIntrinsicProvider((reference)=>{
  queried.push(reference);
  return reference==="set:dayz image:button" ? {
   logicalWidth:24,logicalHeight:16,width:48,height:32
  } : null;
 });
 const widget=node("icon","ImageWidgetClass",[
  ["image0","set:dayz image:button"],["imagetexture","fallback.png"]
 ]);
 const result=ResolveIntrinsicMeasurement(widget,{image});
 assert.deepEqual(queried,["set:dayz image:button"]);
 assert.deepEqual(result,{family:"image",measurement:{
  width:24,height:16,evidence:"imageset-logical",
  widthIndependent:true,heightIndependent:true
 }});
});

test("missing imageset dimensions and direct texture URL do not invent one-pixel intrinsic images",()=>{
 const image=CreateImageIntrinsicProvider(()=>({logicalWidth:undefined,logicalHeight:undefined}));
 assert.equal(ResolveIntrinsicMeasurement(node("direct","ImageWidgetClass",[["image0","direct.png"]]),{image}),null);
 const fallback=CreateImageIntrinsicProvider((ref)=>{
  if(ref==="bad.png")return {logicalWidth:0,logicalHeight:NaN};
  if(ref==="good.png")return {logicalWidth:33,logicalHeight:20};
  return null;
 });
 const result=ResolveIntrinsicMeasurement(node("icon","ImageWidgetClass",[
  ["image0","bad.png"],["imageTexture","good.png"]
 ]),{image:fallback});
 assert.equal(result.measurement.width,33);
 assert.equal(result.measurement.height,20);
});

test("only exact supported text/image classes invoke intrinsic providers",()=>{
 let images=0,texts=0;
 const providers={
  image:()=>{ ++images; return {width:20,height:20,evidence:"imageset-logical",widthIndependent:true,heightIndependent:true}; },
  text:()=>{ ++texts; return {width:70,height:12,evidence:"font-metrics",widthIndependent:true,heightIndependent:true}; }
 };
 for(const type of ["ButtonWidgetClass","RichTextWidgetClass","MultilineTextWidgetClass","MyImageWidgetClass","TextListboxWidgetClass"])
  assert.equal(ResolveIntrinsicMeasurement(node(type,type),providers),null);
 assert.equal(images,0);
 assert.equal(texts,0);
 assert.equal(ResolveIntrinsicMeasurement(node("t","TextWidgetClass"),providers).family,"text");
 assert.equal(ResolveIntrinsicMeasurement(node("i","ImageWidgetClass"),providers).family,"image");
 assert.equal(images,1);
 assert.equal(texts,1);
});

test("nonfinite, negative, or parent-dependent provider axes are rejected separately",()=>{
 assert.deepEqual(NormalizeIntrinsicMeasurement({
  width:NaN,height:25,evidence:"font-metrics",
  widthIndependent:true,heightIndependent:true
 }),{width:undefined,height:25,evidence:"font-metrics",widthIndependent:false,heightIndependent:true});
 assert.equal(NormalizeIntrinsicMeasurement({
  width:50,height:-2,evidence:"font-metrics",
  widthIndependent:false,heightIndependent:true
 }),null);
});

test("content size is explicit opt-in and recalculates right/center anchor coordinates",()=>{
 const icon=node("icon","ImageWidgetClass",[
  ["position","10 5"],...exactpos,["halign","right_ref"],["valign","center_ref"],
  ["size","0.8 0.5"],...content,["image0","set:ui image:test"]
 ]);
 const image=CreateImageIntrinsicProvider(()=>({logicalWidth:100,logicalHeight:20}));
 const prepared=MeasureLayoutTree([icon],{intrinsics:{image}});
 const baseline=ArrangeMeasuredGeometry(prepared,root);
 assert.deepEqual(baseline.appliedIntrinsics,[]);
 assert.deepEqual(baseline.byId.get("icon").localRect,{x:90,y:80,width:400,height:150});
 assert.deepEqual(baseline.issues.map(i=>i.code),["unresolved-size-to-content"]);
 const applied=ArrangeMeasuredGeometry(prepared,root,1,{providedIntrinsicContent:true});
 assert.deepEqual(applied.byId.get("icon").localRect,{x:390,y:145,width:100,height:20});
 assert.deepEqual(applied.appliedIntrinsics,[{
  id:"icon",family:"image",evidence:"imageset-logical",axes:["horizontal","vertical"]
 }]);
 assert.deepEqual(applied.issues,[]);
});

test("partial provider metrics leave unresolved axes authored and visible to diagnostics",()=>{
 const label=node("label","TextWidgetClass",[["size","200 30"],["hexactsize","1"],["vexactsize","1"],...content]);
 const prepared=MeasureLayoutTree([label],{intrinsics:{text:()=>({
  width:86,evidence:"font-metrics",widthIndependent:true,heightIndependent:false
 })}});
 const snapshot=ArrangeMeasuredGeometry(prepared,root,1,{providedIntrinsicContent:true});
 assert.deepEqual(snapshot.byId.get("label").localRect,{x:0,y:0,width:86,height:30});
 assert.deepEqual(snapshot.appliedIntrinsics[0].axes,["horizontal"]);
 assert.equal(snapshot.issues.length,1);
 assert.match(snapshot.issues[0].detail,/vertical/);
});

test("unsupported content axes cannot be activated on widgets with children",()=>{
 const child=node("child","TextWidgetClass",[["size","0.5 0.5"]]);
 const parent=node("parent","TextWidgetClass",[...content,["size","1 1"]],[child]);
 const prepared=MeasureLayoutTree([parent],{intrinsics:{text:()=>({
  width:60,height:20,evidence:"font-metrics",widthIndependent:true,heightIndependent:true
 })}});
 const snapshot=ArrangeMeasuredGeometry(prepared,root,1,{providedIntrinsicContent:true});
 assert.deepEqual(snapshot.appliedIntrinsics,[]);
 assert.equal(snapshot.issues[0].code,"unresolved-size-to-content");
 assert.deepEqual(snapshot.byId.get("parent").localRect,{x:0,y:0,width:500,height:300});
});

test("nested children use a changed parent content size only when supplied and opted in",()=>{
 const label=node("label","TextWidgetClass",[["size","0.5 0.5"]]);
 const icon=node("icon","ImageWidgetClass",[["size","1 1"],...content,["image0","set:ui image:icon"]],[label]);
 const measure=MeasureLayoutTree([icon],{intrinsics:{image:()=>({
  width:100,height:40,evidence:"imageset-logical",widthIndependent:true,heightIndependent:true
 })}});
 const result=ArrangeMeasuredGeometry(measure,root,1,{providedIntrinsicContent:true});
 // A content-sized widget with children is intentionally unresolved until
 // the engine has a native parent/child feedback policy.
 assert.deepEqual(result.appliedIntrinsics,[]);
 assert.equal(result.byId.get("label").absoluteRect.width,250);
 assert.equal(result.issues[0].code,"unresolved-size-to-content");
});

test("prepared resource measurements are reused without additional provider calls",()=>{
 let calls=0;
 const img=node("img","ImageWidgetClass",[["size","1 1"],...content,["image0","set:ui image:pixel"]]);
 const prepared=MeasureLayoutTree([img],{intrinsics:{image:()=>{++calls;return {
  width:30,height:10,evidence:"imageset-logical",widthIndependent:true,heightIndependent:true
 };}}});
 assert.equal(calls,1);
 const a=ArrangeMeasuredGeometry(prepared,root,1,{providedIntrinsicContent:true});
 const b=ArrangeMeasuredGeometry(prepared,{x:0,y:0,width:1000,height:600},1,{providedIntrinsicContent:true});
 assert.equal(calls,1);
 assert.equal(a.byId.get("img").localRect.width,30);
 assert.equal(b.byId.get("img").localRect.width,30);
});

test("unrelated managed layouts never become content measurement strategies",()=>{
 const child=node("label","TextWidgetClass",[["size","0.5 0.5"]]);
 const parent=node("scroll","ScrollWidgetClass",[["size","1 1"],...content],[child]);
 const prepared=MeasureLayoutTree([parent],{intrinsics:{text:()=>({
  width:80,height:20,evidence:"font-metrics",widthIndependent:true,heightIndependent:true
 })}});
 const snapshot=ArrangeMeasuredGeometry(prepared,root,1,{providedIntrinsicContent:true});
 assert.equal(snapshot.appliedIntrinsics.length,0);
 assert.deepEqual(snapshot.issues.map(x=>x.code),["unresolved-size-to-content","unresolved-layout-strategy"]);
});
