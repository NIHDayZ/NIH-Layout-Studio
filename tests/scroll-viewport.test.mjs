import test from "node:test";
import assert from "node:assert/strict";
import { MeasureAuthoredScrollViewport } from "../.geometry-engine-test-build/ScrollViewport.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const Rect=(width,height)=>({x:0,y:0,width,height});
function Node(id,type,properties=[],children=[]) {
 return {id,name:id,type,properties:properties.map(([name,value])=>({name,value})),children};
}
const Fixed=(w,h)=>[["size",w+" "+h],["hexactsize","1"],["vexactsize","1"]];
const Child=(id,x,y,w,h)=>Node(id,"PanelWidgetClass",[
 ["position",x+" "+y],["hexactpos","1"],["vexactpos","1"],...Fixed(w,h)
]);
function Scroll(children,properties=[]) {
 return Node("scroll","ScrollWidgetClass",[...Fixed(100,60),...properties],children);
}

test("authored Scroll viewport measures direct-child overhang without inventing scroll behavior",()=>{
 const measured=MeasureAuthoredScrollViewport(Rect(100,60),[
  {x:10,y:10,width:60,height:20},
  {x:40,y:50,width:100,height:30}
 ]);
 assert.deepEqual(measured,{
  viewport:{x:0,y:0,width:100,height:60},
  directChildBounds:{x:10,y:10,width:130,height:70},
  overhang:{left:0,right:40,top:0,bottom:20},
  directChildCount:2,
  evidence:"authored-direct-child-bounds"
 });
});

test("negative local positions report left/top overhang separately",()=>{
 const measured=MeasureAuthoredScrollViewport(Rect(100,60),[
  {x:-8,y:-4,width:20,height:20},
  {x:70,y:45,width:40,height:30}
 ]);
 assert.deepEqual(measured.overhang,{left:8,right:10,top:4,bottom:15});
 assert.deepEqual(measured.directChildBounds,{x:-8,y:-4,width:118,height:79});
});

test("invalid viewport, malformed child and empty content are not measured",()=>{
 assert.equal(MeasureAuthoredScrollViewport(Rect(0,100),[{x:0,y:0,width:10,height:10}]),null);
 assert.equal(MeasureAuthoredScrollViewport(Rect(100,100),[]),null);
 assert.equal(MeasureAuthoredScrollViewport(Rect(100,100),[{x:0,y:0,width:NaN,height:10}]),null);
 assert.equal(MeasureAuthoredScrollViewport(Rect(100,100),[{x:0,y:0,width:10,height:-1}]),null);
});

test("Scroll diagnostics are opt-in, leave child positions unchanged, and retain unresolved native strategy",()=>{
 const scroll=Scroll([Child("a",10,10,60,20),Child("b",40,50,100,30)]);
 const tree=MeasureLayoutTree([scroll]);
 const base=ArrangeMeasuredGeometry(tree,Rect(500,300));
 const reported=ArrangeMeasuredGeometry(tree,Rect(500,300),1,{scrollViewportDiagnostics:true});
 assert.equal(base.scrollViewports.size,0);
 assert.equal(reported.scrollViewports.size,1);
 assert.deepEqual(reported.scrollViewports.get("scroll").overhang,{
  left:0,right:40,top:0,bottom:20
 });
 assert.deepEqual(base.entries,reported.entries);
 assert.deepEqual(reported.issues.map(x=>x.code),["unresolved-layout-strategy"]);
 assert.deepEqual(reported.appliedStrategies,[]);
});

test("nested Scroll viewport uses its own size and only direct-child local coordinates",()=>{
 const scroll=Scroll([Child("a",-5,4,70,20)]);
 const outer=Node("outer","FrameWidgetClass",[
  ["position","200 80"],["hexactpos","1"],["vexactpos","1"],...Fixed(300,200)
 ],[scroll]);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([outer]),Rect(1000,600),1,{
  scrollViewportDiagnostics:true
 });
 assert.deepEqual(snap.byId.get("scroll").absoluteRect,{x:200,y:80,width:100,height:60});
 assert.deepEqual(snap.byId.get("a").absoluteRect,{x:195,y:84,width:70,height:20});
 assert.deepEqual(snap.scrollViewports.get("scroll").overhang,{left:5,right:0,top:0,bottom:0});
});

test("relative, invisible, content-sized and managed direct children remain diagnostically unresolved",()=>{
 const badChildren=[
  Node("relative","ImageWidgetClass",[["position","0.3 0"],["size","0.5 0.5"]]),
  Node("hidden","PanelWidgetClass",[
   ["position","0 0"],["hexactpos","1"],["vexactpos","1"],
   ...Fixed(50,30),["visible","0"]
  ]),
  Node("content","TextWidgetClass",[
   ["position","0 0"],["hexactpos","1"],["vexactpos","1"],
   ...Fixed(50,30),["Size To Content V","1"]
  ]),
  Node("grid","GridSpacerWidgetClass",Fixed(50,30))
 ];
 for(const child of badChildren) {
  const scroll=Scroll([child]);
  const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([scroll]),Rect(500,300),1,{
   scrollViewportDiagnostics:true
  });
  assert.equal(snap.scrollViewports.size,0,child.type);
  assert.ok(snap.issues.some(i=>i.code==="unresolved-layout-strategy"));
 }
});

test("Scroll itself requiring content sizing cannot use its authored viewport as a native measurement",()=>{
 const scroll=Scroll([Child("inside",0,0,200,100)],[["Size To Content V","1"]]);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([scroll]),Rect(500,300),1,{
  scrollViewportDiagnostics:true, boundedParentContent:true
 });
 assert.equal(snap.scrollViewports.size,0);
 assert.equal(snap.byId.get("scroll").localRect.height,60);
 assert.ok(snap.issues.some(i=>i.code==="unresolved-size-to-content"));
});

test("Grid, Wrap and Panel never inherit Scroll viewport inspection",()=>{
 const types=["GridSpacerWidgetClass","WrapSpacerWidgetClass","PanelWidgetClass"];
 const roots=types.map((type,index)=>Node("parent"+index,type,Fixed(100,60),[
  Child("child"+index,0,0,200,100)
 ]));
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree(roots),Rect(500,300),1,{
  scrollViewportDiagnostics:true
 });
 assert.equal(snap.scrollViewports.size,0);
 assert.ok(snap.issues.some(i=>i.code==="unresolved-layout-strategy"));
});
