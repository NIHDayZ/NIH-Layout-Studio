import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { AnalyzeVanillaGeometry } from "../scripts/Analyze-NativeLayoutGeometry.mjs";
import { CheckSourceRoundTrip } from "../scripts/Preflight-NativeAcceptanceCorpus.mjs";

const s_Source = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Grid_SingleAxis_Content_Matrix.layout", import.meta.url),
	"utf8"
);
const s_Modes = ["WidthOnly", "HeightOnly"];
const s_Axes = ["ExactBoth", "RelativeWidth", "RelativeHeight", "RelativeBoth"];

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

test("Phase 3K provides eight independent native single-axis GridSpacer cases with visible swatches", () => {
	const parsed = new LayoutParser().Parse(s_Source);
	assert.equal(parsed.roots.length, 1);
	assert.equal(parsed.roots[0].name, "NIHSingleAxisContentMatrix");
	const nodes = Walk(parsed.roots);
	assert.equal(nodes.filter(node => node.type === "FrameWidgetClass").length, 9);
	assert.equal(nodes.filter(node => node.type === "GridSpacerWidgetClass").length, 8);
	assert.equal(nodes.filter(node => node.type === "PanelWidgetClass").length, 32);
	assert.equal(nodes.filter(node => node.type === "TextWidgetClass").length, 8);
	for (const mode of s_Modes) {
		for (const axis of s_Axes) {
			const grid = nodes.find(node => node.name === "Grid" + mode + axis);
			assert.ok(grid, "missing " + mode + "/" + axis);
			assert.equal(Property(grid, "Columns"), "2");
			assert.equal(Property(grid, "Rows"), "2");
			assert.equal(Property(grid, "Padding"), "12");
			assert.equal(Property(grid, "Margin"), "8");
			assert.equal(Property(grid, "Ignore invisible"), "1");
			assert.equal(Property(grid, "Size To Content H"), mode === "WidthOnly" ? "1" : "0");
			assert.equal(Property(grid, "Size To Content V"), mode === "HeightOnly" ? "1" : "0");
			assert.equal(grid.children.length, 3);
			for (const panel of grid.children) {
				assert.equal(panel.type, "PanelWidgetClass");
				assert.equal(Property(panel, "style"), "rover_sim_colorable");
				assert.ok(Property(panel, "color"));
			}
		}
	}
});

test("Phase 3K compares equal initial Grid sizes across exact/relative flags", () => {
	const nodes = Walk(new LayoutParser().Parse(s_Source).roots);
	const byName = new Map(nodes.map(node => [node.name, node]));
	for (const mode of s_Modes) {
		for (let index = 0; index < s_Axes.length; ++index) {
			const axis = s_Axes[index];
			const grid = byName.get("Grid" + mode + axis);
			const sizes = Property(grid, "size").split(/\s+/).map(Number);
			const exactX = Number(Property(grid, "hexactsize"));
			const exactY = Number(Property(grid, "vexactsize"));
			assert.equal(exactX, index === 0 || index === 2 ? 1 : 0);
			assert.equal(exactY, index < 2 ? 1 : 0);
			const initialW = exactX ? sizes[0] : sizes[0] * 420;
			const initialH = exactY ? sizes[1] : sizes[1] * 450;
			assert.ok(Math.abs(initialW - 240) < 0.001);
			assert.ok(Math.abs(initialH - 135) < 0.001);
		}
	}
});

test("Phase 3K keeps unmeasured relative single-axis grids gated in existing experimental preview", () => {
	const report = AnalyzeVanillaGeometry(s_Source);
	assert.equal(report.gridEligibility.totalGridSpacers, 8);
	assert.deepEqual(report.gridEligibility.contentSizingModeCounts, {
		"width-only": 4, "height-only": 4
	});
	assert.equal(report.gridEligibility.exactParentSizeCount, 2);
	assert.equal(report.relativeSnapshotAppliedStrategies.length, 2);
	assert.equal(report.allocatedSnapshotAppliedStrategies.length, 2);
	assert.equal(report.gridEligibility.allocatedReasonCounts["existing-exact-grid-applied"], 2);
	assert.equal(report.gridEligibility.allocatedReasonCounts["single-axis-content-unsupported"], 6);
	assert.equal(report.allocatedVsRelative.totalChanged, 0);
	assert.ok(!report.allocatedSnapshotAppliedStrategies.some(item =>
		item.mode === "grid-allocated-parent-relative-prototype"));
});

test("Phase 3K native fixture survives source-level parser and serializer round-trip", () => {
	const result = CheckSourceRoundTrip(s_Source);
	assert.equal(result.status, "SOURCE_ROUNDTRIP_PASS");
	assert.equal(result.semanticStructureEqual, true);
	assert.equal(result.serializationIdempotent, true);
	assert.equal(result.widgets, 57);
	assert.equal(result.idless, 0);
	assert.equal(result.nativeWorkbenchLoadValidated, false);
});
