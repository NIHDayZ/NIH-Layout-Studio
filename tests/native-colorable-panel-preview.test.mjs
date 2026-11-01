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
