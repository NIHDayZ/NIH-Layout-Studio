import assert from "node:assert/strict";
import test from "node:test";
import { SdfAtlasCell, SdfCellSize, SdfGlyphAdvance, SdfSampleAlpha } from "../.sdf-preview-test-build/SdfRasterMath.js";
test("SDF cell and advance metrics", () => {
 assert.equal(SdfCellSize(24, 1.375), 33);
 assert.equal(SdfCellSize(24, -2), 0);
 assert.equal(SdfGlyphAdvance(639, 24), 15.336);
 assert.equal(SdfGlyphAdvance(-1, 24), 0);
});
test("SDF alpha sampling respects threshold, inversion and clamping", () => {
 assert.equal(SdfSampleAlpha(0, false), 0);
 assert.equal(SdfSampleAlpha(128, false), 128);
 assert.equal(SdfSampleAlpha(255, false), 255);
 assert.equal(SdfSampleAlpha(0, true), 255);
 assert.equal(SdfSampleAlpha(255, true), 0);
 assert.equal(SdfSampleAlpha(Number.NaN, false), 0);
});

test("MetronBook24 FSDF reference cells scale into 1024-wide EDDS atlas", () => {
 assert.deepEqual(SdfAtlasCell(36, 1, 33, 512, 1024, 1024), {left:72,top:2,size:66,scale:2});
 assert.deepEqual(SdfAtlasCell(456,211,33,512,1024,1024), {left:912,top:422,size:66,scale:2});
});
test("Unscaled FSDF atlas remains pixel-exact",()=>{
 assert.deepEqual(SdfAtlasCell(36,1,33,512,512,256),{left:36,top:1,size:33,scale:1});
 assert.equal(SdfAtlasCell(500,220,33,512,512,256),null);
 assert.equal(SdfAtlasCell(36,1,33,0,1024,1024),null);
});
