/** Standalone, non-production TCRD candidate geometry report and SVG overlay. */
import {readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {inspectFnt5,inspectFsdf} from "./inspect-fnt5.mjs";
import {decodeGlpsRanges,mapCodePoint} from "./decode-glps-ranges.mjs";
const escapeXml=(value)=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
export function glyphGeometryReport(font, fsdf, text="AF01") {
 const ranges=decodeGlpsRanges(font);
 const byCodePoint=new Map(fsdf.map(g=>[g.codePoint,g]));
 const results=[];
 for(const character of text) {
  const codePoint=character.codePointAt(0);
  const recordIndex=mapCodePoint(ranges,codePoint);
  if(recordIndex===null){results.push({character,codePoint,missing:true});continue;}
  const record=font.rawRecords[recordIndex];
  if(!record||record.length!==7)throw new Error("Incomplete TCRD record");
  results.push({character,codePoint,recordIndex,origin:{x:record[0],y:record[1]},
   cell:{width:38,height:38},rawFields:record.slice(),
   candidateInk:{x:record[0]+record[4],y:record[1]+record[5],width:record[2],height:record[3]},
   fsdf:byCodePoint.get(codePoint)??null});
 }
 return results;
}
export function geometrySvg(results, atlasImageHref=null) {
 const image=atlasImageHref?'<image href="'+escapeXml(atlasImageHref)+'" x="0" y="0" width="1024" height="1024"/>':"";
 const boxes=results.filter(g=>!g.missing).map(g=>{
  const c=g.origin,ink=g.candidateInk;
  return '<g><rect x="'+c.x+'" y="'+c.y+'" width="38" height="38" fill="none" stroke="#38bdf8" stroke-width="1"/><rect x="'+ink.x+'" y="'+ink.y+'" width="'+ink.width+'" height="'+ink.height+'" fill="none" stroke="#f59e0b" stroke-width="1"/><text x="'+c.x+'" y="'+(c.y-3)+'" font-size="14" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke">'+escapeXml(g.character)+' #'+g.recordIndex+'</text></g>';
 }).join("");
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#111827"/>'+image+boxes+'</svg>';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [, , fntPath,fsdfPath,outputSvg,atlasPng]=process.argv;
 if(!fntPath||!fsdfPath||!outputSvg){
  console.error("Usage: node tools/preview-fnt5-geometry.mjs <font.fnt> <font.fsdf> <output.svg> [decoded-atlas.png]");process.exitCode=1;
 }else try{
  const font=inspectFnt5(readFileSync(fntPath));
  const data=glyphGeometryReport(font,inspectFsdf(readFileSync(fsdfPath,"utf8")));
  const href=atlasPng?"data:image/png;base64,"+readFileSync(atlasPng).toString("base64"):null;
  writeFileSync(outputSvg,geometrySvg(data,href));
  console.log(JSON.stringify({outputSvg,records:data,legend:"Blue: 38px candidate cell. Orange: unverified ink-bound candidate. Atlas pixels require optional decoded PNG."},null,2));
 }catch(error){console.error(error);process.exitCode=1;}
}
