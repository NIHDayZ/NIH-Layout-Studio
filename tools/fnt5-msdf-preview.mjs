/** Offline MSDF median-of-RGB reconstruction experiment. No renderer changes. */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {inspectFnt5,inspectFsdf} from "./inspect-fnt5.mjs";
import {glyphGeometryReport} from "./preview-fnt5-geometry.mjs";
import {loadExistingEddsDecoder} from "./validate-fnt5-atlas.mjs";

export function medianRgb(r,g,b) {
 return Math.max(Math.min(r,g),Math.min(Math.max(r,g),b));
}
export function msdfPreviewSvg(decoded,glyphs,{scale=5,thresholds=[96,112,128,144,160]}={}) {
 const {width,height,rgba}=decoded;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||rgba.length!==width*height*4)throw Error("Invalid decoded atlas");
 if(!Number.isInteger(scale)||scale<1||scale>16)throw Error("Invalid scale");
 if(!Array.isArray(thresholds)||thresholds.some(t=>!Number.isInteger(t)||t<0||t>255))throw Error("Invalid thresholds");
 const modes=["RGB","Median",...thresholds.map(t=>"Median>"+t)];
 const cell=38,gap=12,label=23,panel=cell*scale;
 const sheetWidth=gap+(panel+gap)*modes.length;
 const sheetHeight=gap+(panel+label+gap)*glyphs.length;
 const parts=['<svg xmlns="http://www.w3.org/2000/svg" width="'+sheetWidth+'" height="'+sheetHeight+'" viewBox="0 0 '+sheetWidth+' '+sheetHeight+'">','<rect width="100%" height="100%" fill="#111827"/>'];
 for(let row=0;row<glyphs.length;++row){
  const glyph=glyphs[row];
  if(glyph.missing)continue;
  const {x:ox,y:oy}=glyph.origin;
  if(!Number.isInteger(ox)||!Number.isInteger(oy)||ox<0||oy<0||ox+cell>width||oy+cell>height)throw Error("Glyph cell outside atlas");
  for(let col=0;col<modes.length;++col){
   const mode=modes[col],left=gap+col*(panel+gap),top=gap+row*(panel+label+gap);
   parts.push('<text x="'+left+'" y="'+(top+13)+'" fill="#e5e7eb" font-size="12">'+String(glyph.character).replace(/&/g,"&amp;").replace(/</g,"&lt;")+' #'+glyph.recordIndex+' '+mode+'</text>');
   for(let y=0;y<cell;++y)for(let x=0;x<cell;++x){
    const pos=((oy+y)*width+ox+x)*4,r=rgba[pos],g=rgba[pos+1],b=rgba[pos+2],m=medianRgb(r,g,b);
    const fill=mode==="RGB"?'rgb('+r+','+g+','+b+')':mode==="Median"?'rgb('+m+','+m+','+m+')':m>Number(mode.slice(7))?"#ffffff":"#000000";
    parts.push('<rect x="'+(left+x*scale)+'" y="'+(top+label+y*scale)+'" width="'+scale+'" height="'+scale+'" fill="'+fill+'"/>');
   }
   parts.push('<rect x="'+left+'" y="'+(top+label)+'" width="'+panel+'" height="'+panel+'" fill="none" stroke="#64748b" stroke-width="1"/>');
  }
 }
 return parts.join("")+'</svg>';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [,,fntPath,fsdfPath,eddsPath,svgPath]=process.argv;
 if(!fntPath||!fsdfPath||!eddsPath||!svgPath){
  console.error("Usage: node tools/fnt5-msdf-preview.mjs <font.fnt> <font.fsdf> <font.edds> <output.svg>");process.exitCode=1;
 }else try{
  const glyphs=glyphGeometryReport(inspectFnt5(readFileSync(fntPath)),inspectFsdf(readFileSync(fsdfPath,"utf8")));
  const bytes=readFileSync(eddsPath),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const decode=await loadExistingEddsDecoder();
  writeFileSync(svgPath,msdfPreviewSvg(decode(buffer),glyphs));
  console.log(JSON.stringify({output:svgPath,glyphs:glyphs.map(g=>g.character),modes:["RGB","Median","Median>96","Median>112","Median>128","Median>144","Median>160"],warning:"Median channel reconstruction and thresholds are exploratory; sampling the full cell is not validated glyph placement."},null,2));
 }catch(error){console.error(error);process.exitCode=1;}
}
