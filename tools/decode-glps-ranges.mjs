/** Verified GLPS range-table mapping for FNT5 RICH fonts, diagnostic only. */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {inspectFnt5} from "./inspect-fnt5.mjs";

export function decodeGlpsRanges(font) {
 const bytes=Buffer.from(font.glpsHex,"hex");
 if(bytes.length<16 || bytes.toString("utf16le",0,8)!=="RICH")
  throw new Error("Unsupported GLPS RICH header");
 const count=bytes.readUInt32LE(8);
 const rangeCount=bytes.readUInt32LE(12);
 if(rangeCount===0 || rangeCount>Math.floor((bytes.length-16)/8) || bytes.length!==16+rangeCount*8)
  throw new Error("Invalid GLPS range count or length");
 const ranges=[];
 let firstRecord=0;
 let previousEnd=-1;
 for(let i=0;i<rangeCount;++i){
  const at=16+i*8;
  const start=bytes.readUInt32LE(at);
  const length=bytes.readUInt16LE(at+4);
  const unknown=bytes.readUInt16LE(at+6);
  if(!length || start>0x10ffff || start+length-1>0x10ffff || start<=previousEnd)
   throw new Error("Invalid or overlapping GLPS range "+i);
  ranges.push({start,end:start+length-1,length,firstRecord,unknown});
  firstRecord+=length;
  previousEnd=start+length-1;
 }
 if(count!==font.rawRecords.length || firstRecord!==count)
  throw new Error("GLPS range totals disagree with TCRD record count");
 return {count,ranges};
}

export function mapCodePoint(table, codePoint) {
 if(!Number.isInteger(codePoint)||codePoint<0||codePoint>0x10ffff)return null;
 let low=0,high=table.ranges.length-1;
 while(low<=high){
  const mid=Math.floor((low+high)/2);
  const range=table.ranges[mid];
  if(codePoint<range.start)high=mid-1;
  else if(codePoint>range.end)low=mid+1;
  else return range.firstRecord+codePoint-range.start;
 }
 return null;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2];
 if(!file){console.error("Usage: node tools/decode-glps-ranges.mjs <font.fnt>");process.exitCode=1;}
 else try{
  const font=inspectFnt5(readFileSync(file));
  const table=decodeGlpsRanges(font);
  console.log(JSON.stringify({recordCount:table.count,rangeCount:table.ranges.length,
   sample:Object.fromEntries(["0","1","A","F"].map(char=>[char,{recordIndex:mapCodePoint(table,char.codePointAt(0)),rawRecord:font.rawRecords[mapCodePoint(table,char.codePointAt(0))]}])),
   ranges:table.ranges,
   note:"Codepoint-to-TCRD record indices follow GLPS range counts; the trailing 16-bit range field and TCRD metric field meanings are not yet established."},null,2));
 }catch(error){console.error(error);process.exitCode=1;}
}
