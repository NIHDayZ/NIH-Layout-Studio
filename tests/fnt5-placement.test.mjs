import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

test("FNT5 centering compensates for padded 24px and 72px atlas cells",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"nih-fnt5-place-"));
 try {
  const outfile=join(dir,"placement.mjs");
  await build({entryPoints:[fileURLToPath(new URL("../src/project/Fnt5Placement.ts",import.meta.url))],outfile,bundle:true,platform:"node",format:"esm",logLevel:"silent"});
  const {Fnt5Placement}=await import(pathToFileURL(outfile).href);
  const light=Fnt5Placement(38,15,18,0,17,24,16,10,0);
  assert.ok(light);
  assert.ok(light.x<10);
  assert.ok(light.y<16);
  assert.equal(light.size,38*16/24);
  const book=Fnt5Placement(95,46,51,0,50,72,16,10,0);
  assert.ok(book);
  assert.ok(book.y<16);
  assert.equal(book.size,95*16/72);
  assert.equal(Fnt5Placement(38,12,17,2,17,0,16,0,0),null);
 }finally {rmSync(dir,{recursive:true,force:true});}
});
