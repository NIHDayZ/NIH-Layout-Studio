import test from "node:test";
import assert from "node:assert/strict";
import { MeasureFixedWrapContent, PlanFixedWrap, DecodeNativeWrapSettings } from "../.geometry-engine-test-build/FixedWrap.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

function Node(id,type,props=[],children=[]) {
 return { id,name:id,type,properties:props.map(([name,value])=>({name,value})),children };
}
const Fixed=(w,h)=>[["size",w+" "+h],["hexactsize","1"],["vexactsize","1"]];
const SizeV=[["Size To Content V","1"]];
const Child=(id,w,h)=>Node(id,"ButtonWidgetClass",Fixed(w,h));
const Children=()=>[Child("a",40,10),Child("b",40,20),Child("c",40,12)];
function Wrap(props=[],children=Children()) {
 return Node("wrap","WrapSpacerWidgetClass",[...Fixed(100,90),...SizeV,...props],children);
}
const Root=(width=500,height=300)=>({x:0,y:0,width,height});
const Enabled={fixedWrap:true,wrapContentHeight:true};

test("one shared wrap algorithm reports the line extent and the required outer height",()=>{
 const settings=DecodeNativeWrapSettings([]);
 const children=Children().map(n=>({
  width:Number(n.properties[0].value.split(" ")[0]),
  height:Number(n.properties[0].value.split(" ")[1])
 }));
 const measured=MeasureFixedWrapContent(children,100,settings);
 assert.equal(measured.lineCount,2);
 assert.equal(measured.usedHeight,34);
 assert.equal(measured.requiredHeight,38);
 assert.deepEqual(measured.rects,PlanFixedWrap(children,{width:100,height:38},settings).rects);
 assert.equal(PlanFixedWrap(children,{width:100,height:37},settings),null);
 assert.equal(MeasureFixedWrapContent(children,0,settings),null);
});

test("default snapshot and independent option switches do not activate Wrap content sizing",()=>{
 const tree=MeasureLayoutTree([Wrap()]);
 for(const options of [{},{fixedWrap:true},{wrapContentHeight:true}]) {
  const snap=ArrangeMeasuredGeometry(tree,Root(),1,options);
  assert.equal(snap.byId.get("wrap").localRect.height,90);
  assert.deepEqual(snap.appliedWrapContent,[]);
  assert.deepEqual(snap.appliedStrategies,[]);
  assert.deepEqual(snap.issues.map(i=>i.code),[
   "unresolved-size-to-content","unresolved-layout-strategy"
  ]);
 }
});

test("vertical Wrap content sizing computes measured height and reuses identical child slots",()=>{
 const tree=MeasureLayoutTree([Wrap()]);
 const snap=ArrangeMeasuredGeometry(tree,Root(),1,Enabled);
 assert.deepEqual(snap.byId.get("wrap").localRect,{x:0,y:0,width:100,height:38});
 assert.deepEqual(snap.appliedWrapContent,[{
  id:"wrap",axis:"vertical",evidence:"native-derived-wrap-lines",lineCount:2,requiredHeight:38
 }]);
 assert.deepEqual(snap.appliedStrategies,[{
  id:"wrap",kind:"wrap",evidence:"native-disassembly",mode:"fixed-wrap-prototype"
 }]);
 assert.deepEqual(snap.issues,[]);
 assert.deepEqual(["a","b","c"].map(id=>snap.byId.get(id).localRect),[
  {x:2,y:2,width:40,height:10},
  {x:44,y:2,width:40,height:20},
  {x:2,y:24,width:40,height:12}
 ]);
});

test("wrap content height follows resolved width without parent-height feedback",()=>{
 const wrap=Node("wrap","WrapSpacerWidgetClass",[
  ["size","0.5 90"],["vexactsize","1"],...SizeV
 ],Children());
 const tree=MeasureLayoutTree([wrap]);
 const narrow=ArrangeMeasuredGeometry(tree,Root(120),1,Enabled);
 const medium=ArrangeMeasuredGeometry(tree,Root(200),1,Enabled);
 const wide=ArrangeMeasuredGeometry(tree,Root(400),1,Enabled);
 assert.deepEqual([narrow.byId.get("wrap").localRect.width,
  medium.byId.get("wrap").localRect.width,wide.byId.get("wrap").localRect.width],[60,100,200]);
 assert.deepEqual([narrow.byId.get("wrap").localRect.height,
  medium.byId.get("wrap").localRect.height,wide.byId.get("wrap").localRect.height],[50,38,24]);
 assert.deepEqual([narrow.appliedWrapContent[0].lineCount,
  medium.appliedWrapContent[0].lineCount,wide.appliedWrapContent[0].lineCount],[3,2,1]);
});

test("vertical anchored Wrap re-resolves its own position after content height changes",()=>{
 const root=Wrap([
  ["position","0 5"],["vexactpos","1"],["valign","bottom_ref"]
 ]);
 const tree=MeasureLayoutTree([root]);
 const snap=ArrangeMeasuredGeometry(tree,Root(500,300),1,Enabled);
 assert.deepEqual(snap.byId.get("wrap").localRect,{x:0,y:257,width:100,height:38});
 assert.equal(snap.byId.get("a").absoluteRect.y,259);
});

test("horizontal Wrap alignment is preserved while vertical size is negotiated",()=>{
 const wrap=Wrap([["content_halign","2"]]);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([wrap]),Root(),1,Enabled);
 assert.equal(snap.byId.get("wrap").localRect.height,38);
 assert.deepEqual(["a","b","c"].map(id=>snap.byId.get(id).localRect.x),[9,51,30]);
});

test("unverified content width, vertical alignment and unsafe children never enter sizing",()=>{
 const variants=[
  Wrap([["Size To Content H","1"]]),
  Wrap([["content_valign","1"]]),
  Wrap([["content_halign","BAD"]]),
  Wrap([],[]),
  Wrap([], [Child("oversized",100,20)]),
  Wrap([], [Node("hidden","ButtonWidgetClass",[...Fixed(20,20),["visible","0"]])]),
  Wrap([], [Node("relative","ButtonWidgetClass",[["size","0.3 20"],["vexactsize","1"]])]),
  Wrap([], [Node("childcontent","ButtonWidgetClass",[...Fixed(20,20),...SizeV])])
 ];
 for(const wrap of variants) {
  const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([wrap]),Root(),1,Enabled);
  assert.deepEqual(snap.appliedWrapContent,[]);
  assert.deepEqual(snap.appliedStrategies,[]);
  assert.equal(snap.byId.get("wrap").localRect.height,90);
  assert.ok(snap.issues.some(i=>i.code==="unresolved-size-to-content"));
 }
});

test("other managed widgets cannot inherit Wrap content measurement",()=>{
 const roots=["GridSpacerWidgetClass","ScrollWidgetClass","ContentWidgetClass","PanelWidgetClass"]
  .map((type,i)=>Node("other"+i,type,[...Fixed(100,90),...SizeV],Children()
   .map(c=>Node(i+c.id,c.type,c.properties.map(p=>[p.name,p.value])))));
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree(roots),Root(),1,Enabled);
 assert.deepEqual(snap.appliedWrapContent,[]);
 assert.equal(snap.entries.length,16);
 for(const root of roots) assert.equal(snap.byId.get(root.id).localRect.height,90);
});

test("ordinary content-sized parent still rejects a child Wrap whose own height is unresolved",()=>{
 const wrap=Node("wrap","WrapSpacerWidgetClass",[
  ["position","0 4"],["hexactpos","1"],["vexactpos","1"],...Fixed(100,90),...SizeV
 ],Children());
 const parent=Node("outer","FrameWidgetClass",[
  ...Fixed(300,20),...SizeV
 ],[wrap]);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([parent]),Root(),1,{
  ...Enabled,boundedParentContent:true
 });
 assert.equal(snap.byId.get("outer").localRect.height,20);
 assert.equal(snap.byId.get("wrap").localRect.height,38);
 assert.deepEqual(snap.appliedWrapContent.map(x=>x.id),["wrap"]);
 assert.ok(snap.issues.some(i=>i.code==="unresolved-parent-content-dependency"));
});
