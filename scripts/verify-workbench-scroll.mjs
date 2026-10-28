#!/usr/bin/env node
/**
 * Static, read-only evidence verifier for the user's pinned WorkbenchApp.exe.
 * Does not execute, patch, extract, or redistribute proprietary game assets.
 *
 * Usage: node scripts/verify-workbench-scroll.mjs /path/to/WorkbenchApp.exe
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export const PINNED_SCROLL_SHA256 = "8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85";

export function ParsePe(buffer) {
	if (buffer.toString("ascii", 0, 2) !== "MZ")
		throw new Error("Missing DOS MZ signature");
	const header = buffer.readUInt32LE(0x3c);
	if (buffer.toString("ascii", header, header + 4) !== "PE\0\0")
		throw new Error("Missing PE signature");
	const sectionsCount = buffer.readUInt16LE(header + 6);
	const optionalSize = buffer.readUInt16LE(header + 20);
	const optional = header + 24;
	if (buffer.readUInt16LE(optional) !== 0x20b)
		throw new Error("Expected PE32+ executable");
	const imageBase = Number(buffer.readBigUInt64LE(optional + 24));
	const sections = [];
	for (let i = 0; i < sectionsCount; ++i) {
		const offset = optional + optionalSize + i * 40;
		sections.push({
			virtualAddress: buffer.readUInt32LE(offset + 12),
			rawSize: buffer.readUInt32LE(offset + 16),
			rawOffset: buffer.readUInt32LE(offset + 20)
		});
	}
	return { imageBase, sections };
}

export function VaToFileOffset(pe, address, length = 1) {
	const relative = address - pe.imageBase;
	for (const section of pe.sections) {
		const delta = relative - section.virtualAddress;
		if (delta >= 0 && delta + length <= section.rawSize)
			return section.rawOffset + delta;
	}
	throw new Error("VA outside available PE sections: " + address.toString(16));
}

export function VerifyScrollEvidence(buffer) {
	const digest = createHash("sha256").update(buffer).digest("hex");
	if (digest !== PINNED_SCROLL_SHA256)
		throw new Error("Unexpected Workbench binary SHA-256: " + digest);
	const pe = ParsePe(buffer);
	if (pe.imageBase !== 0x140000000)
		throw new Error("Unexpected Workbench PE image base");

	const read = (va, size) => {
		const offset = VaToFileOffset(pe, va, size);
		return buffer.subarray(offset, offset + size);
	};
	const signatures = [
		["Ignore invisible defaults enabled", 0x1408DEDFC, "b0 01"],
		["Ignore invisible loader writes +0x159", 0x1408DEE03, "88 87 59 01 00 00"],
		["Grid child filtering reads shared +0x159", 0x1408DFCF0, "44 38 a7 59 01 00 00"],
		["Wrap child filtering reads shared +0x159", 0x1408E0762, "80 be 59 01 00 00 00"],
		["Scroll child filtering reads shared +0x159", 0x1408E0540, "80 be 59 01 00 00 00"],
		["Scrollbar H property-loader write +0x188", 0x1408DEE23, "88 87 88 01 00 00"],
		["Scrollbar V property-loader write +0x189", 0x1408DEE43, "88 87 89 01 00 00"],
		["Scrollbar V Left property-loader write +0x18C", 0x1408DEE60, "88 87 8c 01 00 00"],
		["Vertical reservation guard", 0x1408E04FB, "80 be 89 01 00 00 00"],
		["Horizontal reservation guard", 0x1408E0527, "80 be 88 01 00 00 00"],
		["Left-side reservation guard", 0x1408E0504, "80 be 8c 01 00 00 00"],
		["Scaled branch reads native context +0xC4", 0x1408E04CF, "66 0f 6e 88 c4 00 00 00"],
		["Scaled branch reads native context +0xCC", 0x1408E04D7, "8b 80 cc 00 00 00"],
		["Scaled branch divides context values", 0x1408E04E5, "f3 0f 5e c8"],
		["Unscaled branch loads thickness constant", 0x1408E04F3, "f3 0f 10 0d"]
	];
	const checks = signatures.map(([label, va, encoded]) => {
		const signature = Buffer.from(encoded, "hex");
		if (!read(va, signature.length).equals(signature))
			throw new Error("Instruction signature mismatch: " + label);
		return { label, address: "0x" + va.toString(16) };
	});
	const instruction = read(0x1408E04F3, 8);
	const target = 0x1408E04F3 + 8 + instruction.readInt32LE(4);
	const thickness = read(target, 4).readFloatLE(0);
	if (target !== 0x141F1DCE0 || thickness !== 10)
		throw new Error("Native scrollbar constant changed");
	const reflection = buffer.toString("ascii", 0x206EF40, 0x206EFF0);
	const visibilityReflection = buffer.toString("ascii", 0x206EEB0, 0x206EEF0);
	if (!visibilityReflection.includes("Ignore invisible" + "\0"))
		throw new Error("Shared Ignore invisible reflection name missing");
	const names = ["Scrollbar H", "Scrollbar V", "Scrollbar V Left"];
	for (const name of names) {
		if (!reflection.includes(name + "\0"))
			throw new Error("Scrollbar reflection name missing: " + name);
	}
	return {
		sha256: digest,
		checkedInstructionCount: checks.length,
		checks,
		unscaledThickness: thickness,
		properties: names
	};
}

if (process.argv[1]?.endsWith("verify-workbench-scroll.mjs")) {
	if (!process.argv[2]) {
		console.error("Usage: node scripts/verify-workbench-scroll.mjs /path/to/WorkbenchApp.exe");
		process.exitCode = 2;
	} else {
		try {
			console.log(JSON.stringify(VerifyScrollEvidence(readFileSync(process.argv[2])), null, 2));
		} catch (error) {
			console.error(error.message);
			process.exitCode = 1;
		}
	}
}
