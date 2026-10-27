import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

test("experimental MSDF reconstruction preserves expected median and alpha boundaries",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"nih-msdf-math-"));
 try {
  const outfile=join(dir,"math.mjs");
  await build({entryPoints:[fileURLToPath(new URL("../src/project/SdfMsdfMath.ts",import.meta.url))],outfile,bundle:true,platform:"node",format:"esm",logLevel:"silent"});
  const {MsdfMedian,MsdfAlpha,MsdfAlphaWithBias,MsdfScaledSmoothing}=await import(pathToFileURL(outfile).href);
  for(const tuple of [[20,128,240],[240,20,128],[128,240,20]])
   assert.equal(MsdfMedian(...tuple),128);
  assert.equal(MsdfAlpha(128,128,128,false),128);
  assert.equal(MsdfAlpha(255,255,255,false),255);
  assert.equal(MsdfAlpha(0,0,0,false),0);
  assert.equal(MsdfAlpha(255,255,255,true),0);
  assert.equal(MsdfAlpha(0,0,0,true),255);
  assert.equal(MsdfAlpha(128,128,128,true),128);
  assert.equal(MsdfScaledSmoothing(24,24),12);
  assert.equal(MsdfScaledSmoothing(12,24),24);
  assert.equal(MsdfScaledSmoothing(6,24),48);
  assert.equal(MsdfScaledSmoothing(1,72),48);
  assert.equal(MsdfScaledSmoothing(96,24),3);
  assert.equal(MsdfScaledSmoothing(0,24),12);
  assert.equal(MsdfScaledSmoothing(12,0),12);
  assert.equal(MsdfAlpha(128,128,128,false,24),128);
  assert.equal(MsdfAlphaWithBias(128,128,128,false,12,0),MsdfAlpha(128,128,128,false,12));
  assert.ok(MsdfAlphaWithBias(128,128,128,false,12,2)>128);
  assert.ok(MsdfAlphaWithBias(128,128,128,true,12,2)>128);
  assert.equal(MsdfAlphaWithBias(128,128,128,false,12,100),MsdfAlphaWithBias(128,128,128,false,12,8));
  assert.equal(MsdfAlphaWithBias(128,128,128,false,12,Number.NaN),MsdfAlpha(128,128,128,false,12));
 }finally {rmSync(dir,{recursive:true,force:true});}
});
