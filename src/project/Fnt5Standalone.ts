/** Experimental sidecar-less FNT5 resource parsing; geometry is provisional. */
import { ParseFnt5AtlasOrigins } from "./Fnt5AtlasOrigins";
import type { SdfFontResource } from "./SdfTextCanvas";
export function ParseStandaloneFnt5(bytes: Uint8Array, atlasUrl: string, atlasWidth: number, atlasHeight: number): SdfFontResource | null {
 const origins=ParseFnt5AtlasOrigins(bytes);
 if(!origins || !atlasUrl || atlasWidth<=0 || atlasHeight<=0)return null;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let pos=12,head:Uint8Array|undefined,tcrd:Uint8Array|undefined;
 while(pos+8<=bytes.length){
  const tag=String.fromCharCode(...bytes.subarray(pos,pos+4)),size=view.getUint32(pos+4,false);
  pos+=8;
  if(size>bytes.length-pos)return null;
  if(tag==="HEAD")head=bytes.subarray(pos,pos+size);
  if(tag==="TCRD")tcrd=bytes.subarray(pos,pos+size);
  pos+=size;
 }
 if(pos!==bytes.length||!head||!tcrd||head.length<12)return null;
 const h=new DataView(head.buffer,head.byteOffset,head.byteLength);
 const nameLength=h.getUint32(0,true),sizeOffset=4+nameLength;
 if(sizeOffset+4>head.length)return null;
 const fontSize=h.getUint32(sizeOffset,true);
 if(fontSize<1||fontSize>256)return null;
 const records=new DataView(tcrd.buffer,tcrd.byteOffset,tcrd.byteLength);
 const glyphs=new Map<number,{codePoint:number;x:number;y:number;width:number;height:number;bearingX:number;bearingY:number;advance:number}>();
 let record=0;
 for(const [codePoint,origin] of origins){
  const at=record*14;
  if(at+14>tcrd.length)return null;
  const width=records.getUint16(at+4,true),height=records.getUint16(at+6,true);
  const bearingX=records.getInt16(at+8,true),bearingY=records.getInt16(at+10,true),advance=records.getUint16(at+12,true);
  if(origin.x<0||origin.y<0||origin.x>=atlasWidth||origin.y>=atlasHeight)return null;
  glyphs.set(codePoint,{codePoint,x:origin.x,y:origin.y,width,height,bearingX,bearingY,advance});
  ++record;
 }
 const first=Array.from(origins.values());
 // Regular fixed-pitch cells are observed in the tested Metron24/72 files.
 const pitch=first.length>1&&first[1].y===first[0].y ? first[1].x-first[0].x : 0;
 // TCRD widths/heights are nominal glyph extents, not full atlas cells.
 // Reject impossible metrics rather than letting a padded placement formula mask them.
 if(pitch<=0||pitch>256||first.some(p=>p.x+pitch>atlasWidth||p.y+pitch>atlasHeight)||Array.from(glyphs.values()).some(g=>g.width>pitch||g.height>pitch))return null;
 return {atlasUrl,metadata:{fontFile:"FNT5",fontSize,sdfType:2,inverted:false,charScale:pitch/fontSize,atlasWidth,atlasHeight,characters:Array.from(origins.keys())},
  glyphs,fnt5Origins:origins,fnt5CellSize:pitch,fnt5PixelMetrics:true};
}
