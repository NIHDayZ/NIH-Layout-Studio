import assert from "node:assert/strict";
import test from "node:test";
import { SdfCellSize, SdfGlyphAdvance, SdfSampleAlpha } from "../.sdf-preview-test-build/SdfRasterMath.js";
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
