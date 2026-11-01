import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PreviewNativeColorablePanelSrgbColor } from "../.geometry-engine-test-build/NativeColorablePanelPreview.js";

const colors = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/panel-color-phase2q-screenshot-evidence.json", import.meta.url), "utf8"
));
const screens = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/panel-color-phase2r-background-evidence.json", import.meta.url), "utf8"
));
const canvas = readFileSync(new URL("../src/components/Canvas.tsx", import.meta.url), "utf8");

function ParseCSS(css) {
	const match = /^rgba\((\d+), (\d+), (\d+), ([.\d]+)\)$/.exec(css ?? "");
	assert.ok(match, css);
	return match.slice(1).map(Number);
}

test("Phase 2U quantized sRGB exactly predicts all 15 opaque native color channels", () => {
	assert.equal(colors.samples.length, 5);
	let channelMatches = 0;
	for (let i = 0; i < colors.samples.length; ++i) {
		const sample = colors.samples[i];
		const rgba = ParseCSS(PreviewNativeColorablePanelSrgbColor(
			sample.authored.slice(0, 3).concat(1).join(" ")
		));
		assert.deepEqual(rgba.slice(0, 3), screens.pixels.workbench.Dark[0][i]);
		assert.deepEqual(rgba.slice(0, 3), screens.pixels.workbench.Light[0][i]);
		assert.equal(rgba[3], 1);
		channelMatches += 3;
	}
	assert.equal(channelMatches, 15);
	for (const backdrop of screens.backgrounds) {
		const authored = backdrop.authored.join(" ");
		const rgba = ParseCSS(PreviewNativeColorablePanelSrgbColor(authored));
		assert.deepEqual(rgba.slice(0, 3), backdrop.workbench);
	}
});

test("Phase 2U sRGB candidate quantizes alpha and guards invalid authored channels", () => {
	assert.deepEqual(ParseCSS(PreviewNativeColorablePanelSrgbColor("0.25 0.58 0.72 0.5")),
		[137, 200, 221, 128 / 255]);
	assert.deepEqual(ParseCSS(PreviewNativeColorablePanelSrgbColor("0.1 0.1 0.1 0")),
		[90, 90, 90, 0]);
	assert.deepEqual(ParseCSS(PreviewNativeColorablePanelSrgbColor("1 1 1 1")),
		[255, 255, 255, 1]);
	assert.deepEqual(ParseCSS(PreviewNativeColorablePanelSrgbColor("0 0 0 1")),
		[0, 0, 0, 1]);
	assert.equal(PreviewNativeColorablePanelSrgbColor("NaN 0.5 0.5 1"), undefined);
	assert.equal(PreviewNativeColorablePanelSrgbColor("1.1 0.5 0.5 1"), undefined);
	assert.equal(PreviewNativeColorablePanelSrgbColor("-0.1 0.5 0.5 1"), undefined);
	assert.equal(PreviewNativeColorablePanelSrgbColor("0.5 0.5"), undefined);
});

test("Phase 2U explicit transfer A/B flag cannot change default or non-colorable panels", () => {
	assert.ok(canvas.includes('get("experimentalNativeColorableSRGB") === "1"'));
	assert.ok(canvas.includes('const experimentalNativeColorableSRGB = experimentalNativeColorablePanel &&'));
	assert.ok(canvas.includes('if (experimentalNativeColorablePanel && style === "rover_sim_colorable")'));
	assert.ok(canvas.includes("return PreviewNativeColorablePanelSrgbColor(authoredColor) ?? color;"));
	assert.ok(canvas.includes("return PreviewNativeColorablePanelColor(authoredColor) ?? color;"));
	assert.ok(canvas.includes("!useExperimentalColorableFill && RenderStyleChrome("));
	assert.match(canvas, /if \(!style \|\| style === "blank" \|\| style === "empty"\)\s+return undefined;/);
});

test("Phase 2U report rejects canonical alpha-only blending and labels regression fit as diagnostic", () => {
	const raw = execFileSync(process.execPath, ["scripts/Analyze-NativePanelCompositing.mjs"],
		{ encoding: "utf8", cwd: new URL("../", import.meta.url) });
	const result = JSON.parse(raw);
	assert.equal(result.opaqueTransfer.length, 3);
	const exact = result.opaqueTransfer.find(entry => entry.model === "quantized-srgb");
	assert.ok(exact);
	assert.equal(exact.exactChannels, 15);
	assert.equal(exact.meanAbsoluteByteError, 0);
	assert.equal(result.compositingCandidates.length, 4);
	for (const model of result.compositingCandidates)
		assert.equal(model.channelCount, 150);
	const srgb = result.compositingCandidates.find(entry =>
		entry.model === "quantized-srgb-display-source-over");
	assert.ok(srgb);
	assert.ok(srgb.meanAbsoluteByteError > 5, "plain sRGB blend is not equivalent to native alpha");
	assert.equal(result.nonConvexCounterexample.nativeHalfAlpha, 205);
	assert.equal(result.nonConvexCounterexample.ordinarySourceOverImpossible, true);
	assert.equal(result.heldOutColorLinearWeightDiagnostic.diagnosticOnly, true);
	assert.equal(result.heldOutColorLinearWeightDiagnostic.cannotInferShaderOrUnseenAlpha, true);
	assert.equal(result.heldOutColorLinearWeightDiagnostic.totalChannelCount, 150);
	assert.ok(result.heldOutColorLinearWeightDiagnostic.meanAbsoluteByteError < 2);
});
