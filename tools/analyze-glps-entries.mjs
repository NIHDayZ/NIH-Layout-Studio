/** GLPS framing hypotheses; fields remain unnamed until correlated to glyphs. */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {inspectFnt5} from "./inspect-fnt5.mjs";

export function analyzeGlpsEntries(font) {
 const bytes=Buffer.from(font.glpsHex,"hex");
 if(bytes.length<16 || bytes.toString("utf16le",0,8)!=="RICH")
  throw new Error("Unsupported or truncated GLPS header");
 const recordCount=bytes.readUInt32LE(8);
 const declaredEntries=bytes.readUInt32LE(12);
 const payloadSize=bytes.length-16;
 if(declaredEntries===0 || declaredEntries>payloadSize || payloadSize%declaredEntries!==0)
  return {recordCount,declaredEntries,payloadSize,uniformCandidate:null,reason:"Header value does not evenly divide the payload"};
 const stride=payloadSize/declaredEntries;
 // Equal-width partition is a testable hypothesis, not a proven file specification.
 const entries=[];
 for(let i=0;i<declaredEntries;++i){
  const offset=16+i*stride;
  const slice=bytes.subarray(offset,offset+stride);
  const u16=[];
  const u32=[];
  for(let j=0;j+2<=stride;j+=2)u16.push(slice.readUInt16LE(j));
  for(let j=0;j+4<=stride;j+=4)u32.push(slice.readUInt32LE(j));
  entries.push({index:i,offset,hex:slice.toString("hex"),u16,u32});
 }
 return {
  recordCount,declaredEntries,payloadSize,
  uniformCandidate:{stride,entries,
   coverageBytes:entries.length*stride,
   // These counts only measure plausibility, NOT proof of record indexing.
   firstU32WithinTcrd:entries.filter(e=>e.u32[0]<font.rawRecords.length).length,
   secondU32WithinTcrd:entries.filter(e=>e.u32[1]<font.rawRecords.length).length},
  reason:"Uniform partition accounts for the payload, but no character-to-TCRD mapping is verified"
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path=process.argv[2];
 if(!path){console.error("Usage: node tools/analyze-glps-entries.mjs <font.fnt>");process.exitCode=1;}
 else try{
  const report=analyzeGlpsEntries(inspectFnt5(readFileSync(path)));
  // Keep output tractable while preserving the full entry data on request.
  console.log(JSON.stringify({...report,uniformCandidate:report.uniformCandidate && {...report.uniformCandidate,entries:report.uniformCandidate.entries.slice(0,16),displayedEntries:16}},null,2));
 }catch(error){console.error(error);process.exitCode=1;}
}
