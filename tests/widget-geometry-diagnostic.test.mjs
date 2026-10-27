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
  assert.deepEqual(TraceWidgetGeometry([parent],"missing",1920,1080),[]);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
