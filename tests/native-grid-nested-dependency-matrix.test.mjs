import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ProbeAllocatedParentRelativeGrid,
	ProbeAllocatedParentSingleAxisGrid } from "../.geometry-engine-test-build/SnapshotForTests.js";
import { AnalyzeVanillaGeometry } from "../scripts/Analyze-NativeLayoutGeometry.mjs";
import { CheckSourceRoundTrip } from "../scripts/Preflight-NativeAcceptanceCorpus.mjs";

const s_Source = readFileSync(new URL(
	"./fixtures/workbench-grid/NIH_Grid_Nested_Dependency_Matrix.layout", import.meta.url), "utf8");
const s_Groups = ["HeightOuter", "WidthOuter", "BothOuter"];
const s_Nodes = new LayoutParser().Parse(s_Source).roots;

function Flatten(nodes, result = []) {
	for (const node of nodes) {
		result.push(node);
		Flatten(node.children, result);
	}
	return result;
}

function Property(node, key) {
	return node.properties.find(property => property.name.toLowerCase() === key.toLowerCase())?.value;
}

function FlattenMeasured(nodes, result = []) {
	for (const node of nodes) {
		result.push(node);
		FlattenMeasured(node.children, result);
	}
	return result;
}

test("Phase 3L captures 6 native nested dependency controls with 2-tier and 3-tier chains", () => {
	const nodes = Flatten(s_Nodes);
	assert.equal(s_Nodes.length, 1);
	assert.equal(nodes.length, 64);
	assert.equal(nodes.filter(node => node.type === "FrameWidgetClass").length, 7);
	assert.equal(nodes.filter(node => node.type === "GridSpacerWidgetClass").length, 15);
	assert.equal(nodes.filter(node => node.type === "TextWidgetClass").length, 6);
	assert.equal(nodes.filter(node => node.type === "PanelWidgetClass").length, 36);
	assert.equal(nodes.filter(node => node.type === "PanelWidgetClass"
		&& Property(node, "style") === "rover_sim_colorable").length, 36);
	for (const group of s_Groups) {
		for (const key of [group, group + "WidthLeaf"]) {
			assert.ok(nodes.some(node => node.name === "Outer" + key));
			assert.ok(nodes.some(node => node.name === "Inner" + key));
			assert.ok(nodes.some(node => node.name === "Label" + key));
			assert.ok(nodes.some(node => node.name === "Background" + key));
			assert.equal(nodes.some(node => node.name === "Leaf" + key),
				key.endsWith("WidthLeaf"));
		}
	}
});

test("Phase 3L holds parent fractions constant while crossing outer content axis and chain depth", () => {
	const nodes = new Map(Flatten(s_Nodes).map(node => [node.name, node]));
	for (const group of s_Groups) {
		for (const suffix of ["", "WidthLeaf"]) {
			const key = group + suffix;
			const outer = nodes.get("Outer" + key);
			const inner = nodes.get("Inner" + key);
			assert.equal(Property(outer, "size"), "0.7 0.72");
			assert.equal(Property(inner, "size"), "0.65 0.55");
			assert.equal(Property(outer, "hexactsize"), "0");
			assert.equal(Property(outer, "vexactsize"), "0");
			assert.equal(Property(inner, "hexactsize"), "0");
			assert.equal(Property(inner, "vexactsize"), "0");
			assert.equal(Property(inner, "Size To Content H"), "1");
			assert.equal(Property(inner, "Size To Content V"), "1");
			assert.equal(Property(outer, "Size To Content H"), group === "HeightOuter" ? "0" : "1");
			assert.equal(Property(outer, "Size To Content V"), group === "WidthOuter" ? "0" : "1");
			if (suffix) {
				const leaf = nodes.get("Leaf" + key);
				assert.equal(Property(leaf, "Size To Content H"), "1");
				assert.equal(Property(leaf, "Size To Content V"), "0");
				assert.equal(Property(leaf, "hexactsize"), "0");
				assert.equal(Property(leaf, "vexactsize"), "0");
			}
		}
	}
});

test("Phase 3L existing probes do not silently arrange nested content-sized children", () => {
	const measured = MeasureLayoutTree(s_Nodes);
	const nodes = new Map(FlattenMeasured(measured.roots).map(item => [item.node.name, item]));
	assert.equal(nodes.size, 64);
	for (const group of s_Groups) {
		for (const suffix of ["", "WidthLeaf"]) {
			const key = group + suffix;
			const outer = nodes.get("Outer" + key);
			assert.ok(outer);
			assert.equal(ProbeAllocatedParentRelativeGrid(outer, 570, 465), null);
			assert.equal(ProbeAllocatedParentSingleAxisGrid(outer, 570, 465), null);
			if (suffix) {
				const inner = nodes.get("Inner" + key);
				assert.equal(ProbeAllocatedParentRelativeGrid(inner, 400, 330), null);
			}
		}
	}
	const report = AnalyzeVanillaGeometry(s_Source);
	assert.equal(report.gridEligibility.totalGridSpacers, 15);
	assert.equal(report.singleAxisSnapshotAppliedStrategies.filter(item =>
		item.name.startsWith("Outer")).length, 0);
	assert.equal(report.singleAxisSnapshotAppliedStrategies.filter(item =>
		item.name.startsWith("Inner") && item.name.endsWith("WidthLeaf")).length, 0);
	assert.match(report.warning, /not independently measured Workbench geometry/);
});

test("Phase 3L native fixture source-roundtrips without adding widget IDs", () => {
	const result = CheckSourceRoundTrip(s_Source);
	assert.equal(result.status, "SOURCE_ROUNDTRIP_PASS");
	assert.equal(result.widgets, 64);
	assert.equal(result.idless, 0);
	assert.equal(result.nativeWorkbenchLoadValidated, false);
});
