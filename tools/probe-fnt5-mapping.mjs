/** Probe GLPS candidate mappings without claiming a verified font format. */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {inspectFnt5,inspectFsdf} from "./inspect-fnt5.mjs";

export function probeMapping(font, glyphs=null) {
 const bytes=Buffer.from(font.glpsHex,"hex");
 const records=font.rawRecords;
 const u16=(offset)=>bytes.readUInt16LE(offset);
 const u32=(offset)=>bytes.readUInt32LE(offset);
 // Explicitly show multiple possible interpretations of GLPS as evidence.
 const interpretations={};
 for(const offset of [0,4,8,12,16]) {
  if(offset>=bytes.length)continue;
  const section=bytes.subarray(offset);
  const words16=Array.from({length:Math.floor(section.length/2)},(_,i)=>u16(offset+i*2));
  const words32=Array.from({length:Math.floor(section.length/4)},(_,i)=>u32(offset+i*4));
  interpretations["offset"+offset]={
   firstU16:words16.slice(0,24),firstU32:words32.slice(0,16),
   inRecordRangeU16:words16.filter(v=>v<records.length).length,
   monotonicU16Pairs:words16.slice(1).filter((v,i)=>v>=words16[i]).length
  };
 }
 const samples=(glyphs??[]).filter(g=>"AF01".includes(g.character)).map(g=>({
  character:g.character,codePoint:g.codePoint,fsdfRect:[g.x,g.y,g.width,g.height],
  // Hypotheses, NOT established codepoint mappings.
  indexCodepoint: g.codePoint<records.length ? {index:g.codePoint,raw:records[g.codePoint]}:null,
  indexAsciiFromSpace:g.codePoint>=32&&g.codePoint-32<records.length ?
   {index:g.codePoint-32,raw:records[g.codePoint-32]}:null
 }));
 const candidateCoordinateFields={
  x:{min:Math.min(...records.map(r=>r[0])),max:Math.max(...records.map(r=>r[0]))},
  y:{min:Math.min(...records.map(r=>r[1])),max:Math.max(...records.map(r=>r[1]))}
 };
 return {glpsByteCount:bytes.length,recordCount:records.length,interpretations,
  candidateCoordinateFields,fsdfSamples:samples,
  warning:"Hypotheses only: neither GLPS character encoding nor TCRD index mapping has been established."};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [, , fntPath,fsdfPath]=process.argv;
 if(!fntPath){console.error("Usage: node tools/probe-fnt5-mapping.mjs <font.fnt> [font.fsdf]");process.exitCode=1;}
 else try{
  console.log(JSON.stringify(probeMapping(inspectFnt5(readFileSync(fntPath)),fsdfPath?inspectFsdf(readFileSync(fsdfPath,"utf8")):null),null,2));
 }catch(e){console.error(e);process.exitCode=1;}
}
