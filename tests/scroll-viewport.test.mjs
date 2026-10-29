import test from "node:test";
import assert from "node:assert/strict";
import { MeasureAuthoredScrollViewport, EstimateNativeScrollExtent } from "../.geometry-engine-test-build/ScrollViewport.js";
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

test("native-derived Scroll candidate uses viewport as baseline, then each child right/bottom edge",()=>{
 const direct = MeasureAuthoredScrollViewport(Rect(100,60),[
  {x:10,y:10,width:60,height:20},
  {x:40,y:50,width:100,height:30}
 ]);

 assert.deepEqual(EstimateNativeScrollExtent(direct),{
  width:140,height:80,
  evidence:"native-derived-scroll-extent-prototype",
  assumptions:"zero-offset-unadjusted-viewport"
 });
 const inset = MeasureAuthoredScrollViewport(Rect(100,60),[
  {x:5,y:5,width:20,height:20}
 ]);
 assert.deepEqual([EstimateNativeScrollExtent(inset).width,EstimateNativeScrollExtent(inset).height],[100,60]);
 const negative = MeasureAuthoredScrollViewport(Rect(100,60),[
  {x:-15,y:-25,width:30,height:35}
 ]);
 assert.deepEqual([EstimateNativeScrollExtent(negative).width,EstimateNativeScrollExtent(negative).height],[100,60]);
});

test("native Scroll extent is independently opt-in and never changes authored positions",()=>{
 const scroll=Scroll([Child("a",10,10,60,20),Child("b",40,50,100,30)]);
 const prepared=MeasureLayoutTree([scroll]);
 const defaultSnap=ArrangeMeasuredGeometry(prepared,Rect(500,300));
 const onlyAuthored=ArrangeMeasuredGeometry(prepared,Rect(500,300),1,{scrollViewportDiagnostics:true});
 const onlyNative=ArrangeMeasuredGeometry(prepared,Rect(500,300),1,{scrollNativeExtentDiagnostics:true});
 const both=ArrangeMeasuredGeometry(prepared,Rect(500,300),1,{
  scrollNativeExtentDiagnostics:true,scrollViewportDiagnostics:true
 });
 assert.equal(defaultSnap.scrollExtentCandidates.size,0);
 assert.equal(onlyAuthored.scrollExtentCandidates.size,0);
 assert.equal(onlyNative.scrollViewports.size,0);
 assert.equal(onlyNative.scrollExtentCandidates.get("scroll").width,140);
 assert.equal(onlyNative.scrollExtentCandidates.get("scroll").height,80);
 assert.deepEqual(onlyNative.entries,defaultSnap.entries);
 assert.deepEqual(onlyNative.issues,defaultSnap.issues);
 assert.equal(both.scrollViewports.size,1);
 assert.equal(both.scrollExtentCandidates.size,1);
 assert.deepEqual(both.scrollExtentCandidates.get("scroll"),onlyNative.scrollExtentCandidates.get("scroll"));
});

test("native Scroll extent diagnostic refuses relative, hidden and managed children",()=>{
 const invalid=[
  Node("relative","ImageWidgetClass",[["position","0.1 0.2"],["size","0.6 0.4"]]),
  Node("hidden","PanelWidgetClass",[["visible","0"],["position","0 0"],
   ["hexactpos","1"],["vexactpos","1"],...Fixed(30,20)]),
  Node("grid","GridSpacerWidgetClass",Fixed(20,30))
 ];
 for (const child of invalid) {
  const scroll=Scroll([child]);
  const result=ArrangeMeasuredGeometry(MeasureLayoutTree([scroll]),Rect(500,300),1,{
   scrollNativeExtentDiagnostics:true
  });
  assert.equal(result.scrollExtentCandidates.size,0);
  assert.ok(result.issues.some(x=>x.code==="unresolved-layout-strategy"));
 }
});

test("content-sized Scroll cannot reuse its authored viewport as a native extent",()=>{
 const scroll=Scroll([Child("large",0,0,150,90)],[["Size To Content V","1"]]);
 const result=ArrangeMeasuredGeometry(MeasureLayoutTree([scroll]),Rect(500,300),1,{
  scrollNativeExtentDiagnostics:true
 });
 assert.equal(result.scrollExtentCandidates.size,0);
 assert.ok(result.issues.some(x=>x.code==="unresolved-size-to-content"));
});


test("native reflected Scrollbar names decode once, preserve first property, and refuse ambiguous flags", async()=>{
 const { DecodeNativeScrollSettings } = await import("../.geometry-engine-test-build/ScrollSettings.js");
 assert.deepEqual(DecodeNativeScrollSettings([]),{horizontal:false,vertical:false,verticalLeft:false});
 const settings=[
  {name:"Scrollbar H",value:"1"},
  {name:"Scrollbar V",value:"1"},
  {name:"Scrollbar V Left",value:"1"},
  {name:"SCROLLBAR H",value:"0"}
 ];
 assert.deepEqual(DecodeNativeScrollSettings(settings),{horizontal:true,vertical:true,verticalLeft:true});
 for(const bad of ["yes","false","2","-1"]) {
  assert.equal(DecodeNativeScrollSettings([{name:"Scrollbar H",value:bad}]),null);
 }
});

test("unscaled native Scroll viewport reserves ten units per enabled scrollbar", async()=>{
 const { EstimateUnscaledScrollViewport } = await import("../.geometry-engine-test-build/ScrollSettings.js");
 const s={horizontal:true,vertical:true,verticalLeft:true};
 assert.deepEqual(EstimateUnscaledScrollViewport(Rect(100,60),s,1),{
  childViewport:{x:10,y:0,width:90,height:50},
  scrollbarThickness:10,
  horizontalScrollbar:true,
  verticalScrollbar:true,
  verticalScrollbarLeft:true,
  evidence:"native-derived-unscaled-scroll-viewport",
  assumptions:"zero-offset-no-dpi-scaling"
 });
 const right=EstimateUnscaledScrollViewport(Rect(100,60),{...s,verticalLeft:false},1);
 assert.deepEqual(right.childViewport,{x:0,y:0,width:90,height:50});
 const none=EstimateUnscaledScrollViewport(Rect(100,60),{
  horizontal:false,vertical:false,verticalLeft:true
 },1);
 assert.deepEqual(none.childViewport,{x:0,y:0,width:100,height:60});
 assert.equal(none.verticalScrollbarLeft,false);
 assert.equal(EstimateUnscaledScrollViewport(Rect(10,60),s,1),null);
 assert.equal(EstimateUnscaledScrollViewport(Rect(100,60),s,1.25),null);
});

test("scrollbar viewport opt-in does not affect geometry, clipping, or native max extents",()=>{
 const scroll=Scroll([Child("a",0,0,150,90)],[
  ["Scrollbar H","1"],["Scrollbar V","1"],["Scrollbar V Left","1"]
 ]);
 const prepared=MeasureLayoutTree([scroll]);
 assert.deepEqual(prepared.roots[0].nativeScroll,{
  horizontal:true,vertical:true,verticalLeft:true
 });
 const base=ArrangeMeasuredGeometry(prepared,Rect(500,300));
 const enabled=ArrangeMeasuredGeometry(prepared,Rect(500,300),1,{
  scrollScrollbarViewportDiagnostics:true,
  scrollNativeExtentDiagnostics:true,
  scrollViewportDiagnostics:true
 });
 assert.equal(base.scrollAdjustedViewports.size,0);
 assert.equal(enabled.scrollAdjustedViewports.get("scroll").childViewport.width,90);
 assert.equal(enabled.scrollAdjustedViewports.get("scroll").childViewport.height,50);
 assert.equal(enabled.scrollAdjustedViewports.get("scroll").childViewport.x,10);
 assert.equal(enabled.scrollExtentCandidates.size,0);
 assert.equal(enabled.scrollViewports.size,1);
 assert.deepEqual(enabled.entries,base.entries);
 assert.deepEqual(enabled.issues,base.issues);
});

test("unknown scroll toggles and scaled viewports remain diagnostic-only and unsupported",()=>{
 const scroll=Scroll([Child("a",0,0,20,20)],[["Scrollbar V","nonsense"]]);
 const prepared=MeasureLayoutTree([scroll]);
 assert.equal(prepared.roots[0].nativeScroll,null);
 const bad=ArrangeMeasuredGeometry(prepared,Rect(500,300),1,{
  scrollScrollbarViewportDiagnostics:true,scrollNativeExtentDiagnostics:true
 });
 assert.equal(bad.scrollAdjustedViewports.size,0);
 assert.equal(bad.scrollExtentCandidates.size,0);
 const valid=MeasureLayoutTree([Scroll([Child("a",0,0,20,20)],[["Scrollbar V","1"]])]);
 const scaled=ArrangeMeasuredGeometry(valid,Rect(500,300),2,{
  scrollScrollbarViewportDiagnostics:true
 });
 assert.equal(scaled.scrollAdjustedViewports.size,0);
});
