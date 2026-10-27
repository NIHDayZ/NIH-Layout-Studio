/** Diagnostic interpretation of GLPS framing, without claiming decoded glyph mapping. */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {inspectFnt5} from "./inspect-fnt5.mjs";

export function inspectGlpsStructure(font) {
 const bytes=Buffer.from(font.glpsHex,"hex");
 if(bytes.length<16)throw new Error("GLPS header is truncated");
 const signature=bytes.subarray(0,8).toString("utf16le");
 const declaredCount=bytes.readUInt32LE(8);
 const candidateCount=bytes.readUInt32LE(12);
 const samples=[];
 for(let offset=16;offset+8<=bytes.length;offset+=8) {
  samples.push({offset,left:bytes.readUInt32LE(offset),right:bytes.readUInt32LE(offset+4)});
 }
 const nonzero=Array.from(bytes).reduce((n,v)=>n+(v!==0?1:0),0);
 return {
  signature,bytes:bytes.length,declaredCount,actualTcrdCount:font.rawRecords.length,
  declaredCountMatchesTcrd:declaredCount===font.rawRecords.length,
  candidateCount,fullPairsAfter16:samples.length,trailingBytes:(bytes.length-16)%8,
  firstRawPairs:samples.slice(0,16),nonzeroBytes:nonzero,
  caution:"The 8-byte pairs are an arbitrary diagnostic view, not established GLPS records or Unicode mappings."
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path=process.argv[2];
 if(!path){console.error("Usage: node tools/inspect-glps-structure.mjs <font.fnt>");process.exitCode=1;}
 else try {console.log(JSON.stringify(inspectGlpsStructure(inspectFnt5(readFileSync(path))),null,2));}
 catch(error){console.error(error);process.exitCode=1;}
}
