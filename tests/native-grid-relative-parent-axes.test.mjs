import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { AnalyzeVanillaGeometry } from "../scripts/Analyze-NativeLayoutGeometry.mjs";

const s_Source = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Grid_RelativeParent_Axis_Matrix.layout", import.meta.url),
	"utf8"
);
const s_ExpectedCases = ["ExactBoth", "RelativeWidth", "RelativeHeight", "RelativeBoth"];

function Walk(nodes, sink = []) {
	for (const node of nodes) {
		sink.push(node);
		Walk(node.children, sink);
	}
	return sink;
}

function Property(node, key) {
	return node.properties.find(item => item.name.toLowerCase() === key.toLowerCase())?.value;
}

test("Phase 3H includes exactly eight controlled GridSpacer cases and visible colorable swatches", () => {
	const parsed = new LayoutParser().Parse(s_Source);
	assert.equal(parsed.roots.length, 1);
	assert.equal(parsed.roots[0].type, "FrameWidgetClass");
	const all = Walk(parsed.roots);
	const grids = all.filter(item => item.type === "GridSpacerWidgetClass");
	assert.equal(grids.length, 8);
	assert.equal(all.filter(item => item.type === "PanelWidgetClass").length, 32);
	assert.equal(all.filter(item => item.type === "TextWidgetClass").length, 8);
	assert.equal(all.filter(item => item.type === "FrameWidgetClass").length, 13);
	assert.equal(new Set(grids.map(item => item.name)).size, 8);
	for (const grid of grids) {
		assert.equal(Property(grid, "Size To Content H"), "1");
		assert.equal(Property(grid, "Size To Content V"), "1");
		assert.equal(Property(grid, "Columns"), "2");
		assert.equal(Property(grid, "Rows"), "2");
		assert.equal(grid.children.length, 3);
		for (const child of grid.children) {
			assert.equal(child.type, "PanelWidgetClass");
			assert.equal(Property(child, "style"), "rover_sim_colorable");
			assert.ok(Property(child, "color"));
		}
	}
});

test("Phase 3H exact and relative authored parent axes resolve to equivalent initial dimensions", () => {
	const all = Walk(new LayoutParser().Parse(s_Source).roots);
	const byName = new Map(all.map(node => [node.name, node]));
	for (const group of ["Direct", "Nested"]) {
		const parentWidth = group === "Direct" ? 420 : 300;
		const parentHeight = group === "Direct" ? 450 : 240;
		const expectedWidth = group === "Direct" ? 240 : 180;
		const expectedHeight = group === "Direct" ? 135 : 96;
		for (let i = 0; i < s_ExpectedCases.length; ++i) {
			const suffix = s_ExpectedCases[i];
			const grid = byName.get("Grid" + group + suffix);
			assert.ok(grid);
			const widths = Property(grid, "size").split(/\s+/).map(Number);
			const exactX = Number(Property(grid, "hexactsize"));
			const exactY = Number(Property(grid, "vexactsize"));
			assert.equal(exactX, i === 0 || i === 2 ? 1 : 0);
			assert.equal(exactY, i < 2 ? 1 : 0);
			const resolvedWidth = exactX ? widths[0] : widths[0] * parentWidth;
			const resolvedHeight = exactY ? widths[1] : widths[1] * parentHeight;
			assert.ok(Math.abs(resolvedWidth - expectedWidth) < 0.001);
			assert.ok(Math.abs(resolvedHeight - expectedHeight) < 0.001);
		}
	}
});

test("Phase 3H rejects unmeasured relative Grid parents without changing the experimental snapshot", () => {
	const report = AnalyzeVanillaGeometry(s_Source);
	assert.equal(report.phase, "3F");
	assert.equal(report.gridEligibility.totalGridSpacers, 8);
	assert.equal(report.gridEligibility.exactParentSizeCount, 2);
	assert.equal(report.gridEligibility.relativeReasonCounts["parent-size-not-exact"], 6);
	assert.equal(report.gridEligibility.childTopologyReasonCounts["no-obvious-child-topology-blocker"], 8);
	assert.equal(report.gridEligibility.contentSizingModeCounts["both-axes"], 8);
	assert.equal(report.gridEligibility.items.filter(item => item.probeReturnedPlan).length, 2);
	const actual = report.gridEligibility.items.filter(item => item.appliedMode !== null);
	assert.equal(actual.length, 2);
	assert.ok(actual.every(item => item.name.endsWith("ExactBoth")));
	assert.match(report.warning, /not independently measured Workbench geometry/);
});
