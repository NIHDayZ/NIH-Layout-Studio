import test from "node:test";
import assert from "node:assert/strict";
import {
 DecodeNativeIgnoreInvisible, SelectManagedChildIndices, ScatterManagedRects
} from "../.geometry-engine-test-build/ManagedVisibility.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const Root={x:0,y:0,width:500,height:400};
const Fixed=(w,h)=>[["size",w+" "+h],["hexactsize","1"],["vexactsize","1"]];
const Position=(x,y)=>[["position",x+" "+y],["hexactpos","1"],["vexactpos","1"]];
function Node(id,type,properties=[],children=[]) {
 return {id,name:id,type,properties:properties.map(([name,value])=>({name,value})),children};
}
function Children(){
 return [
  Node("first","PanelWidgetClass",[...Position(10,2),...Fixed(40,10)]),
  Node("hidden","PanelWidgetClass",[...Position(200,5),...Fixed(40,20),["visible","0"]]),
  Node("last","PanelWidgetClass",[...Position(50,30),...Fixed(40,12)])
 ];
}
const Grid=(ignore)=>Node("grid","GridSpacerWidgetClass",[
 ...Fixed(100,90),["Columns","2"],["Rows","2"],...ignore
],Children());
const Wrap=(ignore)=>Node("wrap","WrapSpacerWidgetClass",[
 ...Fixed(100,90),...ignore
],Children());
const Scroll=(ignore)=>Node("scroll","ScrollWidgetClass",[
 ...Fixed(100,60),...ignore
],Children());

test("native Ignore invisible defaults enabled; exact first property wins; malformed values are unknown",()=>{
 assert.equal(DecodeNativeIgnoreInvisible([]),true);
 assert.equal(DecodeNativeIgnoreInvisible([{name:"Ignore invisible",value:"0"}]),false);
 assert.equal(DecodeNativeIgnoreInvisible([
  {name:"IGNORE INVISIBLE",value:" 1 "},{name:"Ignore invisible",value:"0"}
 ]),true);
 for(const raw of ["yes","2","maybe",""]) {
  assert.equal(DecodeNativeIgnoreInvisible([{name:"Ignore invisible",value:raw}]),null);
 }
});

test("one selector preserves original indices and sparse slots after filtering",()=>{
 const nodes=Children().map(node=>({authored:{visible:!node.properties.some(x=>x.name==="visible"&&x.value==="0")}}));
 assert.deepEqual(SelectManagedChildIndices(nodes,true),[0,2]);
 assert.deepEqual(SelectManagedChildIndices(nodes,false),[0,1,2]);
 assert.equal(SelectManagedChildIndices(nodes,null),null);
 const slots=ScatterManagedRects([0,2],[
  {x:2,y:2,width:20,height:10},{x:24,y:2,width:20,height:10}
 ],3);
 assert.equal(slots.length,3);
 assert.equal(slots[1],undefined);
 assert.equal(slots[2].x,24);
 assert.equal(ScatterManagedRects([0,0],slots.slice(0,2),3),null);
 assert.equal(ScatterManagedRects([3],slots.slice(0,1),3),null);
});

test("Grid uses the native default to skip hidden slots, but includes them when disabled",()=>{
 const skipped=ArrangeMeasuredGeometry(MeasureLayoutTree([Grid([])]),Root,1,{constrainedGrid:true});
 const included=ArrangeMeasuredGeometry(MeasureLayoutTree([Grid([["Ignore invisible","0"]])]),Root,1,{constrainedGrid:true});
 assert.deepEqual(skipped.appliedStrategies.map(x=>x.kind),["grid"]);
 assert.deepEqual(included.appliedStrategies.map(x=>x.kind),["grid"]);
 assert.equal(skipped.byId.get("hidden").visible,false);
 assert.equal(skipped.byId.get("hidden").localRect.x,200);
 assert.equal(included.byId.get("hidden").visible,false);
 assert.ok(included.byId.get("hidden").localRect.x < 100);
 assert.equal(skipped.byId.get("last").localRect.y,2);
 assert.ok(included.byId.get("last").localRect.y>2);
});

test("Wrap uses the same shared visibility selector for line packing",()=>{
 const skipped=ArrangeMeasuredGeometry(MeasureLayoutTree([Wrap([])]),Root,1,{fixedWrap:true});
 const included=ArrangeMeasuredGeometry(MeasureLayoutTree([Wrap([["Ignore invisible","0"]])]),Root,1,{fixedWrap:true});
 assert.deepEqual(skipped.appliedStrategies.map(x=>x.kind),["wrap"]);
 assert.deepEqual(included.appliedStrategies.map(x=>x.kind),["wrap"]);
 assert.equal(skipped.byId.get("hidden").localRect.x,200);
 assert.equal(skipped.byId.get("last").localRect.x,44);
 assert.equal(skipped.byId.get("last").localRect.y,2);
 assert.equal(included.byId.get("last").localRect.x,2);
 assert.equal(included.byId.get("last").localRect.y,24);
 assert.equal(included.byId.get("hidden").visible,false);
});

test("Scroll bounds and native max extent respect the same native Ignore invisible flag",()=>{
 const opts={scrollViewportDiagnostics:true,scrollNativeExtentDiagnostics:true};
 const skipped=ArrangeMeasuredGeometry(MeasureLayoutTree([Scroll([])]),Root,1,opts);
 const included=ArrangeMeasuredGeometry(MeasureLayoutTree([Scroll([["Ignore invisible","0"]])]),Root,1,opts);
 assert.equal(skipped.scrollViewports.get("scroll").directChildCount,2);
 assert.equal(included.scrollViewports.get("scroll").directChildCount,3);
 assert.equal(skipped.scrollViewports.get("scroll").overhang.right,0);
 assert.equal(included.scrollViewports.get("scroll").overhang.right,140);
 assert.equal(skipped.scrollExtentCandidates.get("scroll").width,100);
 assert.equal(included.scrollExtentCandidates.get("scroll").width,240);
 assert.deepEqual(skipped.entries.map(x=>x.id),included.entries.map(x=>x.id));
});

test("invalid native visibility policy rejects managed-child inference in every family",()=>{
 const prop=[["Ignore invisible","unknown"]];
 const cases=[
  [Grid(prop),{constrainedGrid:true}],
  [Wrap(prop),{fixedWrap:true}],
  [Scroll(prop),{scrollViewportDiagnostics:true,scrollNativeExtentDiagnostics:true}]
 ];
 for(const [root,options] of cases){
  const tree=MeasureLayoutTree([root]);
  assert.equal(tree.roots[0].nativeIgnoreInvisible,null);
  const snapshot=ArrangeMeasuredGeometry(tree,Root,1,options);
  assert.equal(snapshot.appliedStrategies.length,0);
  assert.equal(snapshot.scrollViewports.size,0);
  assert.equal(snapshot.scrollExtentCandidates.size,0);
  assert.ok(snapshot.issues.some(x=>x.code==="unresolved-layout-strategy"));
 }
});

test("default snapshots remain unchanged even when managed visibility is known",()=>{
 const root=Wrap([]);
 const prepared=MeasureLayoutTree([root]);
 assert.equal(prepared.roots[0].nativeIgnoreInvisible,true);
 const snapshot=ArrangeMeasuredGeometry(prepared,Root);
 assert.deepEqual(snapshot.appliedStrategies,[]);
 assert.deepEqual(snapshot.issues.map(x=>x.code),["unresolved-layout-strategy"]);
 assert.equal(snapshot.byId.get("hidden").visible,false);
 assert.equal(snapshot.byId.get("hidden").localRect.x,200);
});
