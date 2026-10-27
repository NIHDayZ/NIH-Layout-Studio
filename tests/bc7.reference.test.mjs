import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { decodeBC7 } from "../.bc7-test-build/project/Bc7Decoder.js";

test("BC7 agrees byte-for-byte with independent bcdec reference across eight modes", () => {
	let state = 0x9e3779b9;
	const nextByte = () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return state & 255;
	};
	const blocks = [];
	for (let mode = 0; mode < 8; mode++) {
		for (let sample = 0; sample < 32; sample++) {
			const block = Uint8Array.from({ length: 16 }, nextByte);
			block[0] = (block[0] & ~((1 << (mode + 1)) - 1)) | (1 << mode);
			blocks.push({ mode, sample, block });
		}
	}
	const input = Buffer.concat(blocks.map(({ block }) => Buffer.from(block)));
	const run = spawnSync(".bc7-test-build/bc7-reference", [], { input, maxBuffer: 1024 * 1024 });
	if (run.error)
		throw run.error;
	assert.equal(run.status, 0, run.stderr?.toString());
	assert.equal(run.stdout.length, blocks.length * 64);
	for (let i = 0; i < blocks.length; ++i) {
		const { mode, sample, block } = blocks[i];
		const actual = decodeBC7(block, 4, 4);
		const expected = run.stdout.subarray(i * 64, (i + 1) * 64);
		assert.deepEqual(Buffer.from(actual), expected, `mode ${mode}, sample ${sample}, input ${Buffer.from(block).toString("hex")}`);
	}
});
