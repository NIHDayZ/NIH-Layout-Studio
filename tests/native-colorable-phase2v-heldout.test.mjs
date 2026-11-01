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
