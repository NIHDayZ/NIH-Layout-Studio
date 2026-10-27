/** Offline glyph pixel check using the SAME TypeScript EDDS decoder as the editor. */
import {readFileSync,writeFileSync} from "node:fs";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {build} from "esbuild";
import {inspectFnt5,inspectFsdf} from "./inspect-fnt5.mjs";
import {glyphGeometryReport} from "./preview-fnt5-geometry.mjs";
import {examineGlyphPixels} from "./fnt5-atlas-pixels.mjs";

export async function loadExistingEddsDecoder() {
 const dir=mkdtempSync(join(tmpdir(),"nih-edds-check-"));
 try {
  const outfile=join(dir,"decoder.mjs");
  await build({entryPoints:[new URL("../src/project/EddsDecoder.ts",import.meta.url).pathname],outfile,bundle:true,platform:"node",format:"esm",target:"node20",logLevel:"silent"});
  const module=await import(pathToFileURL(outfile).href);
  return module.DecodeEddsToPixels;
 } finally {
  // The module is loaded into memory; the generated bundle is temporary only.
  rmSync(dir,{recursive:true,force:true});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const [, , fntPath,fsdfPath,eddsPath,outputPath]=process.argv;
 if(!fntPath||!fsdfPath||!eddsPath){
  console.error("Usage: node tools/validate-fnt5-atlas.mjs <font.fnt> <font.fsdf> <font.edds> [output.json]");
  process.exitCode=1;
 }else try {
  const font=inspectFnt5(readFileSync(fntPath));
  const fsdf=inspectFsdf(readFileSync(fsdfPath,"utf8"));
  const decode=await loadExistingEddsDecoder();
  const contents=readFileSync(eddsPath);
  const buffer=contents.buffer.slice(contents.byteOffset,contents.byteOffset+contents.byteLength);
  const decoded=decode(buffer);
  const glyphs=glyphGeometryReport(font,fsdf);
  const results={atlas:{width:decoded.width,height:decoded.height},glyphs:examineGlyphPixels(decoded,glyphs),
   limitation:"Per-channel threshold coverage is diagnostic only; SDF pixel intensities are not literal ink masks, and clipping alone does not prove geometric semantics."};
  const json=JSON.stringify(results,null,2);
  if(outputPath)writeFileSync(outputPath,json);
  console.log(json);
 }catch(error){console.error(error);process.exitCode=1;}
}
