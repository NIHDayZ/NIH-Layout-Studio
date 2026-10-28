/** Test candidate TCRD rectangles against decoded EDDS RGBA pixels. */
export function examineGlyphPixels(decoded, mappedGlyphs, threshold=16) {
 const {width,height,rgba}=decoded;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||rgba.length!==width*height*4)throw Error("Invalid decoded atlas");
 const sample=(x,y)=>{const n=(y*width+x)*4;return [rgba[n],rgba[n+1],rgba[n+2],rgba[n+3]];};
 return mappedGlyphs.filter(g=>!g.missing).map(g=>{
  const {x,y}=g.origin;
  const cellWidth=g.cell.width,cellHeight=g.cell.height;
  if(x<0||y<0||x+cellWidth>width||y+cellHeight>height)throw Error("Glyph cell outside atlas: "+g.character);
  const ink=g.candidateInk;
  const channels=["red","green","blue","alpha"].map((name,ch)=>{
   let active=0,inCandidate=0,outside=0,minX=width,minY=height,maxX=-1,maxY=-1;
   for(let py=y;py<y+cellHeight;++py)for(let px=x;px<x+cellWidth;++px){
    const pixel=sample(px,py)[ch];
    if(pixel<=threshold)continue;
    ++active;minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
    if(px>=ink.x&&px<ink.x+ink.width&&py>=ink.y&&py<ink.y+ink.height)++inCandidate;
    else ++outside;
   }
   return {channel:name,aboveThreshold:active,withinCandidate:inCandidate,outsideCandidate:outside,
    bounds:active?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}:null};
  });
  let count=0,within=0,minX=width,minY=height,maxX=-1,maxY=-1;
  for(let py=y;py<y+cellHeight;++py)for(let px=x;px<x+cellWidth;++px){
   const [r,g,b]=sample(px,py);
   const median=Math.max(Math.min(r,g),Math.min(Math.max(r,g),b));
   if(median<=128)continue;
   ++count;
   minX=Math.min(minX,px);minY=Math.min(minY,py);
   maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
   if(px>=ink.x&&px<ink.x+ink.width&&py>=ink.y&&py<ink.y+ink.height)++within;
  }
  const msdfForeground={aboveThreshold:count,withinCandidate:within,outsideCandidate:count-within,
   bounds:count?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}:null};
  return {character:g.character,recordIndex:g.recordIndex,cell:g.origin,candidateInk:ink,channels,msdfForeground};
 });
}
