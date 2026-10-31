import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";

const source = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Grid_Complex_Matrix.layout", import.meta.url), "utf8"
);
const manifest = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/grid-complex-phase2l-cases.json", import.meta.url), "utf8"
));
const root = new LayoutParser().Parse(source).roots[0];

function Property(node, name) {
	return node.properties.find(property => property.name.toLowerCase() === name.toLowerCase())?.value;
}

function AssertNode(node, expected, path) {
	assert.ok(node, `${path}: missing`);
	assert.equal(node.type, expected.type ?? "PanelWidgetClass", path);
	assert.equal(Property(node, "size"), expected.size.join(" "), `${path} size`);
	assert.equal(Property(node, "hexactsize"), expected.exact[0] ? "1" : "0", `${path} exact H`);
	assert.equal(Property(node, "vexactsize"), expected.exact[1] ? "1" : "0", `${path} exact V`);
	assert.equal(Property(node, "visible") === "0", expected.visible === false, `${path} visibility`);
	if (expected.children) {
		assert.equal(Number(Property(node, "Columns")), expected.columns, `${path} columns`);
		assert.equal(Number(Property(node, "Rows")), expected.rows, `${path} rows`);
		assert.equal(Property(node, "Size To Content H") === "1", expected.contentH === true, `${path} content H`);
		assert.equal(Property(node, "Size To Content V") === "1", expected.contentV === true, `${path} content V`);
		assert.equal(Property(node, "Ignore invisible") === "0", expected.ignoreInvisible === false, `${path} ignored hidden`);
		assert.equal(node.children.length, expected.children.length, `${path} child count`);
		for (let i = 0; i < expected.children.length; ++i)
			AssertNode(node.children[i], expected.children[i], `${path}Child${i}`);
	} else {
		assert.equal(node.children.length, 0, `${path} unexpected children`);
	}
}

test("Phase 2L contains twenty independent native generalization cases", () => {
	assert.equal(root.type, "FrameWidgetClass");
	assert.equal(manifest.cases.length, 20);
	assert.equal(root.children.length, manifest.cases.length);
	assert.equal(new Set(manifest.cases.map(sample => sample.name)).size, 20);
	assert.deepEqual(manifest.capturePhases, [
		"complex-after-create", "complex-post-update", "complex-after-resize-1120x720"
	]);
	for (let i = 0; i < manifest.cases.length; ++i) {
		const grid = root.children[i];
		const sample = manifest.cases[i];
		assert.equal(grid.name, sample.name);
		assert.equal(Property(grid, "position"), sample.position.join(" "), sample.name);
		assert.equal(Property(grid, "hexactpos"), "1", sample.name);
		assert.equal(Property(grid, "vexactpos"), "1", sample.name);
		AssertNode(grid, { ...sample, type: "GridSpacerWidgetClass", exact: [true, true] }, sample.name);
		assert.equal(Number(Property(grid, "Padding")), sample.padding, sample.name);
		assert.equal(Number(Property(grid, "Margin")), sample.margin, sample.name);
	}
});

test("Phase 2L exercises multi-relative, sparse, over-capacity and invisible cases", () => {
	const countRelative = grid => grid.children.filter(child =>
		Property(child, "hexactsize") === "0" || Property(child, "vexactsize") === "0"
	).length;
	assert.ok(countRelative(root.children.find(node => node.name === "LSameRow")) >= 2);
	assert.ok(countRelative(root.children.find(node => node.name === "LSameColumn")) >= 2);
	const sparse = root.children.find(node => node.name === "LThreeSparse");
	assert.ok(sparse.children.length < 9);
	for (const name of ["LTwoOverflow", "LThreeOverflow"]) {
		const grid = root.children.find(node => node.name === name);
		const capacity = Number(Property(grid, "Columns")) * Number(Property(grid, "Rows"));
		assert.ok(grid.children.length > capacity, name);
	}
	assert.equal(Property(root.children.find(node => node.name === "LHiddenInclude"), "Ignore invisible"), "0");
	assert.equal(root.children.find(node => node.name === "LNested").children[0].type, "GridSpacerWidgetClass");
});

test("Phase 2L remains diagnostics-only until native capture establishes new rules", () => {
	const measured = MeasureLayoutTree([root]);
	const viewport = { x: 0, y: 0, width: 1920, height: 1080 };
	const baseline = ArrangeMeasuredGeometry(measured, viewport);
	const diagnostic = ArrangeMeasuredGeometry(measured, viewport, 1, {
		constrainedGrid: true,
		gridContentArrangement: true,
		gridNativeMeasurementDiagnostics: true
	});
	assert.deepEqual(diagnostic.entries, baseline.entries);
	assert.equal(diagnostic.appliedStrategies.length, 0);
	assert.equal(diagnostic.gridNativeMeasurementPrototypes.size, 0);
	for (const grid of root.children) {
		assert.equal(diagnostic.gridNativeMeasurementPrototypes.has(grid.id), false, grid.name);
		assert.equal(diagnostic.appliedStrategies.some(strategy => strategy.id === grid.id), false, grid.name);
	}
});
