import test from "node:test";
import assert from "node:assert/strict";
import {
	ArrangeNativeImageUvQuad, ArrangeNativeImageUvQuadFromFlags,
	DecodeNativeImageUvFlips
} from "../.native-image-uv-test-build/NativeImageUv.js";

// Nonrectangular UVs expose errors hidden by ordinary rectangular samples.
const uv = [0.1, 0.2, 0.7, 0.3, 0.8, 0.9, 0.05, 0.85];
const expected = [
	{
		topLeft: {u:0.1,v:0.2}, topRight: {u:0.7,v:0.3},
		bottomLeft: {u:0.05,v:0.85}, bottomRight: {u:0.8,v:0.9}
	},
	{
		topLeft: {u:0.7,v:0.2}, topRight: {u:0.1,v:0.3},
		bottomLeft: {u:0.8,v:0.85}, bottomRight: {u:0.05,v:0.9}
	},
	{
		topLeft: {u:0.1,v:0.85}, topRight: {u:0.7,v:0.9},
		bottomLeft: {u:0.05,v:0.2}, bottomRight: {u:0.8,v:0.3}
	},
	{
		topLeft: {u:0.7,v:0.85}, topRight: {u:0.1,v:0.9},
		bottomLeft: {u:0.8,v:0.2}, bottomRight: {u:0.05,v:0.3}
	}
];
for (const [index, flags] of [0, 0x04000000, 0x08000000, 0x0c000000].entries()) {
	test(`native textured-quad UV map ${index}: bits 26/27`, () => {
		assert.deepEqual(ArrangeNativeImageUvQuadFromFlags(uv, flags), expected[index]);
	});
}
test("unrelated widget flags do not alter source UV permutation", () => {
	const unrelatedFlags = 0x9000ffff;
	assert.deepEqual(DecodeNativeImageUvFlips(unrelatedFlags),
		{ horizontal: false, vertical: false });
	assert.deepEqual(ArrangeNativeImageUvQuadFromFlags(uv, unrelatedFlags), expected[0]);
	assert.deepEqual(ArrangeNativeImageUvQuadFromFlags(uv, unrelatedFlags | 0x0c000000), expected[3]);
});
test("source UV array is unchanged and flipping U leaves V unchanged", () => {
	const before = [...uv];
	const normal = ArrangeNativeImageUvQuad(uv, false, false);
	const horizontal = ArrangeNativeImageUvQuad(uv, true, false);
	for (const corner of ["topLeft", "topRight", "bottomLeft", "bottomRight"])
		assert.equal(horizontal[corner].v, normal[corner].v);
	assert.deepEqual(uv, before);
});
test("flipping V leaves U component selection unchanged", () => {
	const normal = ArrangeNativeImageUvQuad(uv, false, false);
	const vertical = ArrangeNativeImageUvQuad(uv, false, true);
	for (const corner of ["topLeft", "topRight", "bottomLeft", "bottomRight"])
		assert.equal(vertical[corner].u, normal[corner].u);
});
