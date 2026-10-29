import test from "node:test";
import assert from "node:assert/strict";
import { DecodeNativeGridSettings, PlanConstrainedGrid } from "../.geometry-engine-test-build/ConstrainedGrid.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry, BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const make=(id,type="ButtonWidgetClass",properties=[],children=[])=>({
 id,name:id,type,properties:properties.map(([name,value])=>({name,value})),children
});
const root=(width=900,height=600)=>({x:0,y:0,width,height});
const fixed=(w,h)=>[["size",w+" "+h],["hexactsize","1"],["vexactsize","1"]];

test("default grid settings are 3 by 3 with distinct native 2px Padding/Margin",()=>{
 assert.deepEqual(DecodeNativeGridSettings([]),{columns:3,rows:3,padding:2,margin:2});
 assert.deepEqual(DecodeNativeGridSettings([
  {name:"Rows",value:"5"},{name:"Columns",value:"2"},
  {name:"Padding",value:"9"},{name:"Margin",value:"4"}
 ]),{columns:2,rows:5,padding:9,margin:4});
 assert.deepEqual(DecodeNativeGridSettings([{name:"Columns",value:"0"}]).columns,3);
 assert.equal(DecodeNativeGridSettings([{name:"Margin",value:"3"},{name:"MARGIN",value:"30"}]).margin,3);
});

test("default snapshot never applies a prototype strategy silently",()=>{
 const children=Array.from({length:4},(_,i)=>make("button"+i,"ButtonWidgetClass",fixed(12,15)));
 const grid=make("grid","GridSpacerWidgetClass",fixed(300,150),children);
 const prepared=MeasureLayoutTree([grid]);
 const authored=ArrangeMeasuredGeometry(prepared,root());
 const convenience=BuildAuthoredGeometrySnapshot([grid],root());
 assert.deepEqual(authored.entries,convenience.entries);
 assert.deepEqual(authored.appliedStrategies,[]);
 assert.equal(authored.issues.length,1);
 assert.equal(authored.issues[0].code,"unresolved-layout-strategy");
 assert.deepEqual(authored.byId.get("button1").localRect,{x:0,y:0,width:12,height:15});
});

test("explicit constrained grid planner uses exactly the shared verified algorithm",()=>{
 const children=Array.from({length:4},(_,i)=>make("button"+i,"ButtonWidgetClass",fixed(12,15)));
 const grid=make("grid","GridSpacerWidgetClass",[...fixed(300,150),["Columns","2"],["Rows","2"]],children);
 const prepared=MeasureLayoutTree([grid]);
 assert.deepEqual(prepared.roots[0].nativeGrid,{columns:2,rows:2,padding:2,margin:2});
 const snap=ArrangeMeasuredGeometry(prepared,root(),1,{constrainedGrid:true});
 const plan=PlanConstrainedGrid(4,2,2,{width:300,height:150},2,2);
 assert.deepEqual(snap.appliedStrategies,[{id:"grid",kind:"grid",evidence:"native-disassembly",mode:"constrained-grid-prototype"}]);
 assert.deepEqual(snap.issues,[]);
 assert.deepEqual(children.map(child=>snap.byId.get(child.id).localRect),plan.rects);
 assert.deepEqual(snap.byId.get("button0").localRect,{x:2,y:2,width:147,height:72});
 assert.deepEqual(snap.byId.get("button3").localRect,{x:151,y:76,width:147,height:72});
});

test("constrained children negotiate nested authored geometry from assigned cell dimensions",()=>{
 const inner=make("label","TextWidgetClass",[["position","0.5 0.5"],["size","0.5 0.5"]]);
 const button=make("button","ButtonWidgetClass",fixed(40,20),[inner]);
 const grid=make("grid","GridSpacerWidgetClass",[...fixed(200,100),["Columns","1"],["Rows","1"],["Padding","10"],["Margin","0"]],[button]);
 const panel=make("panel","PanelWidgetClass",[
  ["position","60 40"],["hexactpos","1"],["vexactpos","1"],
  ...fixed(300,200)
 ],[grid]);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([panel]),root(),1,{constrainedGrid:true});
 assert.deepEqual(snap.byId.get("button").localRect,{x:10,y:10,width:180,height:80});
 assert.deepEqual(snap.byId.get("button").absoluteRect,{x:70,y:50,width:180,height:80});
 assert.deepEqual(snap.byId.get("label").absoluteRect,{x:160,y:90,width:90,height:40});
 assert.deepEqual(snap.appliedStrategies.map(x=>x.id),["grid"]);
});

test("two constrained grid parents can be arranged independently at multiple sizes",()=>{
 const children=["a","b","c"].map(id=>make(id,"TextWidgetClass",fixed(20,20)));
 const grid=make("grid","GridSpacerWidgetClass",[["Columns","3"],["Rows","1"],["size","1 1"]],children);
 const prepared=MeasureLayoutTree([grid]);
 const wide=ArrangeMeasuredGeometry(prepared,root(903,600),1,{constrainedGrid:true});
 const narrow=ArrangeMeasuredGeometry(prepared,root(303,200),1,{constrainedGrid:true});
 assert.ok(wide.byId.get("b").localRect.x>narrow.byId.get("b").localRect.x);
 assert.equal(wide.byId.get("c").localRect.y,2);
 assert.equal(narrow.byId.get("c").localRect.y,2);
 assert.equal(prepared.roots[0].authored.sizeX,1);
});

test("size-to-content must remain unresolved instead of applying fixed-cell override",()=>{
 const c=make("child","TextWidgetClass",fixed(50,40));
 const grid=make("grid","GridSpacerWidgetClass",[...fixed(300,200),["Size To Content V","1"]],[c]);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([grid]),root(),1,{constrainedGrid:true});
 assert.deepEqual(snap.appliedStrategies,[]);
 assert.deepEqual(snap.issues.map(x=>x.code),["unresolved-size-to-content","unresolved-layout-strategy"]);
 assert.deepEqual(snap.byId.get("child").localRect,{x:0,y:0,width:50,height:40});
});

test("overflow beyond native grid slots remains unsupported and is not discarded",()=>{
 const children=Array.from({length:5},(_,i)=>make("item"+i,"ImageWidgetClass",fixed(12,15)));
 const grid=make("grid","GridSpacerWidgetClass",[...fixed(100,100),["Columns","2"],["Rows","2"]],children);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([grid]),root(),1,{constrainedGrid:true});
 assert.deepEqual(snap.appliedStrategies,[]);
 assert.equal(snap.issues[0].code,"unresolved-layout-strategy");
 assert.equal(snap.entries.length,6);
 assert.equal(snap.byId.get("item4").localRect.width,12);
});

test("unknown Ignore invisible flag disables prototype instead of guessing eligibility",()=>{
 const grid=make("grid","GridSpacerWidgetClass",[...fixed(100,100),["Ignore invisible","unknown"]],[
  make("visible","PanelWidgetClass",fixed(10,10)),
  make("hidden","ImageWidgetClass",[...fixed(15,15),["visible","0"]])
 ]);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([grid]),root(),1,{constrainedGrid:true});
 assert.equal(snap.appliedStrategies.length,0);
 assert.equal(snap.issues[0].code,"unresolved-layout-strategy");
 assert.equal(snap.byId.get("hidden").visible,false);
});

test("non-grid managed widget types never adopt GridSpacer strategy",()=>{
 const types=["WrapSpacerWidgetClass","ScrollWidgetClass","ContentWidgetClass","SmartPanelWidgetClass","SpacerWidgetClass"];
 const roots=types.map((type,i)=>make("container"+i,type,fixed(300,150),[
  make("child"+i,"ButtonWidgetClass",fixed(40,40))
 ]));
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree(roots),root(),1,{constrainedGrid:true});
 assert.deepEqual(snap.appliedStrategies,[]);
 assert.deepEqual(snap.issues.map(x=>x.code),Array(types.length).fill("unresolved-layout-strategy"));
});
