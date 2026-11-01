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


const phase2uCapture = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/panel-color-phase2u-quantized-srgb-screenshot-evidence.json", import.meta.url),
	"utf8"
));

test("Phase 2U actual sRGB screenshot matches every native opaque and transparent control", () => {
	assert.equal(phase2uCapture.screenshotDimensions.length, 2);
	assert.equal(phase2uCapture.previewZoomPercent, 46);
	assert.deepEqual(phase2uCapture.authoredAlpha, [1, 0.94, 0.75, 0.5, 0.25, 0]);
	assert.deepEqual(phase2uCapture.experimentFlags, {
		experimentalNativeColorablePanel: true,
		experimentalNativeColorableSRGB: true
	});
	for (const backdrop of screens.backgrounds) {
		const rows = phase2uCapture.studio[backdrop.name];
		assert.equal(rows.length, 6);
		for (const row of rows)
			assert.equal(row.length, 5);
		for (let i = 0; i < 5; ++i) {
			assert.deepEqual(rows[0][i], screens.pixels.workbench[backdrop.name][0][i],
				"fully opaque sRGB swatch must match actual native screenshot");
			assert.deepEqual(rows[5][i], backdrop.workbench,
				"fully transparent swatch must show parent background");
		}
	}
});

test("Phase 2U screenshot preserves independently measured partial alpha mismatch", () => {
	let channels = 0;
	for (const backdrop of ["Dark", "Light"]) {
		for (let row = 0; row < screens.alphaRows.length; ++row) {
			let errorSum = 0;
			for (let color = 0; color < 5; ++color) {
				for (let channel = 0; channel < 3; ++channel) {
					const predicted = phase2uCapture.studio[backdrop][row][color][channel];
					const actual = screens.pixels.workbench[backdrop][row][color][channel];
					errorSum += Math.abs(predicted - actual);
					++channels;
				}
			}
			const observed = errorSum / 15;
			const frozen = phase2uCapture.measuredMAEByAlpha[backdrop][row];
			assert.ok(Math.abs(observed - frozen) < 0.0001,
				backdrop + " authored alpha " + screens.alphaRows[row]);
		}
	}
	assert.equal(channels, 150);
	assert.equal(phase2uCapture.measuredMAEByAlpha.Dark[0], 0);
	assert.equal(phase2uCapture.measuredMAEByAlpha.Light[0], 0);
	assert.ok(phase2uCapture.measuredMAEByAlpha.Light[3] > 17);
	assert.equal(phase2uCapture.noShaderImplementationClaim, true);
});
