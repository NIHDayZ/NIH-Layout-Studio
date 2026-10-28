import test from "node:test";
import assert from "node:assert/strict";
import { BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";

function Node(id, type, properties=[], children=[]) {
 return {id,name:id,type,properties:properties.map(([name,value])=>({name,value})),children};
}
const Root = (width,height) => ({x:0,y:0,width,height});

test("read-only hierarchy records parent-local and absolute rectangles independently", () => {
 const label=Node("label","TextWidgetClass",[["position","10 5"],["size","40 12"],
  ["hexactpos","1"],["vexactpos","1"],["hexactsize","1"],["vexactsize","1"]]);
 const parent=Node("panel","PanelWidgetClass",[["position","0.25 0.5"],["size","0.5 0.2"]],[label]);
 const snapshot=BuildAuthoredGeometrySnapshot([parent],Root(1920,1080));
 assert.equal(snapshot.entries.length,2);
 assert.deepEqual(snapshot.entries.map(x=>x.id),["panel","label"]);
 assert.deepEqual(snapshot.byId.get("panel").absoluteRect,{x:480,y:540,width:960,height:216});
 assert.deepEqual(snapshot.byId.get("label").localRect,{x:10,y:5,width:40,height:12});
 assert.deepEqual(snapshot.byId.get("label").absoluteRect,{x:490,y:545,width:40,height:12});
 assert.equal(snapshot.byId.get("label").parentId,"panel");
 assert.deepEqual(snapshot.byId.get("label").clipRect,Root(1920,1080));
 assert.deepEqual(snapshot.issues,[]);
});

test("same normalized hierarchy produces different absolute sizes at each root resolution", () => {
 const panel=Node("panel","FrameWidgetClass",[["position","0.1 0.25"],["size","0.5 0.5"]],
  [Node("edge","ImageWidgetClass",[["position","15 -10"],["size","20 30"],["hexactpos","1"],
   ["vexactpos","1"],["hexactsize","1"],["vexactsize","1"]])]);
 const first=BuildAuthoredGeometrySnapshot([panel],Root(1920,1080));
 const second=BuildAuthoredGeometrySnapshot([panel],Root(1280,720));
 assert.deepEqual(first.byId.get("edge").absoluteRect,{x:207,y:260,width:20,height:30});
 assert.deepEqual(second.byId.get("edge").absoluteRect,{x:143,y:170,width:20,height:30});
});

test("clipChildren on a parent intersects nested clips but not the parent's own clip", () => {
 const outer=Node("outer","PanelWidgetClass",[["position","50 50"],["size","100 100"],
  ["hexactpos","1"],["vexactpos","1"],["hexactsize","1"],["vexactsize","1"],["clipchildren","1"]],[
   Node("inner","FrameWidgetClass",[["position","75 0"],["size","60 70"],
    ["hexactpos","1"],["vexactpos","1"],["hexactsize","1"],["vexactsize","1"],["clipchildren","1"]],[
    Node("text","TextWidgetClass",[["size","1 1"]])
   ])
  ]);
 const snap=BuildAuthoredGeometrySnapshot([outer],Root(200,200));
 assert.deepEqual(snap.byId.get("outer").clipRect,Root(200,200));
 assert.deepEqual(snap.byId.get("inner").clipRect,{x:50,y:50,width:100,height:100});
 assert.deepEqual(snap.byId.get("text").clipRect,{x:125,y:50,width:25,height:70});
});

test("visibility inherits through parent even if descendant explicitly sets visible to one", () => {
 const hidden=Node("hidden","FrameWidgetClass",[["visible","0"]],
  [Node("child","ImageWidgetClass",[["visible","1"]])]);
 const snap=BuildAuthoredGeometrySnapshot([hidden],Root(640,480));
 assert.equal(snap.byId.get("hidden").visible,false);
 assert.equal(snap.byId.get("child").visible,false);
});

test("document order, priorities and duplicate IDs remain inspectable", () => {
 const one=Node("dup","ButtonWidgetClass",[["priority","9"]]);
 const two=Node("dup","ButtonWidgetClass",[["priority","-2"]]);
 const snap=BuildAuthoredGeometrySnapshot([one,two],Root(100,100));
 assert.equal(snap.entries.length,2);
 assert.deepEqual(snap.entries.map(x=>x.sortOrder),[9,-2]);
 assert.equal(snap.byId.get("dup").sortOrder,9);
 assert.equal(snap.issues.length,1);
 assert.equal(snap.issues[0].code,"duplicate-widget-id");
});

test("grid, wrap and scroll children are explicitly reported as authored-only", () => {
 const types=["GridSpacerWidgetClass","WrapSpacerWidgetClass","ScrollWidgetClass"];
 const roots=types.map((type,i)=>Node("container-"+i,type,[],
  [Node("child-"+i,"ButtonWidgetClass",[["position","90 50"],["size","12 20"],["hexactpos","1"],["vexactpos","1"],["hexactsize","1"],["vexactsize","1"]])]));
 const snap=BuildAuthoredGeometrySnapshot(roots,Root(800,600));
 assert.deepEqual(snap.issues.map(x=>x.code),Array(3).fill("unresolved-layout-strategy"));
 assert.deepEqual(snap.issues.map(x=>x.type),types);
 assert.equal(snap.byId.get("child-0").localRect.x,90);
});

test("snapshot generation does not mutate authored layout nodes or input root", () => {
 const roots=[Node("parent","PanelWidgetClass",[["position","0.3 0.2"]],[Node("child","TextWidgetClass")])];
 const source=JSON.stringify(roots), root=Root(1024,768);
 const snap=BuildAuthoredGeometrySnapshot(roots,root);
 assert.equal(JSON.stringify(roots),source);
 assert.deepEqual(root,Root(1024,768));
 assert.notStrictEqual(snap.rootRect,root);
 assert.equal(snap.entries.length,2);
});
