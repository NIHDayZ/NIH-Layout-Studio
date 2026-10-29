import test from "node:test";
import assert from "node:assert/strict";
import { MeasureLayoutTree, ChildConstraints } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry, BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const prop=(name,value)=>({name,value});
function Node(id,type,properties=[],children=[]) {
 return { id,name:id,type,properties:properties.map(([name,value])=>prop(name,value)),children };
}
const rootRect={x:0,y:0,width:1280,height:720};

test("bottom-up phase separates intrinsic exact size from relative size at nested depths",()=>{
 const leaf=Node("leaf","TextWidgetClass",[["size","240 0.5"],["hexactsize","1"]]);
 const nested=Node("nested","PanelWidgetClass",[["size","0.4 70"],["vexactsize","1"]],[leaf]);
 const root=Node("root","FrameWidgetClass",[["size","500 400"],["hexactsize","1"],["vexactsize","1"]],[nested]);
 const tree=MeasureLayoutTree([root]);
 assert.equal(tree.nodeCount,3);
 assert.equal(tree.roots.length,1);
 assert.equal(tree.roots[0].children[0].children[0].node,leaf);
 const [frame,panel,text]=[tree.roots[0],tree.roots[0].children[0],tree.roots[0].children[0].children[0]];
 assert.deepEqual([frame.measurement.preferredWidth,frame.measurement.preferredHeight],[500,400]);
 assert.deepEqual([panel.measurement.preferredWidth,panel.measurement.preferredHeight],[0,70]);
 assert.deepEqual([text.measurement.preferredWidth,text.measurement.preferredHeight],[240,0]);
 assert.equal(panel.measurement.dependsOnParentWidth,true);
 assert.equal(text.measurement.dependsOnParentHeight,true);
 assert.equal(tree.unresolvedContentSizeCount,0);
 assert.equal(tree.managedContainerCount,0);
});

test("native size-to-content requests remain explicit unresolved measurements",()=>{
 const a=Node("sized","PanelWidgetClass",[["size","100 300"],["hexactsize","1"],["vexactsize","1"],
  ["Size To Content H","1"],["Size To Content V","1"]],[Node("label","TextWidgetClass",[["size","0.5 0.5"]])]);
 const tree=MeasureLayoutTree([a]);
 assert.equal(tree.unresolvedContentSizeCount,1);
 assert.equal(tree.roots[0].unresolvedContentWidth,true);
 assert.equal(tree.roots[0].unresolvedContentHeight,true);
 // An authored size is an initial hint. We must not pretend it is the final
 // Workbench content-sized width/height.
 assert.deepEqual([tree.roots[0].measurement.preferredWidth,tree.roots[0].measurement.preferredHeight],[100,300]);
 const snapshot=ArrangeMeasuredGeometry(tree,rootRect);
 assert.deepEqual(snapshot.issues.map(x=>x.code),["unresolved-size-to-content"]);
 assert.match(snapshot.issues[0].detail,/horizontal and vertical/);
 assert.deepEqual(snapshot.byId.get("sized").absoluteRect,{x:0,y:0,width:100,height:300});
 assert.deepEqual(snapshot.byId.get("label").absoluteRect,{x:0,y:0,width:50,height:150});
});

test("managed containers retain authored child rectangles and report missing arrangements",()=>{
 const panel=Node("panel","GridSpacerWidgetClass",[["size","300 300"],["hexactsize","1"],["vexactsize","1"]],
   [Node("button","ButtonWidgetClass",[["size","30 40"],["hexactsize","1"],["vexactsize","1"]])]);
 const tree=MeasureLayoutTree([panel]);
 assert.equal(tree.managedContainerCount,1);
 const snapshot=ArrangeMeasuredGeometry(tree,rootRect);
 assert.equal(snapshot.issues.length,1);
 assert.equal(snapshot.issues[0].code,"unresolved-layout-strategy");
 assert.deepEqual(snapshot.byId.get("button").localRect,{x:0,y:0,width:30,height:40});
});

test("prepared tree can be reused at several resolutions without decoding properties again",()=>{
 const label=Node("label","TextWidgetClass",[["size","15 20"],["hexactsize","1"],["vexactsize","1"]]);
 const parent=Node("parent","FrameWidgetClass",[["position","0.25 0.25"],["size","0.5 0.5"]],[label]);
 const tree=MeasureLayoutTree([parent]);
 const first=ArrangeMeasuredGeometry(tree,{x:0,y:0,width:1920,height:1080});
 const second=ArrangeMeasuredGeometry(tree,{x:0,y:0,width:1280,height:720},2);
 assert.deepEqual(first.byId.get("label").absoluteRect,{x:480,y:270,width:15,height:20});
 assert.deepEqual(second.byId.get("label").absoluteRect,{x:320,y:180,width:15,height:20});
 assert.deepEqual(first.entries,BuildAuthoredGeometrySnapshot([parent],{x:0,y:0,width:1920,height:1080}).entries);
 assert.equal(tree.roots[0].measurement.dependsOnParentWidth,true);
});

test("hidden content retains authored measurements but cannot make descendants visible",()=>{
 const root=Node("hidden","FrameWidgetClass",[["visible","0"]],
  [Node("exact","ImageWidgetClass",[["visible","1"],["size","100 100"],["hexactsize","1"],["vexactsize","1"]])]);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([root]),rootRect);
 assert.equal(snap.byId.get("exact").visible,false);
 assert.equal(snap.measuredById.get("exact").preferredWidth,100);
});

test("nonwidget declarations are excluded from both measurement and arrangement",()=>{
 const roots=[Node("ignored","SomeConfigClass",[],[Node("hidden","TextWidgetClass")]),
  Node("visible","PanelWidgetClass")];
 const tree=MeasureLayoutTree(roots);
 assert.equal(tree.nodeCount,1);
 const arranged=ArrangeMeasuredGeometry(tree,rootRect);
 assert.deepEqual(arranged.entries.map(x=>x.id),["visible"]);
});

test("constraints keep independent pixel dimensions and do not secretly apply DPI scaling",()=>{
 const constraints=ChildConstraints({availableWidth:232.5,availableHeight:481.25},2);
 assert.deepEqual(constraints,{availableWidth:232.5,availableHeight:481.25,dpiScale:2});
 assert.deepEqual(ChildConstraints({availableWidth:0,availableHeight:0},1),
  {availableWidth:0,availableHeight:0,dpiScale:1});
});


test("arranging a prepared tree at multiple resolutions never rereads authored properties",()=>{
 let propertyNameReads=0;
 let propertyValueReads=0;
 const observed=(name,value)=>({
  get name() { ++propertyNameReads; return name; },
  get value() { ++propertyValueReads; return value; }
 });
 const child=Node("button","ButtonWidgetClass",[
  ["position","0.5 0.25"],["size","1 1"]
 ]);
 const grid={
  id:"grid",name:"grid",type:"GridSpacerWidgetClass",
  properties:[
   observed("size","300 200"),observed("hexactsize","1"),observed("vexactsize","1"),
   observed("Columns","1"),observed("Rows","1"),observed("Padding","2"),observed("Margin","2")
  ],
  children:[child]
 };
 const measured=MeasureLayoutTree([grid]);
 assert.ok(propertyNameReads>0);
 assert.ok(propertyValueReads>0);
 const nameReadsAfterMeasure=propertyNameReads;
 const valueReadsAfterMeasure=propertyValueReads;
 const first=ArrangeMeasuredGeometry(measured,rootRect,1,{constrainedGrid:true});
 const second=ArrangeMeasuredGeometry(measured,{x:0,y:0,width:1920,height:1080},1,{constrainedGrid:true});
 assert.equal(propertyNameReads,nameReadsAfterMeasure);
 assert.equal(propertyValueReads,valueReadsAfterMeasure);
 assert.equal(first.appliedStrategies.length,1);
 assert.equal(second.appliedStrategies.length,1);
});
