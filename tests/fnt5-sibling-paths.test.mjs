import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

test("standalone FNT5 workspace sibling lookup resolves actual EDDS path and font key",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"nih-fnt5-path-"));
 try{
  const outfile=join(dir,"paths.mjs");
  await build({entryPoints:[fileURLToPath(new URL("../src/project/Fnt5SiblingPaths.ts",import.meta.url))],outfile,bundle:true,platform:"node",format:"esm",logLevel:"silent"});
  const {Fnt5SiblingPaths}=await import(pathToFileURL(outfile).href);
  const files=[{path:"gui/fonts/sdf_MetronLight24.fnt",extension:".fnt"},{path:"gui/fonts/sdf_MetronLight24.edds",extension:".edds"}];
  const paths=Fnt5SiblingPaths(files[0].path);
  assert.deepEqual(paths,{atlasPath:"gui/fonts/sdf_metronlight24.edds",resourceKey:"gui/fonts/sdf_metronlight24"});
  assert.ok(files.find(file=>file.extension===".edds"&&file.path.toLowerCase()===paths.atlasPath));
  assert.deepEqual(Fnt5SiblingPaths("gui\\fonts\\sdf_MetronBook72.fnt"),{atlasPath:"gui/fonts/sdf_metronbook72.edds",resourceKey:"gui/fonts/sdf_metronbook72"});
  assert.throws(()=>Fnt5SiblingPaths("gui/fonts/nope.fsdf"),/Expected/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
