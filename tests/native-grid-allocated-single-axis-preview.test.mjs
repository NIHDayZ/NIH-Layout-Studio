import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry,
	ProbeAllocatedParentSingleAxisGrid } from "../.geometry-engine-test-build/SnapshotForTests.js";

const s_Source = readFileSync(new URL(
	"./fixtures/workbench-grid/NIH_Grid_SingleAxis_Content_Matrix.layout", import.meta.url), "utf8");
const s_Native = JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-grid/grid-single-axis-phase3k-native-pixels.json", import.meta.url), "utf8"));
const s_Nodes = new LayoutParser().Parse(s_Source).roots;
const s_Measured = MeasureLayoutTree(s_Nodes);
const s_Root = { x: 0, y: 0, width: 1920, height: 1080 };
const s_Previous = { constrainedGrid: true, gridRelativeContentPrototype: true,
	gridAllocatedParentRelativePrototype: true };
const s_SingleAxis = { ...s_Previous, gridAllocatedParentSingleAxisPrototype: true };

function Find(name, nodes = s_Nodes) {
	for (const node of nodes) {
		if (node.name === name)
			return node;
		const descendant = Find(name, node.children);
		if (descendant)
			return descendant;
	}
	return null;
}

function LocalScreenRect(rect, background) {
	return {
		x: (rect.x - background.x) * s_Native.zoom,
		y: (rect.y - background.y) * s_Native.zoom,
		width: rect.width * s_Native.zoom,
		height: rect.height * s_Native.zoom
	};
}

function NativeLocalRect(rect, background) {
	return {
		x: rect[0] - background[0], y: rect[1] - background[1],
		width: rect[2] - rect[0], height: rect[3] - rect[1]
	};
}

test("Phase 3K single-axis strategy activates six new relative parents only under the fourth option", () => {
	const previous = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_Previous);
	const candidate = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_SingleAxis);
	assert.equal(previous.appliedStrategies.length, 2);
	assert.equal(candidate.appliedStrategies.length, 8);
	assert.equal(candidate.appliedStrategies.filter(item =>
		item.mode === "grid-allocated-parent-single-axis-prototype").length, 6);
	assert.equal(candidate.appliedStrategies.filter(item =>
		item.mode === "grid-relative-content-prototype").length, 2);
	for (const caseInfo of s_Native.cases) {
		const id = Find(caseInfo.name)?.id;
		assert.ok(id);
		if (caseInfo.parentAxisMode === "ExactBoth")
			assert.deepEqual(candidate.byId.get(id).localRect, previous.byId.get(id).localRect);
		else
			assert.notDeepEqual(candidate.byId.get(id).localRect, previous.byId.get(id).localRect);
	}
});

test("Phase 3K preview predicts all 24 native single-axis swatch rectangles to screenshot-pixel tolerance", () => {
	const snapshot = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_SingleAxis);
	let errorSum = 0;
	let maxError = 0;
	let n = 0;
	for (const caseInfo of s_Native.cases) {
		const backgroundId = Find(caseInfo.name.replace(/^Grid/, "Background"))?.id;
		const bg = snapshot.byId.get(backgroundId)?.absoluteRect;
		assert.ok(bg, "missing background " + caseInfo.name);
		for (const color of ["Blue", "Orange", "Green"]) {
			const childName = caseInfo.name.replace(/^Grid/, "") + color;
			const childId = Find(childName)?.id;
			const actual = snapshot.byId.get(childId)?.absoluteRect;
			assert.ok(actual, "missing child " + childName);
			const observed = NativeLocalRect(caseInfo.swatches[color], caseInfo.backgroundRect);
			const predicted = LocalScreenRect(actual, bg);
			for (const axis of ["x", "y", "width", "height"]) {
				const delta = Math.abs(observed[axis] - predicted[axis]);
				errorSum += delta;
				maxError = Math.max(maxError, delta);
				++n;
			}
		}
	}
	assert.equal(n, 96);
	assert.ok(errorSum / n < 1, "native mean-coordinate error must remain under 1 screenshot px");
	assert.ok(maxError < 2, "native maximum-coordinate error must remain under 2 screenshot px");
});

test("Phase 3K bridge rejects missing or invalid parent allocations and both-axis inputs", () => {
	const grids = s_Measured.roots[0].children
		.map(item => item.children.find(child => child.strategy.kind === "grid"))
		.filter(Boolean);
	const relativeWidthOnly = grids.find(item => item.node.name === "GridWidthOnlyRelativeBoth");
	const relativeBothAxis = grids.find(item => item.node.name === "GridWidthOnlyExactBoth");
	assert.ok(relativeWidthOnly && relativeBothAxis);
	assert.equal(ProbeAllocatedParentSingleAxisGrid(relativeWidthOnly, 0, 450), null);
	assert.equal(ProbeAllocatedParentSingleAxisGrid(relativeWidthOnly, Infinity, 450), null);
	assert.equal(ProbeAllocatedParentSingleAxisGrid(relativeWidthOnly, 420, NaN), null);
	const accepted = ProbeAllocatedParentSingleAxisGrid(relativeWidthOnly, 420, 450);
	assert.ok(accepted);
	assert.equal(accepted.allocatedParentSingleAxis, true);
	assert.equal(accepted.plan.rects.length, 3);
	assert.equal(ProbeAllocatedParentSingleAxisGrid(relativeBothAxis, 420, 450), null,
		"exact-axis parents remain owned by the original bridge");
});

test("Phase 3K single-axis strategy requires all previous gates and its own option", () => {
	for (const options of [
		{},
		{ gridAllocatedParentSingleAxisPrototype: true },
		{ constrainedGrid: true, gridAllocatedParentSingleAxisPrototype: true },
		{ constrainedGrid: true, gridRelativeContentPrototype: true,
			gridAllocatedParentSingleAxisPrototype: true },
		s_Previous
	]) {
		const snapshot = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, options);
		assert.equal(snapshot.appliedStrategies.filter(item =>
			item.mode === "grid-allocated-parent-single-axis-prototype").length, 0);
	}
});

test("Phase 3K fourth browser flag remains chained to earlier experimental gates", () => {
	const canvas = readFileSync(new URL("../src/components/Canvas.tsx", import.meta.url), "utf8");
	assert.ok(canvas.includes('get("experimentalAllocatedParentSingleAxisGrid") === "1"'));
	assert.ok(canvas.includes("const allocatedSingleAxisGridPreviewEnabled = allocatedParentGridPreviewEnabled &&"));
	assert.ok(canvas.includes("gridAllocatedParentSingleAxisPrototype: allocatedSingleAxisGridPreviewEnabled,"));
	assert.ok(canvas.includes("allocatedSingleAxisGridPreviewEnabled, nestedGridPreviewEnabled, nodes, width, height]"));
});
