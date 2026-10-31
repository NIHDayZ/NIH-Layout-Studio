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
