import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";

const raw = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Panel_Style_Comparison.layout", import.meta.url), "utf8"
);
const root = new LayoutParser().Parse(raw).roots[0];
const colors = ["Blue", "Orange", "Green", "Pink", "Lavender"];
const alpha = [1, 0.94, 0.75, 0.5, 0.25, 0];
const channels = [
	"0.25 0.58 0.72",
	"0.75 0.53 0.27",
	"0.32 0.66 0.49",
	"0.67 0.41 0.55",
	"0.46 0.50 0.70"
];
function Properties(node) {
	return new Map(node.properties.map(property => [property.name.toLowerCase(), property.value]));
}

test("Phase 2T isolates the authored style in 120 matching colored PanelWidgets", () => {
	assert.equal(root.name, "NIHPanelStyleComparison");
	assert.deepEqual(Properties(root).get("size"), "1920 1080");
	assert.equal(root.children.length, 2);
	const backgrounds = [
		{ name: "Dark", position: "42 42", color: "0.10 0.10 0.10 1" },
		{ name: "Light", position: "944 42", color: "0.80 0.80 0.80 1" }
	];
	let swatches = 0;
	for (let backdropIndex = 0; backdropIndex < 2; ++backdropIndex) {
		const expected = backgrounds[backdropIndex];
		const backdrop = root.children[backdropIndex];
		const bg = Properties(backdrop);
		assert.equal(backdrop.name, "QTBackdrop" + expected.name);
		assert.equal(backdrop.type, "PanelWidgetClass");
		assert.equal(bg.get("position"), expected.position);
		assert.equal(bg.get("size"), "830 895");
		assert.equal(bg.get("color"), expected.color);
		assert.equal(bg.get("style"), "rover_sim_colorable");
		assert.equal(backdrop.children.length, 2);
		const [plain, styled] = backdrop.children;
		assert.equal(plain.name, "QT" + expected.name + "PlainGroup");
		assert.equal(styled.name, "QT" + expected.name + "StyledGroup");
		assert.equal(plain.type, "FrameWidgetClass");
		assert.equal(styled.type, "FrameWidgetClass");
		assert.equal(plain.children.length, 30);
		assert.equal(styled.children.length, 30);
		for (let row = 0; row < 6; ++row) {
			for (let col = 0; col < 5; ++col) {
				const i = row * 5 + col;
				const plainPanel = plain.children[i];
				const styledPanel = styled.children[i];
				const alphaCode = String(Math.round(alpha[row] * 100)).padStart(3, "0");
				const stem = "QT" + expected.name;
				assert.equal(plainPanel.name, stem + "Plain" + colors[col] + "Alpha" + alphaCode);
				assert.equal(styledPanel.name, stem + "Styled" + colors[col] + "Alpha" + alphaCode);
				assert.equal(plainPanel.type, "PanelWidgetClass");
				assert.equal(styledPanel.type, "PanelWidgetClass");
				assert.equal(plainPanel.children.length, 0);
				assert.equal(styledPanel.children.length, 0);
				const rawPlain = Properties(plainPanel);
				const rawStyled = Properties(styledPanel);
				assert.equal(rawPlain.has("style"), false, "plain panel must omit style entirely");
				assert.equal(rawStyled.get("style"), "rover_sim_colorable");
				const expectedColor = channels[col] + " " + alpha[row];
				assert.equal(rawPlain.get("color"), expectedColor);
				assert.equal(rawStyled.get("color"), expectedColor);
				const expectedPosition = String(19 + 143 * col) + " " + String(20 + 60 * row);
				assert.equal(rawPlain.get("position"), expectedPosition);
				assert.equal(rawStyled.get("position"), expectedPosition);
				assert.equal(rawPlain.get("size"), "112 48");
				assert.equal(rawStyled.get("size"), "112 48");
				for (const key of ["hexactpos", "vexactpos", "hexactsize", "vexactsize"]) {
					assert.equal(rawPlain.get(key), "1");
					assert.equal(rawStyled.get(key), "1");
				}
				const remaining = new Map(rawStyled);
				remaining.delete("style");
				assert.deepEqual(remaining, rawPlain,
					"only style may differ; size, color, alpha and flags must match");
				++swatches;
			}
		}
	}
	assert.equal(swatches, 60, "60 paired swatches, 120 panels total");
});

test("Phase 2T passive panels cannot activate managed geometry experiments", () => {
	const measured = MeasureLayoutTree([root]);
	for (const viewport of [
		{ x: 0, y: 0, width: 1920, height: 1080 },
		{ x: 0, y: 0, width: 1120, height: 720 }
	]) {
		const baseline = ArrangeMeasuredGeometry(measured, viewport);
		const guarded = ArrangeMeasuredGeometry(measured, viewport, 1, {
			constrainedGrid: true,
			gridRelativeContentPrototype: true
		});
		assert.equal(baseline.entries.length, 127);
		assert.deepEqual(guarded.entries, baseline.entries);
		assert.equal(guarded.appliedStrategies.length, 0);
	}
});


const phase2tEvidence = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/panel-color-phase2t-screenshot-evidence.json", import.meta.url), "utf8"
));
const canvasSource = readFileSync(
	new URL("../src/components/Canvas.tsx", import.meta.url), "utf8"
);

test("Phase 2T native blank style leaves authored-color panels transparent, preserving their widget state", () => {
	const runtime = phase2tEvidence.nativeClient;
	assert.equal(runtime.recordCount, 36);
	assert.equal(runtime.recordsPerPhase, 18);
	assert.equal(runtime.allPhasesEqual, true);
	assert.equal(runtime.allNativeVisible, true);
	assert.equal(runtime.flagsForAll, 536870975);
	assert.equal(runtime.plainStyle, "blank");
	assert.equal(runtime.styledStyle, "rover_sim_colorable");
	const samples = phase2tEvidence.samples;
	assert.equal(samples.length, 6);
	for (const sample of samples) {
		const parentRgb = sample.backdrop === "dark" ? [90, 90, 90] : [231, 231, 231];
		if (sample.style === "absent") {
			assert.deepEqual(sample.workbench.rgb, parentRgb,
				"native unstyled panel must show its parent background rather than a synthesized fill");
		} else {
			assert.equal(sample.style, "rover_sim_colorable");
			assert.equal(sample.authoredAlpha, 1);
			for (let channel = 0; channel < 3; ++channel) {
				assert.ok(Math.abs(sample.workbench.rgb[channel] - sample.studio.rgb[channel]) <= 1,
					"the experimental single-layer preview must remain close for fully opaque styled swatches");
			}
		}
	}
});

test("Phase 2T Canvas does not synthesize a fill for implicit blank PanelWidget style", () => {
	const start = canvasSource.indexOf("function GetPanelBackground(node: LayoutNode)");
	const end = canvasSource.indexOf("function GetImageCandidates(", start);
	assert.ok(start >= 0 && end > start);
	const source = canvasSource.slice(start, end);
	assert.match(source, /if \(!style \|\| style === "blank" \|\| style === "empty"\)\s+return undefined;/);
	assert.ok(source.includes('if (experimentalNativeColorablePanel && style === "rover_sim_colorable")'));
	assert.ok(source.includes('return PreviewNativeColorablePanelColor(authoredColor) ?? color'));
	assert.ok(canvasSource.includes('style.background = GetPanelBackground(node)'));
	assert.ok(canvasSource.includes('!useExperimentalColorableFill && RenderStyleChrome('));
});
