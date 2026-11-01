import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";

const fixtures = new URL("./fixtures/workbench-grid/", import.meta.url);
const layout = new LayoutParser().Parse(readFileSync(
	new URL("NIH_Panel_Heldout_Alpha_Matrix.layout", fixtures), "utf8")).roots[0];
const earlier = new LayoutParser().Parse(readFileSync(
	new URL("NIH_Panel_Background_Calibration.layout", fixtures), "utf8")).roots[0];
const predictions = JSON.parse(readFileSync(
	new URL("panel-color-phase2w-frozen-predictions.json", fixtures), "utf8"));
const stagedScript = readFileSync(
	new URL("runtime-mod/Prepare-GridProbe.ps1", fixtures), "utf8");

const backgroundNames = ["Dark", "Light", "Chromatic"];
const alphaLevels = [1, 0.875, 0.625, 0.375, 0.125, 0];
function Properties(node) {
	return new Map(node.properties.map(prop => [prop.name.toLowerCase(), prop.value]));
}
function AnalyzeWith(path) {
	const params = ["scripts/Analyze-NativePanelUnseenAlpha.mjs"];
	if (path)
		params.push(path);
	return JSON.parse(execFileSync(process.execPath, params, {
		cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8"
	}));
}

test("Phase 2W isolates four unseen alphas across three independently styled parent backdrops", () => {
	assert.equal(layout.name, "NIHHeldoutAlphaMatrix");
	assert.equal(layout.type, "FrameWidgetClass");
	assert.equal(Properties(layout).get("size"), "1920 1080");
	assert.equal(layout.children.length, 3);
	const expectedBackgrounds = [
		{ name: "Dark", position: "38 65", color: "0.10 0.10 0.10 1" },
		{ name: "Light", position: "667 65", color: "0.80 0.80 0.80 1" },
		{ name: "Chromatic", position: "1296 65", color: "0.08 0.36 0.82 1" }
	];
	for (let b = 0; b < 3; ++b) {
		const parent = layout.children[b];
		const expected = expectedBackgrounds[b];
		assert.equal(parent.name, "QWBackdrop" + expected.name);
		assert.equal(parent.type, "PanelWidgetClass");
		const attrs = Properties(parent);
		assert.equal(attrs.get("position"), expected.position);
		assert.equal(attrs.get("color"), expected.color);
		assert.equal(attrs.get("style"), "rover_sim_colorable");
		assert.equal(attrs.get("size"), "580 650");
		assert.equal(parent.children.length, 30);
		for (let row = 0; row < 6; ++row) {
			for (let col = 0; col < 5; ++col) {
				const child = parent.children[row * 5 + col];
				const old = earlier.children[0].children[(row === 0 ? 0 : row === 5 ? 5 : 1) * 5 + col];
				const props = Properties(child);
				const oldProps = Properties(old);
				const color = props.get("color").split(/\s+/).map(Number);
				const oldColor = oldProps.get("color").split(/\s+/).map(Number);
				assert.equal(child.type, "PanelWidgetClass");
				assert.equal(child.children.length, 0);
				assert.equal(props.get("style"), "rover_sim_colorable");
				assert.deepEqual(color.slice(0, 3), oldColor.slice(0, 3));
				assert.equal(color[3], alphaLevels[row]);
				assert.equal(props.get("position"), String(18 + 110 * col) + " " + String(26 + 99 * row));
				assert.equal(props.get("size"), "96 70");
				for (const exact of ["hexactpos","vexactpos","hexactsize","vexactsize"])
					assert.equal(props.get(exact), "1");
			}
		}
	}
	assert.ok(stagedScript.includes("NIH_Panel_Heldout_Alpha_Matrix.layout"));
});

test("Phase 2W predictive fixture does not alter prior GridSpacer behavior", () => {
	const measured = MeasureLayoutTree([layout]);
	for (const viewport of [{x:0,y:0,width:1920,height:1080},{x:0,y:0,width:1120,height:720}]) {
		const baseline = ArrangeMeasuredGeometry(measured, viewport);
		const guarded = ArrangeMeasuredGeometry(measured, viewport, 1, {
			constrainedGrid:true, gridRelativeContentPrototype:true
		});
		assert.equal(baseline.entries.length, 94);
		assert.deepEqual(guarded.entries, baseline.entries);
		assert.equal(guarded.appliedStrategies.length, 0);
	}
});

test("Phase 2W frozen alpha interpolation and 270-channel predictions have no native observations", () => {
	assert.equal(predictions.measurementStatus, "PREDICTIONS_FROZEN_BEFORE_NEW_ALPHA_NATIVE_CAPTURE");
	assert.equal(predictions.allowReFittingAfterCapture, false);
	assert.deepEqual(predictions.alphas, alphaLevels);
	assert.deepEqual(predictions.unseenAlphas, [0.875,0.625,0.375,0.125]);
	assert.deepEqual(predictions.backgrounds.map(x=>x.name), backgroundNames);
	assert.deepEqual(predictions.backgrounds.map(x=>x.opaqueSrgbPrediction),
		[[90,90,90],[231,231,231],[79,162,234]]);
	assert.equal(predictions.knownKnots.length, 6);
	assert.equal(predictions.interpolatedWeights.length, 6);
	let swatches = 0;
	for (const bg of predictions.backgrounds) {
		for (const model of ["pchip","linear"]) {
			const rows = predictions.predictedNativeRgb[bg.name][model];
			assert.equal(rows.length, 6);
			for (const row of rows) {
				assert.equal(row.length, 5);
				for (const rgb of row) {
					assert.equal(rgb.length, 3);
					assert.ok(rgb.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
					++swatches;
				}
			}
			for (let col = 0; col < 5; ++col)
				assert.deepEqual(rows[5][col], bg.opaqueSrgbPrediction);
		}
	}
	assert.equal(swatches, 180, "90 prediction swatches per model across three backgrounds");
});

test("Phase 2W analyzer independently reproduces frozen PCHIP and linear predictions before capture", () => {
	const report = AnalyzeWith();
	assert.equal(report.phase, "2W");
	assert.equal(report.status, "PREDICTION_ONLY_AWAITING_NATIVE_CAPTURE");
	assert.equal(report.nativeMeasurementsAvailable, false);
	assert.equal(report.validatedHeldOutAlphas, false);
	assert.deepEqual(report.backgroundOrder, backgroundNames);
	assert.deepEqual(report.alphaOrder, alphaLevels);
	assert.deepEqual(report.predictedNativeRgb, predictions.predictedNativeRgb);
	assert.equal(report.interpolatedWeights.length, 6);
});

test("Phase 2W optional native evaluator is read-only and accepts synthetic data for ingestion only", () => {
	const dir = mkdtempSync(join(tmpdir(),"nih-phase2w-"));
	const file = join(dir,"synthetic.json");
	try {
		const fake = {backgrounds:predictions.backgrounds.map(bg=>({
			name:bg.name,backdropRGB:bg.opaqueSrgbPrediction,
			swatchesRGB:predictions.predictedNativeRgb[bg.name].pchip
		}))};
		writeFileSync(file,JSON.stringify(fake));
		const report = AnalyzeWith(file);
		assert.equal(report.status,"HELD_OUT_ALPHA_COMPARISON");
		assert.equal(report.heldOut.channelCount,270);
		assert.equal(report.heldOut.intermediateChannelCount,180);
		assert.equal(report.heldOut.overall.pchip,0);
		assert.equal(report.heldOut.intermediateOnly.pchip,0);
		assert.ok(report.heldOut.overall.css>0);
		assert.equal(report.validatedHeldOutAlphas,true);
		assert.deepEqual(report.predictedNativeRgb,predictions.predictedNativeRgb);
	} finally {
		rmSync(dir,{recursive:true,force:true});
	}
});
