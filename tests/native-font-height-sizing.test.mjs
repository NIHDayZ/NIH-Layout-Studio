import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ResolveExperimentalFnt5FontSize } from "../.geometry-engine-test-build/Fnt5FontSizingExperiment.js";

test("height experiment requests full widget height instead of capping at nominal FNT5 size", () => {
	assert.equal(ResolveExperimentalFnt5FontSize("height",72,34,true,false),34);
	assert.equal(ResolveExperimentalFnt5FontSize("height",72,110,true,false),110);
	assert.equal(ResolveExperimentalFnt5FontSize("height",24,44,true,false),44);
	assert.equal(ResolveExperimentalFnt5FontSize("height",72,68,true,false),68);
	assert.equal(ResolveExperimentalFnt5FontSize("height",24,1,true,false),1);
});

test("old 0.9/capped fitting experiment remains exactly reproducible", () => {
	assert.equal(ResolveExperimentalFnt5FontSize("1",72,34,true,false),30.6);
	assert.equal(ResolveExperimentalFnt5FontSize("1",72,110,true,false),72);
	assert.equal(ResolveExperimentalFnt5FontSize("1",72,68,true,false),61.2);
	assert.equal(ResolveExperimentalFnt5FontSize("1",24,44,true,false),24);
	assert.equal(ResolveExperimentalFnt5FontSize("0.8",72,50,true,false),40);
	assert.equal(ResolveExperimentalFnt5FontSize("1.2",72,110,true,false),72);
});

test("no experiment, non-FNT5 resource, and explicit author size are unaffected", () => {
	for (const mode of [null,"0","height","1","0.8"]) {
		assert.equal(ResolveExperimentalFnt5FontSize(mode,72,34,false,false),72);
		assert.equal(ResolveExperimentalFnt5FontSize(mode,72,34,true,true),72);
	}
	assert.equal(ResolveExperimentalFnt5FontSize(null,72,34,true,false),72);
	assert.equal(ResolveExperimentalFnt5FontSize("0",72,34,true,false),72);
});

test("unsupported sizing ratios or invalid dimensions fail closed", () => {
	for (const mode of ["", "wat", "-1","0.49","1.21","Infinity","NaN"]) {
		assert.equal(ResolveExperimentalFnt5FontSize(mode,24,44,true,false),24);
	}
	assert.equal(ResolveExperimentalFnt5FontSize("height",24,Number.NaN,true,false),24);
	assert.equal(ResolveExperimentalFnt5FontSize("height",24,-4,true,false),1);
	assert.equal(ResolveExperimentalFnt5FontSize("height",0,44,true,false),0);
});

test("six independently measured font widths follow height sizing while vertical alignment remains open", () => {
	const capture = JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-route/capture.height-visual.2026-10-29.json", import.meta.url
	), "utf8"));
	assert.equal(capture.captureKind, "paired-native-studio-height-sized-font-ink");
	assert.deepEqual(capture.sourceImages.map(image => image.displayedZoomPercent), [68,68]);
	assert.equal(capture.cases.length, 6);
	assert.equal(capture.findings.widthPassCount, 6);
	assert.equal(capture.gates.universalEnfusionTextSizing, "not-proven");
	assert.equal(capture.gates.nativeVerticalAlignment, "fail-or-pending");
	assert.equal(capture.consoleLog.localAutomatedTestRunNotProvided, true);
	for (const item of capture.cases) {
		const expected = (item.studio.physicalBoundingBoxXYXY[2] - item.studio.physicalBoundingBoxXYXY[0]) *
			capture.rootLogicalSize[0] / capture.sourceImages[1].rootPixelRect.width;
		assert.ok(Math.abs(expected - item.studio.logicalInkWidth) < 0.001);
		assert.ok(Math.abs(item.widthDifferencePercent) <= 3, item.id);
	}
	assert.ok(capture.findings.tallBook72TopOffsetDifference > 10);
	assert.ok(capture.findings.tallBook72StudioBottomInset < 2);
});
