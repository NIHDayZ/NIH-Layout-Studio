import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import {
	MeasureLayoutTree,
	ArrangeMeasuredGeometry,
	ProbeAllocatedParentRelativeGrid
} from "../.geometry-engine-test-build/SnapshotForTests.js";

const s_Source = readFileSync(new URL(
	"./fixtures/workbench-grid/NIH_Grid_RelativeParent_Axis_Matrix.layout", import.meta.url), "utf8");
const s_Native = JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-grid/grid-relative-parent-phase3h-native-pixels.json", import.meta.url), "utf8"));
const s_Root = { x: 0, y: 0, width: 1920, height: 1080 };
const s_Nodes = new LayoutParser().Parse(s_Source).roots;
const s_Measured = MeasureLayoutTree(s_Nodes);
const s_LegacyOptions = { constrainedGrid: true, gridRelativeContentPrototype: true };
const s_ExperimentalOptions = {
	...s_LegacyOptions,
	gridAllocatedParentRelativePrototype: true
};

function FindSourceNode(name, nodes = s_Nodes) {
	for (const node of nodes) {
		if (node.name === name)
			return node;
		const found = FindSourceNode(name, node.children);
		if (found)
			return found;
	}
	return null;
}

function AbsolutePixelLocal(rect, bg, zoom) {
	return {
		x: (rect.x - bg.x) * zoom,
		y: (rect.y - bg.y) * zoom,
		width: rect.width * zoom,
		height: rect.height * zoom
	};
}

function NativePixelLocal(box, background) {
	return {
		x: box[0] - background[0],
		y: box[1] - background[1],
		width: box[2] - box[0],
		height: box[3] - box[1]
	};
}

test("Phase 3I experimental allocated-parent Grid changes only six newly supported relative-sized cases", () => {
	const legacy = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_LegacyOptions);
	const candidate = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_ExperimentalOptions);
	const defaultSnapshot = ArrangeMeasuredGeometry(s_Measured, s_Root);
	assert.equal(defaultSnapshot.appliedStrategies.length, 0);
	assert.equal(legacy.appliedStrategies.length, 2);
	assert.equal(candidate.appliedStrategies.length, 8);
	assert.equal(candidate.appliedStrategies.filter(item =>
		item.mode === "grid-allocated-parent-relative-prototype").length, 6);
	assert.equal(candidate.appliedStrategies.filter(item =>
		item.mode === "grid-relative-content-prototype").length, 2);
	for (const item of s_Native.nativeCases) {
		const id = FindSourceNode(item.name)?.id;
		assert.ok(id);
		const oldRect = legacy.byId.get(id).localRect;
		const newRect = candidate.byId.get(id).localRect;
		if (item.axis === "ExactBoth")
			assert.deepEqual(newRect, oldRect);
		else
			assert.ok(Math.abs(newRect.width - oldRect.width) > 1);
	}
});

test("Phase 3I experimental screenshot-space rectangles agree with 24 measured Workbench swatches", () => {
	const snapshot = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_ExperimentalOptions);
	let totalError = 0;
	let maxError = 0;
	let sampleCount = 0;
	for (const item of s_Native.nativeCases) {
		const backgroundName = "Background" + item.group + item.axis;
		const backgroundId = FindSourceNode(backgroundName)?.id;
		const background = snapshot.byId.get(backgroundId)?.absoluteRect;
		assert.ok(background, "missing background " + backgroundName);
		for (const color of ["Blue", "Orange", "Green"]) {
			const childName = item.group + item.axis + color;
			const childId = FindSourceNode(childName)?.id;
			const rendered = snapshot.byId.get(childId)?.absoluteRect;
			assert.ok(rendered, "missing " + childName);
			const expected = NativePixelLocal(item.swatches[color], item.backgroundRect);
			const proposed = AbsolutePixelLocal(rendered, background, s_Native.nativeZoom);
			for (const axis of ["x", "y", "width", "height"]) {
				const error = Math.abs(expected[axis] - proposed[axis]);
				totalError += error;
				maxError = Math.max(maxError, error);
				++sampleCount;
			}
		}
	}
	assert.equal(sampleCount, 96);
	assert.ok(maxError < 2, "maximum measured native rectangle coordinate error");
	assert.ok(totalError / sampleCount < 1, "mean measured native rectangle coordinate error");
});

test("Phase 3I direct probe rejects unknown parent allocation and does not mutate the source", () => {
	const measuredGrid = s_Measured.roots[0].children
		.find(item => item.node.name === "SlotDirectRelativeBoth").children
		.find(item => item.node.name === "GridDirectRelativeBoth");
	assert.ok(measuredGrid);
	const sourceBefore = s_Source;
	assert.equal(ProbeAllocatedParentRelativeGrid(measuredGrid, 0, 450), null);
	assert.equal(ProbeAllocatedParentRelativeGrid(measuredGrid, NaN, 450), null);
	assert.equal(ProbeAllocatedParentRelativeGrid(measuredGrid, 420, Infinity), null);
	assert.equal(ProbeAllocatedParentRelativeGrid(measuredGrid, 420, -3), null);
	const valid = ProbeAllocatedParentRelativeGrid(measuredGrid, 420, 450);
	assert.ok(valid);
	assert.equal(valid.allocatedParentRelative, true);
	assert.equal(valid.plan.rects.length, 3);
	assert.equal(s_Source, sourceBefore);
});

test("Phase 3I never applies experimental relative-grid without BOTH legacy gates", () => {
	const baseline = ArrangeMeasuredGeometry(s_Measured, s_Root);
	const partials = [
		{ gridAllocatedParentRelativePrototype: true },
		{ constrainedGrid: true, gridAllocatedParentRelativePrototype: true },
		{ gridRelativeContentPrototype: true, gridAllocatedParentRelativePrototype: true }
	];
	for (const options of partials) {
		const report = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, options);
		assert.equal(report.appliedStrategies.filter(item =>
			item.mode === "grid-allocated-parent-relative-prototype").length, 0);
		assert.deepEqual(report.entries.map(item => item.localRect),
			baseline.entries.map(item => item.localRect));
	}
});

test("Phase 3I nested managed children remain unsupported, with no guessed child allocation", () => {
	const source = [
		"FrameWidgetClass Root {",
		"\tsize 1920 1080",
		"\thexactsize 1",
		"\tvexactsize 1",
		"\t{",
		"\t\tGridSpacerWidgetClass RelativeGrid {",
		"\t\t\tsize 0.5 0.5",
		"\t\t\thexactsize 0",
		"\t\t\tvexactsize 0",
		'\t\t\t"Columns" 2',
		'\t\t\t"Rows" 2',
		'\t\t\t"Size To Content H" 1',
		'\t\t\t"Size To Content V" 1',
		"\t\t\t{",
		"\t\t\t\tGridSpacerWidgetClass NestedGrid {",
		"\t\t\t\t\tsize 0.4 0.4",
		'\t\t\t\t\t"Size To Content H" 1',
		'\t\t\t\t\t"Size To Content V" 1',
		"\t\t\t\t}",
		"\t\t\t}",
		"\t\t}",
		"\t}",
		"}"
	].join("\n");
	const doc = new LayoutParser().Parse(source);
	const measured = MeasureLayoutTree(doc.roots);
	const parent = measured.roots[0].children[0];
	assert.equal(ProbeAllocatedParentRelativeGrid(parent, 1920, 1080), null);
	const snapshot = ArrangeMeasuredGeometry(measured, s_Root, 1, s_ExperimentalOptions);
	assert.ok(!snapshot.appliedStrategies.some(item =>
		item.mode === "grid-allocated-parent-relative-prototype"));
});

test("Phase 3I preview stays behind three explicit URL gates and does not alter normal Canvas", () => {
	const canvas = readFileSync(new URL("../src/components/Canvas.tsx", import.meta.url), "utf8");
	assert.ok(canvas.includes('get("experimentalGeometrySnapshot") === "1"'));
	assert.ok(canvas.includes('get("experimentalGridRelativeContent") === "1"'));
	assert.ok(canvas.includes('get("experimentalAllocatedParentRelativeGrid") === "1"'));
	assert.ok(canvas.includes("const allocatedParentGridPreviewEnabled = relativeGridPreviewEnabled &&"));
	assert.ok(canvas.includes("gridAllocatedParentRelativePrototype: allocatedParentGridPreviewEnabled,"));
	assert.ok(canvas.includes("[snapshotEnabled, relativeGridPreviewEnabled, allocatedParentGridPreviewEnabled, allocatedSingleAxisGridPreviewEnabled, nodes, width, height]"));
});
