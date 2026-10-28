import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
test("selected widget diagnostic reports parent-local and absolute rectangles separately", async()=>{
 const dir=mkdtempSync(join(tmpdir(),"nih-geometry-"));
 try {
  const outfile=join(dir,"geometry.mjs");
  await build({entryPoints:[fileURLToPath(new URL("../src/renderer/WidgetGeometryDiagnostic.ts",import.meta.url))],outfile,bundle:true,platform:"node",format:"esm",logLevel:"silent"});
  const {TraceWidgetGeometry}=await import(pathToFileURL(outfile).href);
  const property=(name,value)=>({name,value});
  const child={id:"child",name:"Label",type:"TextWidgetClass",properties:[
   property("position","10 5"),property("size","40 12"),property("hexactpos","1"),property("vexactpos","1"),
   property("hexactsize","1"),property("vexactsize","1")],children:[]};
  const parent={id:"parent",name:"Panel",type:"PanelWidgetClass",properties:[
   property("position","0.25 0.5"),property("size","0.5 0.2")],children:[child]};
  const trace=TraceWidgetGeometry([parent],"child",1920,1080);
  assert.equal(trace.length,2);
  assert.deepEqual(trace[0].absoluteBounds,{x:480,y:540,width:960,height:216});
  assert.deepEqual(trace[1].localBounds,{x:10,y:5,width:40,height:12});
  assert.deepEqual(trace[1].absoluteBounds,{x:490,y:545,width:40,height:12});
  assert.equal(trace[1].hexactpos,true);
  assert.equal(trace[1].parentName,"Panel");
  assert.deepEqual(trace[1].renderedAbsoluteBounds,trace[1].absoluteBounds);
  assert.deepEqual(TraceWidgetGeometry([parent],"missing",1920,1080),[]);
  const spacer={id:"spacer",name:"Grid",type:"GridSpacerWidgetClass",properties:[property("position","100 200"),property("size","400 120"),property("hexactpos","1"),property("vexactpos","1"),property("hexactsize","1"),property("vexactsize","1")],children:[
   {id:"first",name:"A",type:"PanelWidgetClass",properties:[property("position","0 15"),property("size","100 30"),property("hexactpos","1"),property("vexactpos","1"),property("hexactsize","1"),property("vexactsize","1")],children:[]},
   {id:"second",name:"B",type:"PanelWidgetClass",properties:[property("position","0 60"),property("size","100 30"),property("hexactpos","1"),property("vexactpos","1"),property("hexactsize","1"),property("vexactsize","1")],children:[]}
  ]};
  const selected=TraceWidgetGeometry([spacer],"second",1920,1080);
  assert.deepEqual(selected[1].absoluteBounds,{x:100,y:260,width:100,height:30});
  assert.deepEqual(selected[1].renderedAbsoluteBounds,{x:100,y:230,width:100,height:30});
  assert.deepEqual(selected[0].renderedAbsoluteBounds,selected[0].absoluteBounds);
  const spacerChild=spacer.children[0];
  spacerChild.children=[{id:"grandchild",name:"Nested",type:"TextWidgetClass",properties:[property("position","0 5"),property("size","0.5 0.5"),property("hexactpos","1"),property("vexactpos","1")],children:[]}];
  const nested=TraceWidgetGeometry([spacer],"grandchild",1920,1080);
  assert.equal(nested[2].absoluteBounds.y,220);
  assert.equal(nested[2].renderedAbsoluteBounds.y,205);
  const expanded={id:"expanded",name:"Expanded",type:"PanelWidgetClass",properties:[property("position","0 0"),property("size","100 0"),property("hexactpos","1"),property("vexactpos","1"),property("hexactsize","1"),property("vexactsize","1")],children:[{id:"half",name:"Half",type:"TextWidgetClass",properties:[property("position","0 0"),property("size","1 0.5")],children:[]}]};
  const expandedSpacer={...spacer,children:[expanded]};
  const expandedTrace=TraceWidgetGeometry([expandedSpacer],"half",1920,1080);
  assert.equal(expandedTrace[2].absoluteBounds.height,0);
  assert.equal(expandedTrace[2].renderedAbsoluteBounds.height,60);
 } finally {rmSync(dir,{recursive:true,force:true});}


});
