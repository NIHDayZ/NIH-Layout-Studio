import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { PreviewNativeColorablePanelSrgbColor } from "../.geometry-engine-test-build/NativeColorablePanelPreview.js";

const root = new URL("./fixtures/workbench-grid/", import.meta.url);
const fixture = readFileSync(new URL("NIH_Panel_Heldout_Chromatic.layout", root), "utf8");
const priorFixture = readFileSync(new URL("NIH_Panel_Background_Calibration.layout", root), "utf8");
const stagedScript = readFileSync(new URL("runtime-mod/Prepare-GridProbe.ps1", root), "utf8");
const prediction = JSON.parse(readFileSync(
	new URL("panel-color-phase2v-frozen-predictions.json", root), "utf8"));
const older = JSON.parse(readFileSync(
	new URL("panel-color-phase2r-background-evidence.json", root), "utf8"));

function Props(node) {
	return new Map(node.properties.map(item => [item.name.toLowerCase(), item.value]));
}
function AnalyzeWith(observedFile) {
	const params = ["scripts/Analyze-NativePanelHeldoutBackdrop.mjs"];
	if (observedFile)
		params.push(observedFile);
	return JSON.parse(execFileSync(process.execPath, params, {
		cwd: fileURLToPath(new URL("../", import.meta.url)),
		encoding: "utf8"
	}));
}

test("Phase 2V has one new held-out chromatic backdrop with 30 identical swatch settings", () => {
	const parsed = new LayoutParser().Parse(fixture).roots[0];
	const prior = new LayoutParser().Parse(priorFixture).roots[0];
	assert.equal(parsed.name, "NIHColorableHeldoutChromatic");
	assert.equal(parsed.children.length, 1);
	const chromatic = parsed.children[0];
	assert.equal(chromatic.name, "QVBackdropChromatic");
	assert.equal(chromatic.type, "PanelWidgetClass");
	assert.equal(Props(chromatic).get("color"), "0.08 0.36 0.82 1");
	assert.equal(Props(chromatic).get("style"), "rover_sim_colorable");
	assert.equal(Props(chromatic).get("position"), "36 36");
	assert.equal(Props(chromatic).get("size"), "800 670");
	assert.equal(chromatic.children.length, 30);
	const existing = prior.children[0];
	for (let i = 0; i < 30; ++i) {
		const current = chromatic.children[i];
		const reference = existing.children[i];
		const properties = Props(current);
		const previous = Props(reference);
		assert.equal(current.type, "PanelWidgetClass");
		assert.equal(properties.get("style"), "rover_sim_colorable");
		assert.equal(properties.get("color"), previous.get("color"));
		assert.equal(properties.get("position"), previous.get("position"));
		assert.equal(properties.get("size"), previous.get("size"));
		for (const exact of ["hexactpos", "vexactpos", "hexactsize", "vexactsize"])
			assert.equal(properties.get(exact), previous.get(exact));
		assert.equal(current.children.length, 0);
	}
	assert.ok(stagedScript.includes("NIH_Panel_Heldout_Chromatic.layout"));
});

test("Phase 2V fixed opaque and transparent controls and frozen prediction grid remain unmeasured", () => {
	assert.equal(prediction.phase, "2V");
	assert.equal(prediction.measurementStatus, "PREDICTIONS_FROZEN_BEFORE_THIRD_NATIVE_CAPTURE");
	assert.equal(prediction.allowFittingThirdBackground, false);
	assert.equal(prediction.trainingBoundaries.heldOutChromaticNeverUsed, true);
	assert.deepEqual(prediction.background.authored, [0.08, 0.36, 0.82, 1]);
	assert.deepEqual(prediction.background.opaqueSrgbPrediction, [79, 162, 234]);
	assert.equal(PreviewNativeColorablePanelSrgbColor("0.08 0.36 0.82 1"), "rgba(79, 162, 234, 1)");
	assert.deepEqual(prediction.alphaOrder, [1, 0.94, 0.75, 0.5, 0.25, 0]);
	assert.deepEqual(prediction.colorOrder, older.colorOrder);
	assert.equal(prediction.predictedNativeRgb.length, 6);
	assert.equal(prediction.coefficients.length, 6);
	assert.deepEqual(prediction.coefficients[0], {authoredAlpha:1,sourceWeight:1,backdropWeight:0});
	assert.deepEqual(prediction.coefficients[5], {authoredAlpha:0,sourceWeight:0,backdropWeight:1});
	for (const [row, colors] of prediction.predictedNativeRgb.entries()) {
		assert.equal(colors.length, 5);
		for (let i = 0; i < 5; ++i) {
			const rgb = colors[i];
			assert.equal(rgb.length, 3);
			assert.ok(rgb.every(value => Number.isInteger(value) && value >= 0 && value <= 255));
			if (row === 0)
				assert.deepEqual(rgb, older.pixels.workbench.Dark[0][i]);
			if (row === 5)
				assert.deepEqual(rgb, [79,162,234]);
		}
	}
});

test("Phase 2V independently recomputes predictions and does not claim a native held-out measurement", () => {
	const result = AnalyzeWith();
	assert.equal(result.phase, "2V");
	assert.equal(result.status, "PREDICTION_ONLY_AWAITING_NATIVE_CAPTURE");
	assert.equal(result.nativeObservationsAvailable, false);
	assert.equal(result.validatedHeldOut, false);
	assert.deepEqual(result.predictedNativeRgb, prediction.predictedNativeRgb);
	assert.deepEqual(result.backdropExpectedRgb, prediction.background.opaqueSrgbPrediction);
	assert.deepEqual(result.trainingBackdrops, ["Dark", "Light"]);
	assert.equal(result.sourceWeights.length, 6);
	assert.equal(result.ordinarySrgbCssRgb.length, 6);
});

test("Phase 2V optional observed-file evaluator reports held-out errors without refitting (synthetic test only)", () => {
	// This test creates MOCK measurements to verify ingestion. The fixture's
	// predictions must never be mistaken for actual Workbench observations.
	const folder = mkdtempSync(join(tmpdir(), "nih-phase2v-"));
	const observedPath = join(folder, "synthetic-observed.json");
	try {
		writeFileSync(observedPath, JSON.stringify({
			backdropRGB: prediction.background.opaqueSrgbPrediction,
			swatchesRGB: prediction.predictedNativeRgb
		}));
		const actual = AnalyzeWith(observedPath);
		assert.equal(actual.status, "HELD_OUT_NATIVE_COMPARISON");
		assert.equal(actual.comparison.channelCount, 90);
		assert.equal(actual.comparison.overallMAE.fittedFromNeutral, 0);
		assert.deepEqual(actual.comparison.backgroundControl.absoluteChannelErrors, [0, 0, 0]);
		assert.deepEqual(actual.predictedNativeRgb, prediction.predictedNativeRgb);
		assert.ok(actual.comparison.overallMAE.ordinarySrgbCss > 0);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
});


const nativeCapture = JSON.parse(readFileSync(
	new URL("panel-color-phase2v-workbench-observations.json", root), "utf8"
));

test("Phase 2V independent native screenshot preserves pre-frozen predictions and exact controls", () => {
	assert.equal(nativeCapture.kind, "ACTUAL_NATIVE_HELD_OUT_OBSERVATIONS");
	assert.equal(nativeCapture.predictionsFrozenBeforeCapture.commit,
		"51f663f2091af0f4ab219e3aacbd62ac1eea1f6e");
	assert.equal(nativeCapture.predictionsFrozenBeforeCapture.unchangedAfterMeasurement, true);
	assert.deepEqual(nativeCapture.backdropRGB, [79, 162, 234]);
	assert.deepEqual(nativeCapture.studioBackdropRGB, nativeCapture.backdropRGB);
	assert.deepEqual(nativeCapture.alphaOrder, [1, 0.94, 0.75, 0.5, 0.25, 0]);
	assert.deepEqual(nativeCapture.colorOrder, prediction.colorOrder);
	assert.deepEqual(nativeCapture.swatchesRGB[0], prediction.predictedNativeRgb[0]);
	assert.deepEqual(nativeCapture.swatchesRGB[5], prediction.predictedNativeRgb[5]);
	assert.deepEqual(nativeCapture.studioSwatchesRGB[0], prediction.predictedNativeRgb[0]);
	assert.deepEqual(nativeCapture.studioSwatchesRGB[5], prediction.predictedNativeRgb[5]);
	assert.equal(nativeCapture.swatchesRGB.length, 6);
	assert.equal(nativeCapture.studioSwatchesRGB.length, 6);
	for (const rows of [nativeCapture.swatchesRGB, nativeCapture.studioSwatchesRGB]) {
		for (const row of rows) {
			assert.equal(row.length, 5);
			for (const rgb of row)
				assert.equal(rgb.length, 3);
		}
	}
});

test("Phase 2V blind out-of-sample model beats ordinary sRGB blend without refitting", () => {
	const nativeFile = fileURLToPath(new URL(
		"panel-color-phase2v-workbench-observations.json", root));
	const report = AnalyzeWith(nativeFile);
	assert.equal(report.status, "HELD_OUT_NATIVE_COMPARISON");
	assert.equal(report.validatedHeldOut, true);
	assert.equal(report.nativeObservationsAvailable, true);
	assert.equal(report.comparison.observationIsHeldOut, true);
	assert.equal(report.comparison.channelCount, 90);
	assert.deepEqual(report.comparison.backgroundControl.absoluteChannelErrors, [0, 0, 0]);
	assert.deepEqual(report.predictedNativeRgb, prediction.predictedNativeRgb);
	assert.equal(report.comparison.overallMAE.fittedFromNeutral, 0.7111);
	assert.equal(report.comparison.overallMAE.ordinarySrgbCss, 5.7222);
	assert.deepEqual(report.comparison.perAlphaMAE.fittedFromNeutral,
		[0, 0.1333, 1.0667, 1.7333, 1.3333, 0]);
	assert.deepEqual(report.comparison.perAlphaMAE.ordinarySrgbCss,
		[0, 2.4667, 8.1333, 12.1333, 11.6, 0]);
	assert.ok(report.comparison.overallMAE.fittedFromNeutral <
		report.comparison.overallMAE.ordinarySrgbCss / 7,
		"previously frozen model must outperform the independent CSS blend baseline");
});

test("Phase 2V screenshot does not claim fitted coefficients are universal or rewrite earlier inputs", () => {
	assert.equal(prediction.allowFittingThirdBackground, false);
	assert.equal(prediction.measurementStatus, "PREDICTIONS_FROZEN_BEFORE_THIRD_NATIVE_CAPTURE");
	assert.equal(prediction.trainingBoundaries.heldOutChromaticNeverUsed, true);
	assert.equal(nativeCapture.predictionsFrozenBeforeCapture.unchangedAfterMeasurement, true);
	for (let row = 1; row <= 4; ++row) {
		assert.notDeepEqual(nativeCapture.swatchesRGB[row], prediction.predictedNativeRgb[row],
			"model remains approximate even on independently held-out background");
	}
});
