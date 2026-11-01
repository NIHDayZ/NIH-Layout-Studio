import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	PreviewNativeColorablePanelColor,
	PredictColorablePanelOverBackground
} from "../.geometry-engine-test-build/NativeColorablePanelPreview.js";

const evidence = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/panel-color-phase2q-screenshot-evidence.json", import.meta.url), "utf8"
));
const canvas = readFileSync(new URL("../src/components/Canvas.tsx", import.meta.url), "utf8");

test("Phase 2Q confirms screenshot-derived power 2.2 candidate without claiming native shader parity", () => {
	assert.equal(evidence.samples.length, 5);
	assert.equal(evidence.panelStyle, "rover_sim_colorable");
	assert.deepEqual(evidence.backdrop.workbench, [130, 130, 130]);
	let naiveError = 0;
	let candidateError = 0;
	let comparedChannels = 0;
	for (const sample of evidence.samples) {
		const raw = sample.authored.join(" ");
		const [r, g, b, alpha] = sample.authored;
		const prediction = PredictColorablePanelOverBackground(raw, evidence.backdrop.workbench);
		assert.ok(prediction, sample.name);
		assert.equal(prediction.length, 3);
		for (let channel = 0; channel < 3; ++channel) {
			const directChannel = Math.round(alpha * [r, g, b][channel] * 255
				+ (1 - alpha) * evidence.backdrop.workbench[channel]);
			naiveError += Math.abs(directChannel - sample.workbench[channel]);
			candidateError += Math.abs(prediction[channel] - sample.workbench[channel]);
			++comparedChannels;
		}
	}
	const candidateMAE = candidateError / comparedChannels;
	const directMAE = naiveError / comparedChannels;
	assert.ok(candidateMAE <= 2, "candidate should agree with screenshot samples to ~2 channels");
	assert.ok(directMAE >= 40, "direct CSS encoding must remain an inferior screenshot fit");
});

test("Phase 2Q candidate uses separated RGB transfer and unchanged alpha", () => {
	assert.equal(PreviewNativeColorablePanelColor("0 0 0 0"), "rgba(0, 0, 0, 0)");
	assert.equal(PreviewNativeColorablePanelColor("1 1 1 1"), "rgba(255, 255, 255, 1)");
	assert.equal(PreviewNativeColorablePanelColor("0.25 0.5 0.75 0.5"), "rgba(136, 186, 224, 0.5)");
	assert.equal(PreviewNativeColorablePanelColor("0.25 0.5 0.75"), "rgba(136, 186, 224, 1)");
	assert.equal(PreviewNativeColorablePanelColor("0.5 0.5"), undefined);
	assert.equal(PreviewNativeColorablePanelColor("NaN 0.5 0.5 1"), undefined);
	assert.equal(PreviewNativeColorablePanelColor("2 0.5 0.5 1"), undefined);
	assert.equal(PreviewNativeColorablePanelColor("-0.1 0.5 0.5 1"), undefined);
	assert.equal(PreviewNativeColorablePanelColor("0.2 0.5 0.5 0.9 1"), undefined);
	assert.equal(PredictColorablePanelOverBackground("0.3 0.4 0.5 1", [NaN, 130, 130]), null);
	assert.equal(PredictColorablePanelOverBackground("0.3 0.4 0.5 1", [130, 130, 130], 0), null);
});

test("Phase 2Q stays URL-only, scoped strictly to colorable PanelWidget paint", () => {
	assert.ok(canvas.includes('get("experimentalNativeColorablePanel") === "1"'));
	assert.ok(canvas.includes('if (experimentalNativeColorablePanel && style === "rover_sim_colorable")'));
	assert.ok(canvas.includes("return PreviewNativeColorablePanelColor(authoredColor) ?? color"));
	assert.ok(canvas.includes("style.background = GetPanelBackground(node)"));
	assert.ok(canvas.includes('const color = ParseColor(authoredColor)'));
	assert.ok(!canvas.includes("experimentalNativeColorablePanel: true"));
});


test("Phase 2Q calibration screenshots show direct Studio RGB even with the URL flag visible", () => {
	const calibration = evidence.alphaCalibration;
	assert.equal(calibration.colorOrder.length, 5);
	assert.deepEqual(calibration.authoredAlpha, [1, 0.94, 0.75, 0.5, 0.25, 0]);
	assert.equal(calibration.studioRGB.length, 6);
	assert.equal(calibration.workbenchRGB.length, 6);
	let directStudioError = 0;
	let nativeGammaError = 0;
	let gammaStudioError = 0;
	let channelCount = 0;
	for (let colorIndex = 0; colorIndex < 5; ++colorIndex) {
		const authored = evidence.samples[colorIndex].authored;
		const studio = calibration.studioRGB[0][colorIndex];
		const native = calibration.workbenchRGB[0][colorIndex];
		const gamma = PredictColorablePanelOverBackground(
			authored.slice(0, 3).concat(1).join(" "), calibration.workbenchRGB[5][0]
		);
		assert.ok(gamma);
		for (let channel = 0; channel < 3; ++channel) {
			const direct = Math.round(authored[channel] * 255);
			directStudioError += Math.abs(studio[channel] - direct);
			nativeGammaError += Math.abs(native[channel] - gamma[channel]);
			gammaStudioError += Math.abs(studio[channel] - gamma[channel]);
			++channelCount;
		}
	}
	assert.ok(directStudioError / channelCount <= 1,
		"opaque Studio pixels follow unconverted authored channels");
	assert.ok(nativeGammaError / channelCount <= 3,
		"power 2.2 predicts native opaque swatches closely");
	assert.ok(gammaStudioError / channelCount >= 40,
		"screen capture shows no gamma-encoded Studio opaque preview");
});

test("Phase 2Q intermediate-alpha Workbench samples cannot be claimed exact with simple source-over gamma", () => {
	const calibration = evidence.alphaCalibration;
	const backdrop = calibration.workbenchRGB[5][0];
	let partialError = 0;
	let channelCount = 0;
	for (const row of [2, 3]) {
		const alpha = calibration.authoredAlpha[row];
		for (let colorIndex = 0; colorIndex < 5; ++colorIndex) {
			const authored = evidence.samples[colorIndex].authored;
			const prediction = PredictColorablePanelOverBackground(
				authored.slice(0, 3).concat(alpha).join(" "), backdrop
			);
			assert.ok(prediction);
			const measured = calibration.workbenchRGB[row][colorIndex];
			for (let channel = 0; channel < 3; ++channel) {
				partialError += Math.abs(measured[channel] - prediction[channel]);
				++channelCount;
			}
		}
	}
	const mae = partialError / channelCount;
	assert.ok(mae > 5 && mae < 11, `intermediate alpha difference unexpectedly ${mae}`);
	for (const sample of calibration.workbenchRGB[5])
		assert.deepEqual(sample, backdrop, "zero alpha is native gray backdrop");
	for (const sample of calibration.studioRGB[5])
		assert.deepEqual(sample, backdrop, "zero alpha is Studio gray backdrop");
});


test("Phase 2Q two-layer model explains all 30 unchanged Studio screenshot swatches", () => {
	const calibration = evidence.alphaCalibration;
	const gray = calibration.studioRGB[5][0];
	let totalError = 0;
	let channels = 0;
	for (let row = 0; row < calibration.authoredAlpha.length; ++row) {
		const alpha = calibration.authoredAlpha[row];
		for (let colorIndex = 0; colorIndex < 5; ++colorIndex) {
			const authored = evidence.samples[colorIndex].authored;
			const displayed = calibration.studioRGB[row][colorIndex];
			for (let channel = 0; channel < 3; ++channel) {
				const rawByte = Math.round(authored[channel] * 255);
				const gammaByte = Math.round(Math.pow(authored[channel], 1 / 2.2) * 255);
				// Previous Canvas: gamma CSS background first, then direct RGB
				// style-image sprite on top, BOTH using authored alpha.
				const underStyle = gammaByte * alpha + gray[channel] * (1 - alpha);
				const predicted = rawByte * alpha + underStyle * (1 - alpha);
				totalError += Math.abs(predicted - displayed[channel]);
				++channels;
			}
		}
	}
	assert.equal(channels, 90);
	assert.ok(totalError / channels <= 0.6,
		"the legacy double-paint model should reproduce the Studio screenshot");
});

test("Phase 2Q suppresses only the duplicate colorable imageset during gamma experiment", () => {
	assert.ok(canvas.includes("const useExperimentalColorableFill = experimentalNativeColorablePanel && kind.isPanel"));
	assert.ok(canvas.includes('&& (GetNodeProperty(node, "style") ?? "").trim().toLowerCase() === "rover_sim_colorable"'));
	assert.ok(canvas.includes("!useExperimentalColorableFill && RenderStyleChrome("));
	assert.ok(canvas.includes("style.background = GetPanelBackground(node)"));
	assert.ok(canvas.includes('get("experimentalNativeColorablePanel") === "1"'));
});


test("Phase 2Q corrected screenshot verifies single-layer gamma preview against all 30 native swatches", () => {
	const calibration = evidence.alphaCalibration;
	const corrected = calibration.correctedSingleLayer;
	assert.equal(corrected.studioRGB.length, 6);
	assert.equal(calibration.workbenchRGB.length, 6);
	assert.equal(corrected.workbenchDifferenceByAlpha.length, 6);
	let errorTotal = 0;
	let channels = 0;
	for (let row = 0; row < 6; ++row) {
		assert.equal(corrected.studioRGB[row].length, 5);
		let rowError = 0;
		let maxError = 0;
		for (let col = 0; col < 5; ++col) {
			for (let channel = 0; channel < 3; ++channel) {
				const delta = Math.abs(corrected.studioRGB[row][col][channel]
					- calibration.workbenchRGB[row][col][channel]);
				rowError += delta;
				errorTotal += delta;
				maxError = Math.max(maxError, delta);
				++channels;
			}
		}
		const reported = corrected.workbenchDifferenceByAlpha[row];
		assert.equal(reported.alpha, calibration.authoredAlpha[row]);
		assert.ok(Math.abs(reported.meanAbsoluteRGBDifference - rowError / 15) < 0.0001);
		assert.equal(reported.maxChannelDifference, maxError);
	}
	assert.equal(channels, 90);
	const meanError = errorTotal / channels;
	assert.ok(Math.abs(meanError - corrected.overallMeanAbsoluteRGBDifference) < 0.0001);
	assert.ok(meanError < 4 && meanError > 3,
		"corrected screenshot should remain close but not falsely claim complete alpha parity");
	assert.ok(corrected.workbenchDifferenceByAlpha[0].maxChannelDifference <= 2);
	assert.ok(corrected.workbenchDifferenceByAlpha[1].maxChannelDifference <= 3);
	assert.ok(corrected.workbenchDifferenceByAlpha[2].meanAbsoluteRGBDifference > 7);
	assert.ok(corrected.workbenchDifferenceByAlpha[3].meanAbsoluteRGBDifference > 7);
});
