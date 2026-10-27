/** Unclipped, offline glyph-cell inspection at three nominal text sizes. */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {inspectFnt5} from "./inspect-fnt5.mjs";
import {loadExistingEddsDecoder} from "./validate-fnt5-atlas.mjs";

export function selectFnt5Glyphs(font,text) {
 const glps=Buffer.from(font.glpsHex,"hex");
 if(glps.length<16)throw Error("Invalid GLPS");
 const count=glps.readUInt32LE(8),ranges=glps.readUInt32LE(12);
 if(count!==font.rawRecords.length||ranges===0||glps.length!==16+ranges*8)throw Error("Invalid GLPS ranges");
 const lookup=new Map();let index=0,previous=-1;
 for(let i=0;i<ranges;++i){
  const at=16+i*8,start=glps.readUInt32LE(at),length=glps.readUInt16LE(at+4);
  if(!length||start<=previous||start+length-1>0x10ffff||index+length>count)throw Error("Invalid GLPS ranges");
  for(let n=0;n<length;++n)lookup.set(start+n,index+n);
  index+=length;previous=start+length-1;
 }
 if(index!==count)throw Error("Invalid GLPS record total");
 return Array.from(text).map(character=>({character,record:font.rawRecords[lookup.get(character.codePointAt(0))]??null}));
}
export function unclippedFnt5Svg(decoded, entries,{pitch,nominalSize=24,sizes=[16,24,72]}={}) {
 const {width,height,rgba}=decoded;
 if(!Number.isInteger(width)||!Number.isInteger(height)||rgba.length!==width*height*4||!Number.isInteger(pitch)||pitch<1||pitch>256||!Number.isFinite(nominalSize)||nominalSize<=0)throw Error("Invalid atlas or pitch");
 const columns=entries.length,unit=100,gap=20,rowHeight=340;
 const fullWidth=140+columns*(unit+gap),fullHeight=90+sizes.length*rowHeight;
 const out=['<svg xmlns="http://www.w3.org/2000/svg" width="'+fullWidth+'" height="'+fullHeight+'" viewBox="0 0 '+fullWidth+' '+fullHeight+'"><rect width="100%" height="100%" fill="#111827"/>'];
 for(let i=0;i<sizes.length;++i){
  const size=sizes[i];if(!Number.isFinite(size)||size<=0)throw Error("Invalid preview size");
  const factor=size/nominalSize,display=Math.min(220,pitch*factor);
  out.push('<text x="12" y="'+(100+i*rowHeight)+'" fill="white" font-size="16">'+size+'px</text>');
  for(let j=0;j<entries.length;++j){
   const {character,record}=entries[j],left=140+j*(unit+gap),top=70+i*rowHeight;
   if(!record)continue;
   const [ox,oy]=record;
   if(ox+pitch>width||oy+pitch>height)throw Error("Cell outside atlas");
   out.push('<text x="'+left+'" y="'+(top-12)+'" fill="white" font-size="13">'+character.replace(/&/g,"&amp;").replace(/</g,"&lt;")+' ['+record.slice(2).join(",")+']</text>');
   const pixelSize=display/pitch;
   for(let y=0;y<pitch;++y)for(let x=0;x<pitch;++x){
    const at=((oy+y)*width+ox+x)*4;
    const a=rgba[at],b=rgba[at+1],c=rgba[at+2];
    const median=Math.max(Math.min(a,b),Math.min(Math.max(a,b),c));
    out.push('<rect x="'+(left+x*pixelSize)+'" y="'+(top+y*pixelSize)+'" width="'+(pixelSize+0.03)+'" height="'+(pixelSize+0.03)+'" fill="'+(median>128?"#fff":"#111")+'"/>');
   }
   out.push('<rect x="'+left+'" y="'+top+'" width="'+display+'" height="'+display+'" fill="none" stroke="#38bdf8" stroke-width="1"/>');
  }
 }
 return out.join("")+'</svg>';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [,,fntFile,eddsFile,pitchArg,nominalArg,output]=process.argv;
 if(!fntFile||!eddsFile||!pitchArg||!nominalArg||!output){console.error("Usage: node tools/fnt5-unclipped-preview.mjs <font.fnt> <font.edds> <cell-pitch> <nominal-font-size> <output.svg>");process.exitCode=1;}
 else try{
  const font=inspectFnt5(readFileSync(fntFile)),bytes=readFileSync(eddsFile),decode=await loadExistingEddsDecoder();
  const decoded=decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const entries=selectFnt5Glyphs(font,"ACTION 10 AB");
  writeFileSync(output,unclippedFnt5Svg(decoded,entries,{pitch:Number(pitchArg),nominalSize:Number(nominalArg)}));
  console.log(JSON.stringify({output,atlas:[decoded.width,decoded.height],glyphs:entries.map(e=>e.character),note:"Unclipped independent cells; no baseline, kerning, or widget clipping. Sizes are illustrative, not calibrated font metrics."},null,2));
 }catch(error){console.error(error);process.exitCode=1;}
}
