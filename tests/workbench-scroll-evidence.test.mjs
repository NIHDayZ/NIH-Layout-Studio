import test from "node:test";
import assert from "node:assert/strict";
import {
	ParsePe, VaToFileOffset, VerifyScrollEvidence, PINNED_SCROLL_SHA256
} from "../scripts/verify-workbench-scroll.mjs";

function SyntheticPe() {
	const image = Buffer.alloc(0x400);
	image.write("MZ", 0, "ascii");
	image.writeUInt32LE(0x80, 0x3c);
	image.write("PE\0\0", 0x80, "ascii");
	image.writeUInt16LE(1, 0x86);
	image.writeUInt16LE(0xf0, 0x94);
	image.writeUInt16LE(0x20b, 0x98);
	image.writeBigUInt64LE(0x140000000n, 0x98 + 24);
	const section = 0x98 + 0xf0;
	image.writeUInt32LE(0x100, section + 8);
	image.writeUInt32LE(0x1000, section + 12);
	image.writeUInt32LE(0x100, section + 16);
	image.writeUInt32LE(0x200, section + 20);
	return image;
}

test("static Workbench evidence verifier maps PE32+ virtual addresses to file offsets", () => {
	const pe = ParsePe(SyntheticPe());
	assert.equal(pe.imageBase, 0x140000000);
	assert.equal(VaToFileOffset(pe, 0x140001005, 4), 0x205);
	assert.throws(() => VaToFileOffset(pe, 0x1400010ff, 2), /outside available PE sections/);
});

test("static evidence verifier rejects non-PE and wrong pinned binary without running it", () => {
	const pe = SyntheticPe();
	assert.throws(() => VerifyScrollEvidence(pe), /Unexpected Workbench binary SHA-256/);
	pe[0] = 0x00;
	assert.throws(() => ParsePe(pe), /DOS MZ signature/);
	const good = SyntheticPe();
	good.write("??\0\0", 0x80, "ascii");
	assert.throws(() => ParsePe(good), /Missing PE signature/);
});

test("pin is explicit and does not silently accept arbitrary Workbench releases", () => {
	assert.match(PINNED_SCROLL_SHA256, /^[0-9a-f]{64}$/);
});
