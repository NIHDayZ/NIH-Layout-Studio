import test from "node:test";
import assert from "node:assert/strict";
import {inspectFnt5} from "../tools/inspect-fnt5.mjs";
function chunk(tag,body){const header=Buffer.alloc(8);header.write(tag,0);header.writeUInt32BE(body.length,4);return Buffer.concat([header,body]);}
function font(headLen){
 const glps=Buffer.alloc(24);glps.write("R\0I\0C\0H\0",0,"latin1");glps.writeUInt32LE(1,8);glps.writeUInt32LE(1,12);glps.writeUInt32LE(65,16);glps.writeUInt16LE(1,20);
 const body=Buffer.concat([chunk("HEAD",Buffer.alloc(headLen)),chunk("GLPS",glps),chunk("TCRD",Buffer.alloc(14)),chunk("KERN",Buffer.alloc(0))]);
 const header=Buffer.alloc(12);header.write("FORM");header.writeUInt32BE(body.length+4,4);header.write("FNT5",8);
 return Buffer.concat([header,body]);
}
test("diagnostic parses both odd and even sized packed FNT5 HEAD chunks",()=>{
 for(const size of [50,51]){
  const result=inspectFnt5(font(size));
  assert.equal(result.rawRecords.length,1);
  assert.deepEqual(result.chunks.map(c=>c.name),["HEAD","GLPS","TCRD","KERN"]);
 }
});
test("diagnostic rejects oversized chunk",()=>{
 const bytes=font(51);bytes.writeUInt32BE(900000,16);
 assert.throws(()=>inspectFnt5(bytes),/Chunk exceeds file bounds/);
});
