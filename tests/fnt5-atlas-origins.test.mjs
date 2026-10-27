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


test("multiple GLPS ranges map distinct TCRD records and reject invalid range tables",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"nih-fnt5-multi-"));
 try{
  const outfile=join(dir,"parser.mjs");
  await build({entryPoints:[fileURLToPath(new URL("../src/project/Fnt5AtlasOrigins.ts",import.meta.url))],outfile,bundle:true,platform:"node",format:"esm",logLevel:"silent"});
  const {ParseFnt5AtlasOrigins}=await import(pathToFileURL(outfile).href);
  const chunk=(tag,data)=>{const h=Buffer.alloc(8);h.write(tag);h.writeUInt32BE(data.length,4);return Buffer.concat([h,data]);};
  const buildFont=(ranges,declaredCount)=>{
   const glps=Buffer.alloc(16+ranges.length*8);
   glps.write("R\0I\0C\0H\0",0,"latin1");glps.writeUInt32LE(declaredCount,8);glps.writeUInt32LE(ranges.length,12);
   ranges.forEach(([start,count],i)=>{glps.writeUInt32LE(start,16+i*8);glps.writeUInt16LE(count,20+i*8);});
   const tcrd=Buffer.alloc(4*14);
   [[609,1],[647,1],[267,39],[457,39]].forEach(([x,y],i)=>{tcrd.writeUInt16LE(x,i*14);tcrd.writeUInt16LE(y,i*14+2);});
   const body=Buffer.concat([chunk("GLPS",glps),chunk("TCRD",tcrd)]);
   const h=Buffer.alloc(12);h.write("FORM");h.writeUInt32BE(body.length+4,4);h.write("FNT5",8);
   return Buffer.concat([h,body]);
  };
  const origins=ParseFnt5AtlasOrigins(buildFont([[48,2],[65,1],[70,1]],4));
  assert.deepEqual(origins.get(48),{x:609,y:1});
  assert.deepEqual(origins.get(49),{x:647,y:1});
  assert.deepEqual(origins.get(65),{x:267,y:39});
  assert.deepEqual(origins.get(70),{x:457,y:39});
  for(const absent of [47,50,64,66,69,71])assert.equal(origins.has(absent),false);
  assert.equal(ParseFnt5AtlasOrigins(buildFont([[48,2],[49,1],[70,1]],4)),null);
  assert.equal(ParseFnt5AtlasOrigins(buildFont([[48,2],[65,1],[70,1]],5)),null);
  assert.equal(ParseFnt5AtlasOrigins(buildFont([[48,2],[65,1],[70,2]],4)),null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
