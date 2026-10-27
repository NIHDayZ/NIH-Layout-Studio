import test from "node:test";
import assert from "node:assert/strict";
import {decodeGlpsRanges,mapCodePoint} from "../tools/decode-glps-ranges.mjs";
function font() {
 const bytes=Buffer.alloc(32);
 bytes.write("RICH",0,"utf16le");
 bytes.writeUInt32LE(99,8);
 bytes.writeUInt32LE(2,12);
 bytes.writeUInt32LE(32,16);bytes.writeUInt16LE(95,20);bytes.writeUInt16LE(0,22);
 bytes.writeUInt32LE(160,24);bytes.writeUInt16LE(4,28);bytes.writeUInt16LE(0x1234,30);
 return {glpsHex:bytes.toString("hex"),rawRecords:Array.from({length:99},(_,index)=>[index,1,0,0,0,0,0])};
}
test("ASCII range maps four reference glyphs to their consecutive TCRD records",()=>{
 const table=decodeGlpsRanges(font());
 assert.equal(mapCodePoint(table,"0".codePointAt(0)),16);
 assert.equal(mapCodePoint(table,"1".codePointAt(0)),17);
 assert.equal(mapCodePoint(table,"A".codePointAt(0)),33);
 assert.equal(mapCodePoint(table,"F".codePointAt(0)),38);
 assert.equal(mapCodePoint(table,32),0);
 assert.equal(mapCodePoint(table,126),94);
 assert.equal(mapCodePoint(table,160),95);
 assert.equal(mapCodePoint(table,163),98);
 assert.equal(mapCodePoint(table,127),null);
 assert.equal(mapCodePoint(table,159),null);
 assert.equal(table.ranges[1].unknown,0x1234);
});
test("reject mismatched TCRD length and Unicode range overlap",()=>{
 const mismatch=font();mismatch.rawRecords.pop();
 assert.throws(()=>decodeGlpsRanges(mismatch),/disagree/);
 const overlapping=font();
 const bytes=Buffer.from(overlapping.glpsHex,"hex");
 bytes.writeUInt32LE(110,24);
 overlapping.glpsHex=bytes.toString("hex");
 assert.throws(()=>decodeGlpsRanges(overlapping),/overlapping/);
});
test("reject malformed GLPS range headers, counts and zero-length ranges",()=>{
 const short=font();short.glpsHex=short.glpsHex.slice(0,-2);
 assert.throws(()=>decodeGlpsRanges(short),/range count or length/);
 const empty=font();const bytes=Buffer.from(empty.glpsHex,"hex");
 bytes.writeUInt16LE(0,20);empty.glpsHex=bytes.toString("hex");
 assert.throws(()=>decodeGlpsRanges(empty),/Invalid or overlapping/);
 assert.equal(mapCodePoint({ranges:[]},-1),null);
 assert.equal(mapCodePoint({ranges:[]},0x110000),null);
});
