import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	ProjectNativeScrollChildContext,
	MeasureNativeScrollNormalizedPosition
} from "../.geometry-engine-test-build/ScrollOffset.js";

const capture = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-scroll/capture.runtime.2026-10-28.json", import.meta.url),
	"utf8"
));
const template = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-scroll/capture.template.json", import.meta.url),
	"utf8"
));

const phases = ["initial", "half", "end", "reset"];
const authoredChildren = [
	{ name: "origin", localX: 0, localY: 0, width: 170, height: 48 },
	{ name: "overhang", localX: 185, localY: 150, width: 110, height: 70 }
];

test("real DayZ client getter capture is separately provenance-tagged and never promoted to a native viewport golden", () => {
	assert.equal(capture.schemaVersion, 1);
	assert.equal(capture.captureKind, "native-dayz-client-script-getters");
	assert.equal(capture.date, "2026-10-28");
	assert.equal(capture.provenance.clientScriptLog, "script_2026-10-28_11-56-52.log");
	assert.equal(capture.provenance.runtimeBuild, "not captured by probe");
	assert.equal(capture.missingObservations.nativeScrollbarScaleBranchAndContext, null);
	assert.equal(capture.missingObservations.nativeChildViewportRect, null);
	assert.equal(capture.missingObservations.nativeChildContextRect, null);
	assert.equal(capture.missingObservations.nativeClipRect, null);
	assert.equal(capture.missingObservations.userWheelOrDragInput, null);
	assert.deepEqual(capture.cases.map(item => item.id),
		["ScrollNone", "ScrollVertical", "ScrollBoth", "ScrollLeft"]);
	for (const item of template.cases) {
		assert.equal(item.nativeScale, null, "GetScrollbarWidth does not prove the native scale branch");
		assert.equal(item.observed, null, "screen rectangles are not viewport/context telemetry");
	}
});

test("actual runtime getter samples show the native content extent and scrollbar width in all four cases", () => {
	for (const item of capture.cases) {
		assert.deepEqual(item.contentSize, [295, 220]);
		assert.equal(item.scrollbarWidth, 10);
		assert.deepEqual(item.childSizes, { origin: [170, 48], overhang: [110, 70] });
		assert.deepEqual(item.outerScreenRect.slice(2), [240, 180]);
		assert.equal(item.isScrollbarVisible, item.settings.horizontal || item.settings.vertical);
		assert.deepEqual(item.samples.map(sample => sample.phase), phases);
		// Known authored child geometry yields maximum right and bottom extents.
		assert.equal(Math.max(170, 185 + 110), item.contentSize[0]);
		assert.equal(Math.max(48, 150 + 70), item.contentSize[1]);
	}
});

test("native getter ranges and normalized positions match the recovered common arithmetic", () => {
	const expectedFullOffsets = new Map([
		["ScrollNone", [0, 0]],
		["ScrollVertical", [0, 40]],
		["ScrollBoth", [65, 50]],
		["ScrollLeft", [65, 50]]
	]);
	for (const item of capture.cases) {
		const [,, width, height] = item.outerScreenRect;
		const [contentWidth, contentHeight] = item.contentSize;
		for (const sample of item.samples) {
			const measured = MeasureNativeScrollNormalizedPosition({
				contentWidth, contentHeight,
				widgetWidth: width, widgetHeight: height,
				verticalScrollbar: item.settings.vertical,
				horizontalScrollbar: item.settings.horizontal,
				scrollbarThickness: item.scrollbarWidth,
				offsets: sample.offsets
			});
			assert.ok(measured, item.id + "/" + sample.phase);
			assert.equal(measured.horizontal, sample.normalized.horizontal);
			assert.equal(measured.vertical, sample.normalized.vertical);
			if (item.settings.horizontal)
				assert.equal(measured.horizontalRange, 65);
			if (item.settings.vertical)
				assert.equal(measured.verticalRange, item.settings.horizontal ? 50 : 40);
		}
		const full = item.samples.find(sample => sample.phase === "end");
		const half = item.samples.find(sample => sample.phase === "half");
		const reset = item.samples.find(sample => sample.phase === "reset");
		assert.deepEqual([full.offsets.horizontal, full.offsets.vertical], expectedFullOffsets.get(item.id));
		assert.equal(half.offsets.horizontal, full.offsets.horizontal / 2);
		assert.equal(half.offsets.vertical, full.offsets.vertical / 2);
		assert.deepEqual(reset.offsets, { horizontal: 0, vertical: 0 });
	}
});

test("the shared scroll origin projection matches independently observed child screen motion", () => {
	for (const item of capture.cases) {
		const [outerX, outerY, width, height] = item.outerScreenRect;
		const thickness = item.scrollbarWidth;
		// Candidate based on the effective *observed* getter width and authored
		// bar flags, not a claimed native scaling branch or observed clip region.
		const effectiveCandidate = {
			x: item.settings.vertical && item.settings.verticalLeft ? thickness : 0,
			y: 0,
			width: width - (item.settings.vertical ? thickness : 0),
			height: height - (item.settings.horizontal ? thickness : 0)
		};
		for (const sample of item.samples) {
			const projected = ProjectNativeScrollChildContext(effectiveCandidate, sample.offsets);
			assert.ok(projected, item.id + "/" + sample.phase);
			for (const child of authoredChildren) {
				const recorded = sample[child.name + "ScreenPos"];
				assert.deepEqual(recorded, [
					outerX + projected.childContext.x + child.localX,
					outerY + projected.childContext.y + child.localY
				], item.id + "/" + sample.phase + "/" + child.name);
			}
		}
	}
});

test("left vertical scrollbar shifts children right by native getter thickness without altering scroll ranges", () => {
	const left = capture.cases.find(item => item.id === "ScrollLeft");
	const both = capture.cases.find(item => item.id === "ScrollBoth");
	assert.equal(left.settings.verticalLeft, true);
	assert.equal(both.settings.verticalLeft, false);
	for (let i = 0; i < phases.length; ++i) {
		const l = left.samples[i];
		const b = both.samples[i];
		assert.deepEqual(l.offsets, b.offsets);
		assert.deepEqual(l.normalized, b.normalized);
		assert.equal(l.originScreenPos[0] - left.outerScreenRect[0],
			b.originScreenPos[0] - both.outerScreenRect[0] + left.scrollbarWidth);
	}
});
