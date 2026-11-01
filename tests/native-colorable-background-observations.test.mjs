import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/panel-color-phase2r-background-evidence.json", import.meta.url),
	"utf8"
));

function Metrics(backdrop, alphaIndex) {
	const studio = evidence.pixels.studio[backdrop][alphaIndex];
	const native = evidence.pixels.workbench[backdrop][alphaIndex];
	let sum = 0;
	let maximum = 0;
	let count = 0;
	for (let color = 0; color < 5; ++color) {
		for (let channel = 0; channel < 3; ++channel) {
			const difference = Math.abs(studio[color][channel] - native[color][channel]);
			sum += difference;
			maximum = Math.max(maximum, difference);
			++count;
		}
	}
	return { meanAbsoluteDifference: sum / count, maximum, count };
}

test("Phase 2R recorded 50 screenshot-based color swatches across two distinct backdrops", () => {
	assert.equal(evidence.colorOrder.length, 5);
	assert.deepEqual(evidence.alphaRows, [1, 0.94, 0.75, 0.5, 0.25]);
	assert.equal(evidence.backgrounds.length, 2);
	assert.deepEqual(evidence.backgrounds[0].workbench, [90, 90, 90]);
	assert.deepEqual(evidence.backgrounds[1].workbench, [231, 231, 231]);
	let observations = 0;
	for (const program of ["studio", "workbench"]) {
		for (const background of ["Dark", "Light"]) {
			const rows = evidence.pixels[program][background];
			assert.equal(rows.length, 5, background);
			for (const row of rows) {
				assert.equal(row.length, 5);
				for (const pixel of row) {
					assert.equal(pixel.length, 3);
					assert.ok(pixel.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255));
					++observations;
				}
			}
		}
	}
	assert.equal(observations, 100, "50 corresponding Studio and Workbench swatches");
	for (const background of ["Dark", "Light"]) {
		const opaque = Metrics(background, 0);
		assert.ok(opaque.meanAbsoluteDifference < 1.5);
		assert.ok(opaque.maximum <= 2);
	}
});

test("Phase 2R translucent error depends strongly on the painted background", () => {
	const dark = [1.2667, 0.6, 2.6667, 1.4, 7.4667];
	const light = [1.2667, 2.3333, 10.8667, 17.1333, 13];
	for (let row = 0; row < 5; ++row) {
		assert.ok(Math.abs(Metrics("Dark", row).meanAbsoluteDifference - dark[row]) < 0.0001);
		assert.ok(Math.abs(Metrics("Light", row).meanAbsoluteDifference - light[row]) < 0.0001);
	}
	assert.ok(Metrics("Light", 3).meanAbsoluteDifference > 10 * Metrics("Dark", 3).meanAbsoluteDifference);
});

test("Phase 2R native opacity cannot be explained by any source-over alpha curve alone", () => {
	// For monotone, source-over color mixing, every channel stays in the
	// interval bounded by the source and the opaque backdrop for every
	// opacity 0..1. Native half-alpha light/orange violates that invariant.
	const opaqueSource = evidence.pixels.workbench.Light[0][1];
	const halfAlpha = evidence.pixels.workbench.Light[3][1];
	const backdrop = evidence.backgrounds[1].workbench;
	assert.equal(opaqueSource[0], 224);
	assert.equal(backdrop[0], 231);
	assert.equal(halfAlpha[0], 205);
	assert.ok(halfAlpha[0] < Math.min(opaqueSource[0], backdrop[0]) - 10);
	// The contradiction survives independent in-screenshot comparisons
	// (same browser/workbench capture, no cross-program color calibration).
	// It requires additional native color/alpha processing, not only an
	// authored-alpha -> effective-alpha remapping.
});
