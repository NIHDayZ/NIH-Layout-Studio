/**
 * Frozen pre-M1 geometry formulas from LayoutMath.ts.
 * Test-only oracle: do NOT import into production. Keeping the original
 * arithmetic here prevents a delegated LayoutMath wrapper from making
 * engine-vs-legacy comparisons tautological.
 */
function Read(node, key) {
 return node.properties.find(p => p.name.toLowerCase() === key.toLowerCase())?.value;
}
function Flag(node, key) {
 return Read(node, key) === "1";
}
function Pair(node, key, fallbackA, fallbackB) {
 const raw=Read(node,key);
 const parts=raw ? raw.split(/\s+/).map(Number).filter(Number.isFinite) : [];
 return [parts[0] ?? fallbackA,parts[1] ?? fallbackB];
}
function LegacyAxis(pos, size, parentSize, exact, align) {
 const offset=exact ? pos : parentSize*pos;
 const normalized=align.toLowerCase().trim();
 if(normalized.endsWith("_ref")) {
  if(normalized.startsWith("right") || normalized.startsWith("bottom"))
   return parentSize-offset-size;
  if(normalized.startsWith("center"))
   return parentSize*0.5+offset-size*0.5;
  return offset;
 }
 if(normalized==="right" || normalized==="bottom") return offset-size;
 if(normalized==="center") return offset-size*0.5;
 return offset;
}
export function LegacyResolveRect(node,parent) {
 const [posX,posY]=Pair(node,"position",0,0);
 const [sizeX,sizeY]=Pair(node,"size",1,1);
 const width=Flag(node,"hexactsize") ? sizeX : parent.width*sizeX;
 const height=Flag(node,"vexactsize") ? sizeY : parent.height*sizeY;
 return {
  x:LegacyAxis(posX,width,parent.width,Flag(node,"hexactpos"),Read(node,"halign") ?? "left_ref"),
  y:LegacyAxis(posY,height,parent.height,Flag(node,"vexactpos"),Read(node,"valign") ?? "top_ref"),
  width,height
 };
}
function Inverse(start,size,parentSize,exact,align) {
 const normalized=align.toLowerCase().trim();
 let coordinate=start;
 if(normalized.endsWith("_ref")) {
  if(normalized.startsWith("right") || normalized.startsWith("bottom"))
   coordinate=parentSize-start-size;
  else if(normalized.startsWith("center"))
   coordinate=start+size*0.5-parentSize*0.5;
 } else {
  if(normalized==="right" || normalized==="bottom") coordinate=start+size;
  else if(normalized==="center") coordinate=start+size*0.5;
 }
 return exact ? coordinate : (parentSize>0 ? coordinate/parentSize : 0);
}
function Format(value) {
 if(!Number.isFinite(value)) return "0";
 const rounded=Math.abs(value)<0.0000005 ? 0 : value;
 return Number(rounded.toFixed(6)).toString();
}
export function LegacyEncodeRect(node,parent,rect) {
 const x=Inverse(rect.x,rect.width,parent.width,Flag(node,"hexactpos"),Read(node,"halign") ?? "left_ref");
 const y=Inverse(rect.y,rect.height,parent.height,Flag(node,"vexactpos"),Read(node,"valign") ?? "top_ref");
 const width=Flag(node,"hexactsize") ? rect.width : (parent.width>0 ? rect.width/parent.width : 0);
 const height=Flag(node,"vexactsize") ? rect.height : (parent.height>0 ? rect.height/parent.height : 0);
 return {position:`${Format(x)} ${Format(y)}`,size:`${Format(width)} ${Format(height)}`};
}
