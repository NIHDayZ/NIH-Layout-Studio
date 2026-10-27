import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
test("FNT5 GLPS mapping resolves A F 0 1 TCRD origins",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"nih-fnt5-origins-"));
 try {
  const outfile=join(dir,"parser.mjs");
  await build({entryPoints:[fileURLToPath(new URL("../src/project/Fnt5AtlasOrigins.ts",import.meta.url))],outfile,bundle:true,platform:"node",format:"esm",logLevel:"silent"});
  const {ParseFnt5AtlasOrigins}=await import(pathToFileURL(outfile).href);
  const chunk=(tag,data)=>{const header=Buffer.alloc(8);header.write(tag,0);header.writeUInt32BE(data.length,4);return Buffer.concat([header,data]);};
  const glps=Buffer.alloc(24);glps.write("R\0I\0C\0H\0",0,"latin1");glps.writeUInt32LE(4,8);glps.writeUInt32LE(1,12);glps.writeUInt32LE(65,16);glps.writeUInt16LE(4,20);
  const tcrd=Buffer.alloc(56);for(let i=0;i<4;++i){tcrd.writeUInt16LE(267+i*38,i*14);tcrd.writeUInt16LE(39,i*14+2);}
  const body=Buffer.concat([chunk("GLPS",glps),chunk("TCRD",tcrd)]);
  const header=Buffer.alloc(12);header.write("FORM");header.writeUInt32BE(body.length+4,4);header.write("FNT5",8);
  const origins=ParseFnt5AtlasOrigins(Buffer.concat([header,body]));
  assert.deepEqual(origins.get(65),{x:267,y:39});
  assert.deepEqual(origins.get(68),{x:381,y:39});
  assert.equal(origins.has(70),false);
  const invalid=Buffer.concat([header,body]);invalid[16]=255;
  assert.equal(ParseFnt5AtlasOrigins(invalid),null);
 }finally {rmSync(dir,{recursive:true,force:true});}
});
