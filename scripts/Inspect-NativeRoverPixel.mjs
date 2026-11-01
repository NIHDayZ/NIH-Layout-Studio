/**
 * Inspect the one native texel used by dayzwidgets.styles / rover_sim_colorable.
 *
 * Native sources:
 *  gui/looknfeel/dayzwidgets.styles:3284-3307
 *  gui/imagesets/rover_imageset.imageset:11-15
 *  WhitePixel: Pos 1 101, Size 1 1, Flags 0
 *
 * Prerequisite: npm run build:bc7-tests
 * Usage: node scripts/Inspect-NativeRoverPixel.mjs P:\gui\imagesets\rover_imageset.edds
 *
 * This reports decoded atlas RGBA bytes, not native GPU blend behavior.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { DecodeEddsToPixels } from "../.bc7-test-build/project/EddsDecoder.js";

const candidate = process.argv[2] ?? "P:\\gui\\imagesets\\rover_imageset.edds";
const path = resolve(candidate);
if (!existsSync(path)) {
	console.error("Native rover imageset was not found: " + path);
	console.error("Supply the absolute EDDS path as the first argument.");
	process.exitCode = 1;
} else {
	try {
		const bytes = readFileSync(path);
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		const { width, height, rgba } = DecodeEddsToPixels(buffer);
		const pixelX = 1;
		const pixelY = 101;
		if (width <= pixelX || height <= pixelY)
			throw new Error("Decoded dimensions " + width + "x" + height + " exclude the WhitePixel location");
		function ReadPixel(x, y) {
			const offset = (y * width + x) * 4;
			return Array.from(rgba.slice(offset, offset + 4));
		}
		const whitePixel = ReadPixel(pixelX, pixelY);
		const neighborhood = [];
		for (let y = Math.max(0, pixelY - 1); y <= Math.min(height - 1, pixelY + 1); ++y) {
			const row = [];
			for (let x = Math.max(0, pixelX - 1); x <= Math.min(width - 1, pixelX + 1); ++x)
				row.push({ x, y, rgba: ReadPixel(x, y) });
			neighborhood.push(row);
		}
		const report = {
			status: "decoded",
			texturePath: path,
			source: "DayZ rover_imageset.imageset WhitePixel Pos 1 101 Size 1 1",
			decoder: "NIH Layout Studio / DecodeEddsToPixels",
			textureBytes: bytes.length,
			width,
			height,
			whitePixel: { x: pixelX, y: pixelY, rgba: whitePixel },
			opaqueWhite: whitePixel.every(channel => channel === 255),
			neighborhood,
			interpretation: "Decoded texel only; native shader/blend not established"
		};
		console.log(JSON.stringify(report, null, 2));
	} catch (error) {
		console.error("Native WhitePixel inspection failed:", error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
