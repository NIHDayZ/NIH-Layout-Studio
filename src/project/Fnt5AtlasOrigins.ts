/** FNT5 RICH GLPS to TCRD atlas origin mapping. Geometry fields beyond origin remain unknown. */
export interface Fnt5AtlasOrigin { x: number; y: number; }
export function ParseFnt5AtlasOrigins(bytes: Uint8Array): Map<number, Fnt5AtlasOrigin> | null {
 if(bytes.length < 12 || String.fromCharCode(...bytes.subarray(0,4)) !== "FORM" || String.fromCharCode(...bytes.subarray(8,12)) !== "FNT5") return null;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let at=12;
 let glps:Uint8Array|undefined,tcrd:Uint8Array|undefined;
 while(at+8<=bytes.length){
  const tag=String.fromCharCode(...bytes.subarray(at,at+4));
  const size=view.getUint32(at+4,false);
  at+=8;
  if(size>bytes.length-at)return null;
  if(tag==="GLPS")glps=bytes.subarray(at,at+size);
  if(tag==="TCRD")tcrd=bytes.subarray(at,at+size);
  at+=size;
 }
 if(at!==bytes.length||!glps||!tcrd||glps.length<16||tcrd.length%14!==0)return null;
 const g=new DataView(glps.buffer,glps.byteOffset,glps.byteLength);
 const t=new DataView(tcrd.buffer,tcrd.byteOffset,tcrd.byteLength);
 if(String.fromCharCode(glps[0],glps[2],glps[4],glps[6])!=="RICH"||glps[1]||glps[3]||glps[5]||glps[7])return null;
 const count=g.getUint32(8,true),rangeCount=g.getUint32(12,true);
 if(count!==tcrd.length/14||rangeCount===0||rangeCount>4096||glps.length!==16+rangeCount*8)return null;
 const origins=new Map<number,Fnt5AtlasOrigin>();
 let index=0,previousEnd=-1;
 for(let i=0;i<rangeCount;++i){
  const off=16+i*8,start=g.getUint32(off,true),length=g.getUint16(off+4,true);
  if(length===0||start<=previousEnd||start+length-1>0x10ffff||index+length>count)return null;
  for(let k=0;k<length;++k){
   const record=(index+k)*14;
   origins.set(start+k,{x:t.getUint16(record,true),y:t.getUint16(record+2,true)});
  }
  index+=length;previousEnd=start+length-1;
 }
 if(index!==count)return null;
 return origins;
}
