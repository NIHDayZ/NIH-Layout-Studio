import assert from "node:assert/strict";
import test from "node:test";
import { decodeBC7 } from "../.bc7-test-build/project/Bc7Decoder.js";

test("BC7 mode prefixes decode zero-color blocks correctly", () => {
	for (let mode = 0; mode < 8; ++mode) {
		const block = new Uint8Array(16);
		block[0] = 1 << mode;
		const pixels = decodeBC7(block, 4, 4);
		assert.equal(pixels.length, 64);
		for (let i = 0; i < pixels.length; i += 4) {
			assert.deepEqual([...pixels.subarray(i, i + 4)], [0, 0, 0, mode < 4 ? 255 : 0], `mode ${mode}, pixel ${i / 4}`);
		}
	}
});

test("BC7 handles partial 4x4 edge blocks without changing dimensions", () => {
	const block = new Uint8Array(16);
	block[0] = 1 << 6;
	const pixels = decodeBC7(block, 3, 2);
	assert.equal(pixels.length, 3 * 2 * 4);
	assert.ok(pixels.every((channel) => channel === 0));
});

test("BC7 rejects incomplete compressed payload", () => {
	assert.throws(() => decodeBC7(new Uint8Array(15), 4, 4), /short/i);
	assert.throws(() => decodeBC7(new Uint8Array(16), 5, 4), /short/i);
});
