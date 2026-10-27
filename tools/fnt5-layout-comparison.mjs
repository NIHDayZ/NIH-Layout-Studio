/** Compare provisional FNT5 text metrics without clipping or modifying the app renderer. */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {inspectFnt5} from "./inspect-fnt5.mjs";
import {selectFnt5Glyphs} from "./fnt5-unclipped-preview.mjs";
import {loadExistingEddsDecoder} from "./validate-fnt5-atlas.mjs";

export function layoutFnt5Entries(entries, pitch, nominalSize, targetSize, mode) {
 if(!Number.isFinite(pitch)||pitch<=0||!Number.isFinite(nominalSize)||nominalSize<=0||!Number.isFinite(targetSize)||targetSize<=0||!["cell","bearing"].includes(mode))throw Error("Invalid layout options");
 const scale=targetSize/nominalSize;
 let pen=0;
 return entries.map(({character,record})=>{
  if(!record){const x=pen;pen+=nominalSize*0.5*scale;return {character,record:null,x,y:0,size:pitch*scale};}
  const toSigned16=(value)=>value>=0x8000?value-0x10000:value;
  const widthOffset=toSigned16(record[4]),bearingY=toSigned16(record[5]),advance=record[6];
  const width=record[2],height=record[3];
  const padX=Math.max(0,(pitch-width)/2),padY=Math.max(0,(pitch-height)/2);
  const x=pen+(mode==="bearing"?widthOffset-padX:0)*scale;
  const y=mode==="bearing"?(nominalSize-bearingY-padY)*scale:0;
  pen+=(advance||nominalSize*0.5)*scale;
  return {character,record,x,y,size:pitch*scale};
 });
}
export function fnt5LayoutSvg(decoded,entries,{pitch,nominalSize,sizes=[16,24,72]}={}) {
 const {width,height,rgba}=decoded;
 if(!Number.isInteger(width)||!Number.isInteger(height)||rgba.length!==width*height*4||!Number.isInteger(pitch)||pitch<1||pitch>256)throw Error("Invalid atlas");
 const rows=[];
 for(const size of sizes)for(const mode of ["cell","bearing"])rows.push({size,mode,glyphs:layoutFnt5Entries(entries,pitch,nominalSize,size,mode)});
 const canvasWidth=1100,rowHeight=180,canvasHeight=rows.length*rowHeight+30;
 const result=['<svg xmlns="http://www.w3.org/2000/svg" width="'+canvasWidth+'" height="'+canvasHeight+'" viewBox="0 0 '+canvasWidth+' '+canvasHeight+'"><rect width="100%" height="100%" fill="#111827"/>'];
 for(let i=0;i<rows.length;++i){
  const {size,mode,glyphs}=rows[i],top=20+i*rowHeight;
  result.push('<text x="12" y="'+(top+18)+'" font-size="14" fill="white">'+size+'px / '+mode+'</text>');
  result.push('<line x1="170" y1="'+(top+95)+'" x2="1090" y2="'+(top+95)+'" stroke="#64748b" stroke-dasharray="4 4"/>');
  for(const glyph of glyphs){
   if(!glyph.record)continue;
   const [ox,oy]=glyph.record;
   if(ox<0||oy<0||ox+pitch>width||oy+pitch>height)throw Error("Glyph outside atlas");
   const pixelSize=glyph.size/pitch,left=180+glyph.x,upper=top+50+glyph.y;
   for(let y=0;y<pitch;++y)for(let x=0;x<pitch;++x){
    const pos=((oy+y)*width+ox+x)*4,a=rgba[pos],b=rgba[pos+1],c=rgba[pos+2];
    const median=Math.max(Math.min(a,b),Math.min(Math.max(a,b),c));
    if(median<=128)continue;
    result.push('<rect x="'+(left+x*pixelSize)+'" y="'+(upper+y*pixelSize)+'" width="'+(pixelSize+0.02)+'" height="'+(pixelSize+0.02)+'" fill="white"/>');
   }
  }
 }
 return result.join("")+"</svg>";
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [,,fntPath,eddsPath,pitchArg,sizeArg,outPath]=process.argv;
 if(!fntPath||!eddsPath||!pitchArg||!sizeArg||!outPath){console.error("Usage: node tools/fnt5-layout-comparison.mjs <font.fnt> <font.edds> <cell-pitch> <nominal-size> <output.svg>");process.exitCode=1;}
 else try{
  const entries=selectFnt5Glyphs(inspectFnt5(readFileSync(fntPath)),"ACTION 10 AB");
  const bytes=readFileSync(eddsPath),decode=await loadExistingEddsDecoder(),decoded=decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  writeFileSync(outPath,fnt5LayoutSvg(decoded,entries,{pitch:Number(pitchArg),nominalSize:Number(sizeArg)}));
  console.log(JSON.stringify({output:outPath,rows:["cell","bearing"],sizes:[16,24,72],caveat:"Both geometry formulas are provisional; line is an arbitrary visual reference."},null,2));
 }catch(e){console.error(e);process.exitCode=1;}
}
