/** Read-only comparison of mapped TCRD records and independently supplied FSDF metrics. */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { inspectFnt5, inspectFsdf } from "./inspect-fnt5.mjs";
import { decodeGlpsRanges, mapCodePoint } from "./decode-glps-ranges.mjs";

export function correlateTcrdMetrics(font, fsdfGlyphs) {
 const mapping=decodeGlpsRanges(font);
 const samples=[];
 for(const glyph of fsdfGlyphs) {
  const index=mapCodePoint(mapping,glyph.codePoint);
  if(index===null)continue;
  const record=font.rawRecords[index];
  if(!record || record.length!==7)throw new Error("Invalid mapped TCRD record");
  samples.push({
   character:glyph.character,codePoint:glyph.codePoint,recordIndex:index,
   atlasCellCandidate:{x:record[0],y:record[1]},
   rawTcrdU16LE:record.slice(),
   fsdf:{x:glyph.x,y:glyph.y,width:glyph.width,height:glyph.height,
    bearingX:glyph.bearingX,bearingY:glyph.bearingY,advance:glyph.advance},
   // These are observations, NOT production coordinate or size transforms.
   fields2Through6:record.slice(2),
   comparisons:{
    widthCandidate:record[2],heightCandidate:record[3],
    bearingXCandidate:record[4],bearingYCandidate:record[5],
    advanceCandidate:record[6]
   }
  });
 }
 const fields=Array.from({length:7},(_,field)=>{
  const values=font.rawRecords.map(record=>record[field]);
  return {field,min:Math.min(...values),max:Math.max(...values),
   unique:new Set(values).size};
 });
 return {
  mappedFsdfCount:samples.length,totalFsdfCount:fsdfGlyphs.length,
  tcrdRecordCount:font.rawRecords.length,
  fieldStats:fields,
  samples,
  caveat:"FSDF font metrics and cooked FNT5 atlas-cell metrics may differ by scaling and padding. Field 2..6 labels are candidates only; no validated rendering formula."
 };
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 const [, , fntPath, fsdfPath]=process.argv;
 if(!fntPath || !fsdfPath){
  console.error("Usage: node tools/correlate-fnt5-metrics.mjs <font.fnt> <font.fsdf>");
  process.exitCode=1;
 } else try {
  const font=inspectFnt5(readFileSync(fntPath));
  const fsdf=inspectFsdf(readFileSync(fsdfPath,"utf8"));
  console.log(JSON.stringify(correlateTcrdMetrics(font,fsdf),null,2));
 } catch(error){console.error(error);process.exitCode=1;}
}
