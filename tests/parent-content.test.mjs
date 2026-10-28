import test from "node:test";
import assert from "node:assert/strict";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";
import { ResolveBoundedParentHeight } from "../.geometry-engine-test-build/ParentContent.js";

const Root = (width, height = 300) => ({ x: 0, y: 0, width, height });
function Node(id, type, properties = [], children = []) {
 return { id, name: id, type, properties: properties.map(([name, value]) => ({ name, value })), children };
}
const ExactPosition = [["hexactpos","1"],["vexactpos","1"]];
const Fixed = (width, height) => [["size",width+" "+height],["hexactsize","1"],["vexactsize","1"]];
const Content = [["Size To Content V","1"]];
const Frame = (children, overrides = []) => Node("frame","FrameWidgetClass",[
 ...Fixed(200,13),...Content,...overrides
],children);
const Child = (id, y, height) => Node(id,"ImageWidgetClass",[
 ["position","0 "+y],...ExactPosition,...Fixed(50,height)
]);
const Text = (id, y, width = 0.5) => Node(id,"TextWidgetClass",[
 ["text","aa aa aa"],["position","0 "+y],...ExactPosition,
 ["size",String(width)+" 80"],["vexactsize","1"],...Content
]);
const TextSource = () => ({
 evidence:"sdf-preview-flow",
 measure(width) {
  if (!(width > 0)) return null;
  const lines = width >= 80 ? 1 : 2;
  return { evidence:"sdf-preview-flow",height:lines*12,lineCount:lines,widthUsed:width };
 }
});
const prep = (roots, providers = {}) => MeasureLayoutTree(roots,{
 constrainedText:()=>TextSource(),...providers
});
const options = { boundedParentContent:true, constrainedTextPreview:true };

test("parent height derives only from top-referenced exact child extents",()=>{
 const frame=Frame([Child("first",4,25),Child("second",35,13)]);
 const measured=prep([frame]);
 const defaultPreview=ArrangeMeasuredGeometry(measured,Root(600));
 assert.equal(defaultPreview.byId.get("frame").localRect.height,13);
 assert.deepEqual(defaultPreview.appliedParentContent,[]);
 const resolved=ArrangeMeasuredGeometry(measured,Root(600),1,options);
 assert.equal(resolved.byId.get("frame").localRect.height,48);
 assert.equal(resolved.byId.get("second").absoluteRect.y,35);
 assert.deepEqual(resolved.appliedParentContent,[{
  id:"frame",evidence:"bounded-child-extent-prototype",axis:"vertical",contributingChildren:2
 }]);
 assert.equal(resolved.issues.length,0);
});

test("parent containing wrapped leaf text uses its final width before determining height",()=>{
 const frame=Node("frame","PanelWidgetClass",[
  ["size","0.5 10"],["vexactsize","1"],...Content
 ],[Text("label",5)]);
 const measured=prep([frame]);
 const narrow=ArrangeMeasuredGeometry(measured,Root(200),1,options);
 const wide=ArrangeMeasuredGeometry(measured,Root(400),1,options);
 assert.equal(narrow.byId.get("frame").localRect.width,100);
 assert.equal(narrow.byId.get("frame").localRect.height,29);
 assert.equal(narrow.byId.get("label").localRect.height,24);
 assert.equal(wide.byId.get("frame").localRect.width,200);
 assert.equal(wide.byId.get("frame").localRect.height,17);
 assert.equal(wide.byId.get("label").localRect.height,12);
 assert.deepEqual(narrow.appliedConstrainedText.map(x=>x.id),["label"]);
 assert.deepEqual(narrow.appliedParentContent.map(x=>x.id),["frame"]);
});

test("nested parent content height negotiation resolves child-first without a fixed-point loop",()=>{
 const inner=Node("inner","PanelWidgetClass",[
  ["position","0 10"],...ExactPosition,
  ["size","0.5 9"],["vexactsize","1"],...Content
 ],[Text("label",2)]);
 const outer=Node("outer","FrameWidgetClass",[
  ...Fixed(200,11),...Content
 ],[inner,Child("footer",20,5)]);
 const measured=prep([outer]);
 const snapshot=ArrangeMeasuredGeometry(measured,Root(1000),1,options);
 // inner width=100 -> label width=50 -> two 12px lines, at y=2
 assert.equal(snapshot.byId.get("inner").localRect.height,26);
 assert.equal(snapshot.byId.get("outer").localRect.height,36);
 assert.equal(snapshot.byId.get("label").absoluteRect.y,12);
 assert.equal(snapshot.byId.get("label").absoluteRect.height,24);
 assert.deepEqual(snapshot.appliedParentContent.map(x=>x.id),["outer","inner"]);
});

test("a parent-relative vertical offset introduces a dependency and is rejected",()=>{
 const child=Node("child","PanelWidgetClass",[
  ["position","0 0.25"],["hexactpos","1"],
  ...Fixed(30,20)
 ]);
 const frame=Frame([child]);
 const result=ArrangeMeasuredGeometry(prep([frame]),Root(500),1,options);
 assert.deepEqual(result.appliedParentContent,[]);
 assert.equal(result.byId.get("frame").localRect.height,13);
 assert.equal(result.issues[0].code,"unresolved-parent-content-dependency");
 assert.match(result.issues[0].detail,/parent-height-dependency at child/);
 assert.equal(result.issues[1].code,"unresolved-size-to-content");
});

test("bottom or center anchored children cannot define their parent's height",()=>{
 for(const vertical of ["bottom_ref","center_ref","bottom","center"]) {
  const child=Node("child","PanelWidgetClass",[
   ["position","0 7"],...ExactPosition,["valign",vertical],...Fixed(40,20)
  ]);
  const snap=ArrangeMeasuredGeometry(prep([Frame([child])]),Root(500),1,options);
  assert.deepEqual(snap.appliedParentContent,[]);
  assert.match(snap.issues[0].detail,/parent-height-dependency/);
 }
});

test("relative child heights and content-sized parent widths refuse a cyclic dependency",()=>{
 const relative=Node("relative","ImageWidgetClass",[
  ["position","0 5"],...ExactPosition,["size","1 0.3"]
 ]);
 let snap=ArrangeMeasuredGeometry(prep([Frame([relative])]),Root(500),1,options);
 assert.deepEqual(snap.appliedParentContent,[]);
 assert.match(snap.issues[0].detail,/parent-height-dependency/);
 const ambiguous=Frame([Child("child",0,20)],[["Size To Content H","1"]]);
 snap=ArrangeMeasuredGeometry(prep([ambiguous]),Root(500),1,options);
 assert.deepEqual(snap.appliedParentContent,[]);
 assert.match(snap.issues[0].detail,/parent-width-unresolved/);
});

test("managed container children and hidden children remain unresolved",()=>{
 const managed=Node("grid","GridSpacerWidgetClass",[
 ["position","0 0"],...ExactPosition,...Fixed(80,50)
 ],[Child("grandchild",0,25)]);
 let snap=ArrangeMeasuredGeometry(prep([Frame([managed])]),Root(500),1,options);
 assert.deepEqual(snap.appliedParentContent,[]);
 assert.match(snap.issues[0].detail,/managed-child-layout/);
 const hidden=Node("hidden","ImageWidgetClass",[
 ["position","0 0"],...ExactPosition,...Fixed(20,20),["visible","0"]
 ]);
 snap=ArrangeMeasuredGeometry(prep([Frame([hidden])]),Root(500),1,options);
 assert.deepEqual(snap.appliedParentContent,[]);
 assert.match(snap.issues[0].detail,/hidden-child/);
});

test("missing text measurements do not become guessed parent dimensions",()=>{
 const frame=Frame([Text("label",5)]);
 const tree=MeasureLayoutTree([frame]);
 const snap=ArrangeMeasuredGeometry(tree,Root(500),1,options);
 assert.equal(snap.byId.get("frame").localRect.height,13);
 assert.deepEqual(snap.appliedParentContent,[]);
 assert.match(snap.issues[0].detail,/unsupported-child-content/);
 assert.equal(snap.issues.filter(i=>i.code==="unresolved-size-to-content").length,2);
});

test("intrinsic image height is used only with its explicit enabling flag",()=>{
 const child=Node("icon","ImageWidgetClass",[
 ["position","0 4"],...ExactPosition,["size","50 60"],["hexactsize","1"],["vexactsize","1"],...Content
 ]);
 const providers={intrinsics:{image:()=>({
  height:18,evidence:"imageset-logical",widthIndependent:false,heightIndependent:true
 })}};
 const tree=prep([Frame([child])],providers);
 const noSource=ArrangeMeasuredGeometry(tree,Root(600),1,{boundedParentContent:true});
 assert.deepEqual(noSource.appliedParentContent,[]);
 const withSource=ArrangeMeasuredGeometry(tree,Root(600),1,{
  boundedParentContent:true,providedIntrinsicContent:true
 });
 assert.equal(withSource.byId.get("frame").localRect.height,22);
 assert.equal(withSource.byId.get("icon").localRect.height,18);
});

test("shared width-dependent text source is measured once per pass for parent and child",()=>{
 let calls=0;
 const frame=Frame([Text("label",1)]);
 const tree=prep([frame],{constrainedText:()=>({
  evidence:"sdf-preview-flow",
  measure(width) {
   ++calls;
   return {height:15,lineCount:1,widthUsed:width,evidence:"sdf-preview-flow"};
  }
 })});
 const first=ArrangeMeasuredGeometry(tree,Root(600),1,options);
 assert.equal(first.byId.get("frame").localRect.height,16);
 assert.equal(calls,1);
 const second=ArrangeMeasuredGeometry(tree,Root(800),1,options);
 assert.equal(second.byId.get("frame").localRect.height,16);
 assert.equal(calls,2);
});

test("independent solver refuses unsupported container classes without changing source",()=>{
 const button=Node("button","ButtonWidgetClass",[
 ...Fixed(200,12),...Content
 ],[Child("child",0,30)]);
 const tree=prep([button]), before=JSON.stringify(button);
 const result=ResolveBoundedParentHeight(tree.roots[0],200,{
  textHeight:()=>null,intrinsicHeight:()=>null
 });
 assert.deepEqual([result.result,result.failure,result.causeId],[null,"unsupported-parent","button"]);
 const arranged=ArrangeMeasuredGeometry(tree,Root(500),1,options);
 assert.equal(arranged.byId.get("button").localRect.height,12);
 assert.deepEqual(arranged.appliedParentContent,[]);
 assert.equal(JSON.stringify(button),before);
});
