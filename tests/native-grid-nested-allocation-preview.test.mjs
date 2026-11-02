import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { AnalyzeVanillaGeometry, FormatVanillaGeometry } from "../scripts/Analyze-NativeLayoutGeometry.mjs";
import {
	MeasureLayoutTree, ArrangeMeasuredGeometry, ProbeNestedAllocatedGrid
} from "../.geometry-engine-test-build/SnapshotForTests.js";

const s_Source = readFileSync(new URL(
	"./fixtures/workbench-grid/NIH_Grid_Nested_Dependency_Matrix.layout", import.meta.url), "utf8");
const s_Native = JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-grid/grid-nested-phase3m-runtime-screen-rects.json", import.meta.url), "utf8"));
const s_Workbench = JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-grid/grid-nested-phase3l-workbench-pixels.json", import.meta.url), "utf8"));
const s_Nodes = new LayoutParser().Parse(s_Source).roots;
const s_Measured = MeasureLayoutTree(s_Nodes);
const s_Root = { x: 0, y: 0, width: 1920, height: 1080 };
const s_FourFlags = {
	constrainedGrid: true,
	gridRelativeContentPrototype: true,
	gridAllocatedParentRelativePrototype: true,
	gridAllocatedParentSingleAxisPrototype: true
};
const s_FiveFlags = { ...s_FourFlags, gridNestedAllocationPrototype: true };

function Flatten(nodes, result = []) {
	for (const node of nodes) {
		result.push(node);
		Flatten(node.children, result);
	}
	return result;
}

const s_All = Flatten(s_Measured.roots);
const s_ByName = new Map(s_All.map(node => [node.node.name, node]));

function Rectangle(snapshot, name) {
	const node = s_ByName.get(name);
	assert.ok(node, "missing measured node " + name);
	const rect = snapshot.byId.get(node.node.id)?.absoluteRect;
	assert.ok(rect, "missing arranged node " + name);
	return [rect.x, rect.y, rect.width, rect.height];
}

function EqualRect(actual, expected, label, tolerance = 0.025) {
	assert.equal(actual.length, 4);
	for (let i = 0; i < 4; ++i)
		assert.ok(Math.abs(actual[i] - expected[i]) <= tolerance,
			label + " axis " + i + ": predicted " + actual[i] + ", native " + expected[i]);
}

test("Phase 3M native runtime freezes 6 controls and 2 stable screen resolutions", () => {
	assert.equal(s_Native.kind, "INDEPENDENT_DAYZ_CLIENT_NESTED_POST_UPDATE_SCREEN_RECTS");
	assert.deepEqual(s_Native.root, [1920, 1080]);
	assert.deepEqual(s_Native.otherRoot, [1440, 810]);
	assert.equal(s_Native.cases.length, 6);
	assert.equal(s_Native.cases.reduce((n, item) => n + Object.keys(item.rects).length, 0), 45);
	assert.equal(s_Native.nativeCrossResolution.length, 11);
});

test("Phase 3M recursive provisional-cell probe measures all six native parent chains", () => {
	for (const item of s_Native.cases) {
		const outer = s_ByName.get("Outer" + item.name);
		assert.ok(outer);
		const resolved = ProbeNestedAllocatedGrid(outer, 570, 465);
		assert.ok(resolved, "probe rejected " + item.name);
		assert.equal(resolved.plans.size, item.name.endsWith("WidthLeaf") ? 3 : 2);
		assert.equal(resolved.root.nestedAllocatedGrid, true);
		for (const prefix of ["Outer", "Inner", "Leaf"]) {
			const observed = item.rects[prefix];
			if (!observed)
				continue;
			const plan = resolved.plans.get(s_ByName.get(prefix + item.name));
			assert.ok(plan, "missing recursive plan " + prefix + item.name);
			assert.ok(Math.abs(plan.plan.width - observed[2]) < 0.025);
			assert.ok(Math.abs(plan.plan.height - observed[3]) < 0.025);
		}
	}
});

test("Phase 3M arranged preview matches all 45 native runtime widget rectangles at 1920x1080", () => {
	const snapshot = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_FiveFlags);
	let n = 0;
	for (const item of s_Native.cases) {
		for (const [suffix, nativeRect] of Object.entries(item.rects)) {
			const name = suffix === "Outer" || suffix === "Inner" || suffix === "Leaf"
				? suffix + item.name : suffix === "InnerMarker" || suffix === "OuterMarker"
					? suffix + item.name : item.name + suffix;
			EqualRect(Rectangle(snapshot, name), nativeRect, name);
			++n;
		}
	}
	assert.equal(n, 45);
	assert.equal(snapshot.appliedStrategies.filter(item =>
		item.mode === "grid-nested-allocation-prototype").length, 15);
});

test("Phase 3M previous four-flag and default geometry remain unchanged when opt-in is absent", () => {
	const before = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_FourFlags);
	const absent = ArrangeMeasuredGeometry(s_Measured, s_Root, 1,
		{ ...s_FourFlags, gridNestedAllocationPrototype: false });
	assert.deepEqual(absent.entries, before.entries);
	assert.deepEqual(absent.appliedStrategies, before.appliedStrategies);
	assert.ok(!before.appliedStrategies.some(item =>
		item.mode === "grid-nested-allocation-prototype"));
	for (const item of s_Native.cases)
		assert.notDeepEqual(Rectangle(before, "Outer" + item.name),
			Rectangle(ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_FiveFlags),
				"Outer" + item.name));
});

test("Phase 3M rejects invalid allocation and unmeasured managed siblings", () => {
	const original = s_ByName.get("OuterHeightOuter");
	assert.ok(original);
	for (const width of [0, -1, NaN, Infinity])
		assert.equal(ProbeNestedAllocatedGrid(original, width, 465), null);
	assert.equal(ProbeNestedAllocatedGrid(original, 570, NaN), null);
	const marker = original.children[1];
	assert.ok(marker);
	const altered = {
		...original,
		children: [original.children[0], {
			...marker,
			authored: { ...marker.authored, exactSizeX: false }
		}]
	};
	assert.equal(ProbeNestedAllocatedGrid(altered, 570, 465), null);
	assert.equal(ProbeNestedAllocatedGrid(s_ByName.get("InnerHeightOuter"), 190.5, 161.04), null,
		"standalone inner grid is not a nested parent");
	for (const options of [
		{ constrainedGrid: true, gridRelativeContentPrototype: true,
			gridNestedAllocationPrototype: true },
		{ ...s_FourFlags, gridAllocatedParentSingleAxisPrototype: false,
			gridNestedAllocationPrototype: true }
	]) {
		const snapshot = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, options);
		assert.equal(snapshot.appliedStrategies.filter(item =>
			item.mode === "grid-nested-allocation-prototype").length, 0);
	}
});

test("Phase 3M native 1440 capture tracks independent 0.75 screen-scale across inner and leaf cases", () => {
	const snapshot = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_FiveFlags);
	for (const sample of s_Native.nativeCrossResolution) {
		const predicted = Rectangle(snapshot, sample.name).map(value => value * 0.75);
		EqualRect(predicted, sample.screen1440, sample.name + " 1440x810", 0.025);
	}
});

test("Phase 3M independent Workbench screenshot corroborates native runtime visible swatch geometry", () => {
	const snapshot = ArrangeMeasuredGeometry(s_Measured, s_Root, 1, s_FiveFlags);
	let compared = 0;
	for (const item of s_Workbench.cases) {
		const bg = Rectangle(snapshot, "Background" + item.name);
		for (const [suffix, bounds] of Object.entries(item.visibleRects)) {
			if (!bounds)
				continue;
			const native = Rectangle(snapshot, (suffix === "InnerMarker" || suffix === "OuterMarker")
				? suffix + item.name : item.name + suffix);
			const local = [
				(native[0] - bg[0]) * s_Workbench.zoom,
				(native[1] - bg[1]) * s_Workbench.zoom,
				native[2] * s_Workbench.zoom,
				native[3] * s_Workbench.zoom
			];
			const visible = [
				bounds[0] - item.backgroundRect[0],
				bounds[1] - item.backgroundRect[1],
				bounds[2] - bounds[0],
				bounds[3] - bounds[1]
			];
			EqualRect(local, visible, item.name + suffix + " Workbench", 1.55);
			++compared;
		}
	}
	assert.equal(compared, 27);
});

test("Phase 3M browser preview requires all four previous gates and a fifth URL option", () => {
	const canvas = readFileSync(new URL("../src/components/Canvas.tsx", import.meta.url), "utf8");
	assert.ok(canvas.includes('get("experimentalNestedGridAllocation") === "1"'));
	assert.ok(canvas.includes("nestedGridPreviewEnabled = allocatedSingleAxisGridPreviewEnabled &&"));
	assert.ok(canvas.includes("gridNestedAllocationPrototype: nestedGridPreviewEnabled,"));
	assert.ok(canvas.includes("nestedGridPreviewEnabled, nodes, width, height]"));
});

test("Phase 3M audit reports actual nested-strategy activation separately from four-flag results", () => {
	const report = AnalyzeVanillaGeometry(s_Source, { focusPattern: /OuterHeightOuter/, maxFocused: 4 });
	assert.equal(report.gridEligibility.totalGridSpacers, 15);
	assert.equal(report.nestedSnapshotAppliedStrategies.filter(item =>
		item.mode === "grid-nested-allocation-prototype").length, 15);
	assert.ok(report.nestedVsSingleAxis.totalChanged > 0);
	assert.equal(report.nestedVsSingleAxis.totalChanged,
		report.nestedVsSingleAxis.localRectChanged +
		report.nestedVsSingleAxis.inheritedOnly);
	assert.ok(report.focused.some(item => item.nestedLocal));
	assert.match(FormatVanillaGeometry(report), /Five-flag nested strategies applied: 15/);
	assert.match(report.warning, /not independently measured Workbench geometry/);
});
