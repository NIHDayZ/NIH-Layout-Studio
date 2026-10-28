import test from "node:test";
import assert from "node:assert/strict";
import { CreateSdfPreviewTextPreparer } from "../.geometry-engine-test-build/ConstrainedText.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const prop = (name,value) => ({name,value});
const Node = (id,type,properties=[],children=[]) => ({
 id,name:id,type,properties:properties.map(([name,value])=>prop(name,value)),children
});
const Root = (width,height=100) => ({x:0,y:0,width,height});
const glyphs = new Map([...["a"," "].map(ch=>[ch.codePointAt(0),{advance:1000}])]);
const font = {fontSize:10,pixelAdvances:false,glyphs};
const previewSource = {font,displaySize:10,lineHeight:12,wrap:true};
const makeText = (extra=[],children=[])=>Node("label","TextWidgetClass",[
 ["text","aa aa aa"],["size","0.5 40"],["vexactsize","1"],
 ["Size To Content V","1"],...extra
],children);

test("prepared constrained text is evaluated after width resolution and reused per viewport",()=>{
 let resolves=0;
 const prepare=CreateSdfPreviewTextPreparer(()=>{++resolves;return previewSource});
 const tree=MeasureLayoutTree([makeText()],{constrainedText:prepare});
 assert.equal(resolves,1);
 assert.equal(tree.roots[0].textFlow?.evidence,"sdf-preview-flow");
 const defaultSnapshot=ArrangeMeasuredGeometry(tree,Root(100));
 assert.deepEqual(defaultSnapshot.appliedConstrainedText,[]);
 assert.deepEqual(defaultSnapshot.byId.get("label").localRect,{x:0,y:0,width:50,height:40});
 assert.equal(defaultSnapshot.issues[0].code,"unresolved-size-to-content");
 const narrow=ArrangeMeasuredGeometry(tree,Root(100),1,{constrainedTextPreview:true});
 const wide=ArrangeMeasuredGeometry(tree,Root(200),1,{constrainedTextPreview:true});
 assert.deepEqual(narrow.byId.get("label").localRect,{x:0,y:0,width:50,height:24});
 assert.deepEqual(wide.byId.get("label").localRect,{x:0,y:0,width:100,height:12});
 assert.deepEqual(narrow.appliedConstrainedText,[{
  id:"label",evidence:"sdf-preview-flow",widthUsed:50,lineCount:2,axis:"vertical"
 }]);
 assert.deepEqual(wide.appliedConstrainedText,[{
  id:"label",evidence:"sdf-preview-flow",widthUsed:100,lineCount:1,axis:"vertical"
 }]);
 assert.deepEqual(narrow.issues,[]);
 assert.equal(resolves,1);
});

test("vertical alignment is re-resolved when constrained height changes",()=>{
 const anchored=makeText([["position","0 5"],["vexactpos","1"],["valign","bottom_ref"]]);
 const tree=MeasureLayoutTree([anchored],{
  constrainedText:CreateSdfPreviewTextPreparer(()=>previewSource)
 });
 const narrow=ArrangeMeasuredGeometry(tree,Root(100,200),1,{constrainedTextPreview:true});
 const wide=ArrangeMeasuredGeometry(tree,Root(200,200),1,{constrainedTextPreview:true});
 assert.equal(narrow.byId.get("label").localRect.y,171);
 assert.equal(wide.byId.get("label").localRect.y,183);
});

test("missing glyphs and invalid width refuse results without fallback approximations",()=>{
 const missing=Node("label","TextWidgetClass",[
  ["text","ab"],["size","0.5 40"],["vexactsize","1"],["Size To Content V","1"]
 ]);
 const tree=MeasureLayoutTree([missing],{
  constrainedText:CreateSdfPreviewTextPreparer(()=>previewSource)
 });
 assert.equal(tree.roots[0].textFlow,null);
 const unresolved=ArrangeMeasuredGeometry(tree,Root(200),1,{constrainedTextPreview:true});
 assert.deepEqual(unresolved.appliedConstrainedText,[]);
 assert.equal(unresolved.issues[0].code,"unresolved-size-to-content");
 const prepared=MeasureLayoutTree([makeText()],{
  constrainedText:CreateSdfPreviewTextPreparer(()=>previewSource)
 });
 const zero=ArrangeMeasuredGeometry(prepared,Root(0),1,{constrainedTextPreview:true});
 assert.deepEqual(zero.appliedConstrainedText,[]);
 assert.equal(zero.byId.get("label").localRect.height,40);
 assert.equal(zero.issues[0].code,"unresolved-size-to-content");
});

test("horizontal Size To Content is never inferred from width-dependent text",()=>{
 let resolves=0;
 const ambiguous=makeText([["Size To Content H","1"]]);
 const tree=MeasureLayoutTree([ambiguous],{
  constrainedText:CreateSdfPreviewTextPreparer(()=>{++resolves;return previewSource})
 });
 assert.equal(resolves,0);
 const snapshot=ArrangeMeasuredGeometry(tree,Root(200),1,{constrainedTextPreview:true});
 assert.deepEqual(snapshot.appliedConstrainedText,[]);
 assert.equal(snapshot.byId.get("label").localRect.height,40);
 assert.match(snapshot.issues[0].detail,/horizontal and vertical/);
});

test("text containers and unrelated classes do not get leaf constrained measurement",()=>{
 let resolves=0;
 const prepare=CreateSdfPreviewTextPreparer(()=>{++resolves;return previewSource});
 const parent=makeText([], [Node("child","PanelWidgetClass")]);
 const other=Node("other","RichTextWidgetClass",[
  ["text","aa aa aa"],["size","0.5 40"],["Size To Content V","1"]
 ]);
 const tree=MeasureLayoutTree([parent,other],{constrainedText:prepare});
 assert.equal(resolves,0);
 const preview=ArrangeMeasuredGeometry(tree,Root(100),1,{constrainedTextPreview:true});
 assert.deepEqual(preview.appliedConstrainedText,[]);
 assert.deepEqual(preview.issues.map(issue=>issue.code),
  ["unresolved-size-to-content","unresolved-size-to-content"]);
});

test("explicit constrained preview wins over an independent height only in prototype mode",()=>{
 const tree=MeasureLayoutTree([makeText()],{
  constrainedText:CreateSdfPreviewTextPreparer(()=>previewSource),
  intrinsics:{text:()=>({
   height:99,evidence:"font-metrics",heightIndependent:true,widthIndependent:false
  })}
 });
 const baseline=ArrangeMeasuredGeometry(tree,Root(100),1,{providedIntrinsicContent:true});
 assert.equal(baseline.byId.get("label").localRect.height,99);
 assert.deepEqual(baseline.appliedConstrainedText,[]);
 const measured=ArrangeMeasuredGeometry(tree,Root(100),1,{
  providedIntrinsicContent:true,constrainedTextPreview:true
 });
 assert.equal(measured.byId.get("label").localRect.height,24);
 assert.equal(measured.appliedIntrinsics.length,0);
 assert.equal(measured.appliedConstrainedText.length,1);
});

test("grid-assigned geometry is not rewritten by a text flow preview",()=>{
 const child=makeText();
 const grid=Node("grid","GridSpacerWidgetClass",[
  ["size","100 100"],["hexactsize","1"],["vexactsize","1"],
  ["Columns","1"],["Rows","1"]
 ],[child]);
 const tree=MeasureLayoutTree([grid],{
  constrainedText:CreateSdfPreviewTextPreparer(()=>previewSource)
 });
 const arranged=ArrangeMeasuredGeometry(tree,Root(200),1,{
  constrainedGrid:true,constrainedTextPreview:true
 });
 assert.deepEqual(arranged.appliedConstrainedText,[]);
 assert.equal(arranged.appliedStrategies.length,1);
 assert.equal(arranged.byId.get("label").localRect.height,96);
 assert.equal(arranged.issues[0].code,"unresolved-size-to-content");
});

test("untrusted or incomplete font metrics cannot activate a constrained text result",()=>{
 const bad=[
  { ...previewSource,displaySize:NaN },
  { ...previewSource,lineHeight:-1 },
  { ...previewSource,font:{...font,glyphs:new Map()} }
 ];
 for(const source of bad) {
  const tree=MeasureLayoutTree([makeText()],{
   constrainedText:CreateSdfPreviewTextPreparer(()=>source)
  });
  const result=ArrangeMeasuredGeometry(tree,Root(100),1,{constrainedTextPreview:true});
  assert.deepEqual(result.appliedConstrainedText,[]);
  assert.equal(result.issues[0].code,"unresolved-size-to-content");
 }
});
