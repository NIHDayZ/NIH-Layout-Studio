import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

test("sidecar-less FNT5 parser handles non-RICH GLPS and pixel metrics",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"nih-standalone-"));
 try{
  const outfile=join(dir,"parser.mjs");
  await build({entryPoints:[fileURLToPath(new URL("../src/project/Fnt5Standalone.ts",import.meta.url))],outfile,bundle:true,platform:"node",format:"esm",logLevel:"silent"});
  const {ParseStandaloneFnt5}=await import(pathToFileURL(outfile).href);
  const chunk=(tag,data)=>{const h=Buffer.alloc(8);h.write(tag);h.writeUInt32BE(data.length,4);return Buffer.concat([h,data]);};
  const name=Buffer.from("sdf_MetronLight24\0"),head=Buffer.alloc(4+name.length+4);
  head.writeUInt32LE(name.length,0);name.copy(head,4);head.writeUInt32LE(24,4+name.length);
  const glps=Buffer.alloc(24);
  glps.writeUInt32LE(0x12345678,0);glps.writeUInt32LE(0x9abcdef0,4);
  glps.writeUInt32LE(2,8);glps.writeUInt32LE(1,12);
  glps.writeUInt32LE(65,16);glps.writeUInt16LE(2,20);
  const tcrd=Buffer.alloc(28);
  tcrd.writeUInt16LE(1,0);tcrd.writeUInt16LE(1,2);tcrd.writeUInt16LE(14,4);tcrd.writeUInt16LE(18,6);tcrd.writeUInt16LE(16,12);
  tcrd.writeUInt16LE(39,14);tcrd.writeUInt16LE(1,16);tcrd.writeUInt16LE(13,18);tcrd.writeUInt16LE(18,20);tcrd.writeUInt16LE(15,26);
  const body=Buffer.concat([chunk("HEAD",head),chunk("GLPS",glps),chunk("TCRD",tcrd)]);
  const hdr=Buffer.alloc(12);hdr.write("FORM");hdr.writeUInt32BE(body.length+4,4);hdr.write("FNT5",8);
  const binary=Buffer.concat([hdr,body]);
  const parsed=ParseStandaloneFnt5(binary,"blob:test",1024,1024);
  assert.ok(parsed);
  assert.equal(parsed.metadata.fontSize,24);
  assert.equal(parsed.fnt5CellSize,38);
  assert.equal(parsed.fnt5PixelMetrics,true);
  assert.deepEqual(parsed.fnt5Origins.get(65),{x:1,y:1});
  assert.deepEqual(parsed.fnt5Origins.get(66),{x:39,y:1});
  assert.equal(parsed.glyphs.get(66).advance,15);
  assert.equal(ParseStandaloneFnt5(binary,"blob:test",50,50),null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
