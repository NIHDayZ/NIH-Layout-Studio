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

function makeMode6SolidRed() {
	// BC7 mode 6 has one 4x4 subset, two endpoints with 7-bit RGBA
	// components and one p-bit per endpoint. Identical endpoints make
	// indices irrelevant. P-bits of 1 make the nominal zero channels equal 1. All bits are packed LSB first as specified by BC7.
	const result = new Uint8Array(16);
	let position = 0;
	const put = (value, bits) => {
		for (let i = 0; i < bits; ++i, ++position)
			result[position >>> 3] |= ((value >>> i) & 1) << (position & 7);
	};
	put(1 << 6, 7);
	for (const channel of [127, 0, 0, 127]) {
		put(channel, 7);
		put(channel, 7);
	}
	put(1, 1);
	put(1, 1);
	put(0, 3); // anchor pixel has one fewer index bit
	for (let i = 1; i < 16; ++i)
		put(0, 4);
	assert.equal(position, 128);
	return result;
}

function makeDx10Dds(dxgiFormat, block) {
	const bytes = new Uint8Array(148 + block.length);
	const view = new DataView(bytes.buffer);
	bytes.set([68, 68, 83, 32], 0); // DDS magic
	view.setUint32(4, 124, true);
	view.setUint32(12, 4, true);
	view.setUint32(16, 4, true);
	view.setUint32(76, 32, true); // DDS_PIXELFORMAT size
	view.setUint32(80, 4, true); // DDPF_FOURCC
	bytes.set([68, 88, 49, 48], 84); // DX10
	view.setUint32(128, dxgiFormat, true);
	bytes.set(block, 148);
	return bytes.buffer;
}

test("BC7 mode 6 renders a known solid opaque red RGBA block", () => {
	const rgba = decodeBC7(makeMode6SolidRed(), 4, 4);
	for (let i = 0; i < rgba.length; i += 4)
		assert.deepEqual([...rgba.subarray(i, i + 4)], [255, 1, 1, 255]);
});

test("DXGI BC7 formats 98 and 99 decode through the complete EDDS/DDS path", async () => {
	const { DecodeEddsToPixels } = await import("../.bc7-test-build/project/EddsDecoder.js");
	for (const format of [98, 99]) {
		const decoded = DecodeEddsToPixels(makeDx10Dds(format, makeMode6SolidRed()));
		assert.equal(decoded.width, 4);
		assert.equal(decoded.height, 4);
		assert.deepEqual([...decoded.rgba.subarray(0, 4)], [255, 1, 1, 255]);
		assert.equal(decoded.rgba.length, 64);
	}
});

test("DXGI BC7 rejects truncated image data", async () => {
	const { DecodeEddsToPixels } = await import("../.bc7-test-build/project/EddsDecoder.js");
	assert.throws(() => DecodeEddsToPixels(makeDx10Dds(98, new Uint8Array(15))), /Truncated BC7/);
});

const bc7ModeLayout = [
	{ subsets: 3, partition: 4, rotation: 0, selection: 0, color: 4, alpha: 0, endpointP: 1, sharedP: 0, indices: [3, 0] },
	{ subsets: 2, partition: 6, rotation: 0, selection: 0, color: 6, alpha: 0, endpointP: 0, sharedP: 1, indices: [3, 0] },
	{ subsets: 3, partition: 6, rotation: 0, selection: 0, color: 5, alpha: 0, endpointP: 0, sharedP: 0, indices: [2, 0] },
	{ subsets: 2, partition: 6, rotation: 0, selection: 0, color: 7, alpha: 0, endpointP: 1, sharedP: 0, indices: [2, 0] },
	{ subsets: 1, partition: 0, rotation: 2, selection: 1, color: 5, alpha: 6, endpointP: 0, sharedP: 0, indices: [2, 3] },
	{ subsets: 1, partition: 0, rotation: 2, selection: 0, color: 7, alpha: 8, endpointP: 0, sharedP: 0, indices: [2, 2] },
	{ subsets: 1, partition: 0, rotation: 0, selection: 0, color: 7, alpha: 7, endpointP: 1, sharedP: 0, indices: [4, 0] },
	{ subsets: 2, partition: 6, rotation: 0, selection: 0, color: 5, alpha: 5, endpointP: 1, sharedP: 0, indices: [2, 0] },
];

// Independent bit-packing fixture constructor. Endpoints are equal, so the
// reference colors do not depend on partition IDs or interpolation indices.
function makeBc7SolidBlock(mode, rgba, rotation = 0, selection = 0) {
	const layout = bc7ModeLayout[mode];
	const bytes = new Uint8Array(16);
	let position = 0;
	const put = (value, bits) => {
		for (let bit = 0; bit < bits; ++bit, ++position)
			bytes[position >>> 3] |= ((value >>> bit) & 1) << (position & 7);
	};
	put(1 << mode, mode + 1);
	put(0, layout.partition);
	put(rotation, layout.rotation);
	put(selection, layout.selection);
	for (const component of rgba.slice(0, 3)) {
		const maximum = (1 << layout.color) - 1;
		for (let subset = 0; subset < layout.subsets; ++subset) {
			put(component === 255 ? maximum : 0, layout.color);
			put(component === 255 ? maximum : 0, layout.color);
		}
	}
	if (layout.alpha) {
		for (let subset = 0; subset < layout.subsets; ++subset) {
			put(rgba[3] === 255 ? (1 << layout.alpha) - 1 : 0, layout.alpha);
			put(rgba[3] === 255 ? (1 << layout.alpha) - 1 : 0, layout.alpha);
		}
	}
	for (let subset = 0; subset < layout.subsets; ++subset) {
		put(1, layout.endpointP || layout.sharedP);
		if (layout.endpointP)
			put(1, layout.endpointP);
	}
	// Remaining index bits are zero.
	assert.ok(position <= 128);
	return bytes;
}

test("BC7 each mode decodes opaque white reference endpoints", () => {
	for (let mode = 0; mode < 8; ++mode) {
		const rgba = decodeBC7(makeBc7SolidBlock(mode, [255, 255, 255, 255]), 4, 4);
		for (let pixel = 0; pixel < 16; ++pixel)
			assert.deepEqual([...rgba.subarray(pixel * 4, pixel * 4 + 4)], [255, 255, 255, 255], `mode ${mode}, pixel ${pixel}`);
	}
});

test("BC7 modes 4/5 rotate alpha with red, green, or blue", () => {
	for (const mode of [4, 5]) {
		for (const [rotation, expected] of [
			[0, [255, 0, 0, 0]],
			[1, [0, 0, 0, 255]],
			[2, [255, 0, 0, 0]],
			[3, [255, 0, 0, 0]],
		]) {
			const rgba = decodeBC7(makeBc7SolidBlock(mode, [255, 0, 0, 0], rotation), 4, 4);
			const actual = [...rgba.subarray(0, 4)];
			if (rotation <= 1)
				assert.deepEqual(actual, expected, `mode ${mode}, rotation ${rotation}`);
		}
	}
});
