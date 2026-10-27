/** SVG contact sheet of decoded FNT5 glyph cells, diagnostic only. */
import {readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {inspectFnt5,inspectFsdf} from "./inspect-fnt5.mjs";
import {glyphGeometryReport} from "./preview-fnt5-geometry.mjs";
import {loadExistingEddsDecoder} from "./validate-fnt5-atlas.mjs";

export function channelSheetSvg(decoded,glyphs,{scale=5,thresholds=[16,96,160,224]}={}) {
 const {width,height,rgba}=decoded;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||rgba.length!==width*height*4)throw Error("Invalid decoded atlas");
 if(!Number.isInteger(scale)||scale<1||scale>16)throw Error("Invalid sheet scale");
 const modes=["RGB","R","G","B",...thresholds.map(n=>"R>"+n)];
 const cell=38,margin=12,labelHeight=23,panel=cell*scale;
 const sheetWidth=margin+(panel+margin)*modes.length;
 const sheetHeight=margin+(panel+labelHeight+margin)*glyphs.length;
 const escape=(s)=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
 const parts=['<svg xmlns="http://www.w3.org/2000/svg" width="'+sheetWidth+'" height="'+sheetHeight+'" viewBox="0 0 '+sheetWidth+' '+sheetHeight+'">','<rect width="100%" height="100%" fill="#111827"/>'];
 glyphs.forEach((glyph,row)=>{
  if(glyph.missing)return;
  const ox=glyph.origin.x,oy=glyph.origin.y;
  if(ox<0||oy<0||ox+cell>width||oy+cell>height)throw Error("Glyph cell outside atlas");
  modes.forEach((mode,col)=>{
   const left=margin+col*(panel+margin),top=margin+row*(panel+labelHeight+margin);
   parts.push('<text x="'+left+'" y="'+(top+13)+'" fill="#e5e7eb" font-size="12">'+escape(glyph.character)+' #'+glyph.recordIndex+' '+escape(mode)+'</text>');
   for(let y=0;y<cell;++y)for(let x=0;x<cell;++x){
    const pos=((oy+y)*width+ox+x)*4;
    const [r,g,b]=[rgba[pos],rgba[pos+1],rgba[pos+2]];
    let value;
    if(mode==="RGB")value='rgb('+r+','+g+','+b+')';
    else if(mode==="R")value='rgb('+r+','+r+','+r+')';
    else if(mode==="G")value='rgb('+g+','+g+','+g+')';
    else if(mode==="B")value='rgb('+b+','+b+','+b+')';
    else {const t=Number(mode.slice(2));value=r>t?"#ffffff":"#000000";}
    parts.push('<rect x="'+(left+x*scale)+'" y="'+(top+labelHeight+y*scale)+'" width="'+scale+'" height="'+scale+'" fill="'+value+'"/>');
   }
   const ink=glyph.candidateInk;
   const ix=left+(ink.x-ox)*scale,iy=top+labelHeight+(ink.y-oy)*scale;
   parts.push('<rect x="'+ix+'" y="'+iy+'" width="'+ink.width*scale+'" height="'+ink.height*scale+'" fill="none" stroke="#f59e0b" stroke-width="2"/>');
  });
 });
 parts.push('</svg>');
 return parts.join("");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [,,fntPath,fsdfPath,eddsPath,svgPath]=process.argv;
 if(!fntPath||!fsdfPath||!eddsPath||!svgPath){
  console.error("Usage: node tools/fnt5-channel-sheet.mjs <font.fnt> <font.fsdf> <font.edds> <output.svg>");process.exitCode=1;
 }else try{
  const font=inspectFnt5(readFileSync(fntPath));
  const glyphs=glyphGeometryReport(font,inspectFsdf(readFileSync(fsdfPath,"utf8")));
  const bytes=readFileSync(eddsPath),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const decoder=await loadExistingEddsDecoder();
  const svg=channelSheetSvg(decoder(buffer),glyphs);
  writeFileSync(svgPath,svg);
  console.log(JSON.stringify({output:svgPath,glyphs:glyphs.map(g=>({character:g.character,recordIndex:g.recordIndex})),modes:["RGB","R","G","B","R>16","R>96","R>160","R>224"],warning:"Thresholds are diagnostic, not validated Enfusion SDF shader thresholds."},null,2));
 }catch(error){console.error(error);process.exitCode=1;}
}
