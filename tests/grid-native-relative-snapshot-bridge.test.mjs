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
const observed = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/grid-complex-phase2l-native.json", import.meta.url), "utf8"
)).native;
const root = new LayoutParser().Parse(source).roots[0];
const measured = MeasureLayoutTree([root]);
const options = { constrainedGrid: true, gridRelativeContentPrototype: true };
const rect = ({ x, y, width, height }) => [x, y, width, height];

function ExpectRect(actual, expected, label) {
	assert.ok(actual, label + " missing arranged rectangle");
	const got = rect(actual);
	for (let i = 0; i < 4; ++i)
		assert.ok(Math.abs(got[i] - expected[i]) <= 0.00001,
			`${label} axis ${i}: expected ${expected[i]}, got ${got[i]}`);
}

function CheckGrid(snapshot, grid, native, expectedOrigin) {
	const outer = snapshot.byId.get(grid.id);
	const [width, height] = native[0];
	ExpectRect(outer?.absoluteRect, [...expectedOrigin, width, height], grid.name);
	assert.ok(snapshot.appliedStrategies.some(strategy =>
		strategy.id === grid.id && strategy.mode === "grid-relative-content-prototype"
	), grid.name + " must be explicitly arranged");
	assert.ok(!snapshot.issues.some(issue => issue.id === grid.id
		&& (issue.code === "unresolved-layout-strategy" || issue.code === "unresolved-size-to-content")),
		grid.name + " must not report unresolved sizing or layout");
	const observedChildren = native[1];
	assert.equal(grid.children.length, observedChildren.length, grid.name);
	let comparedChildren = 0;
	for (let i = 0; i < grid.children.length; ++i) {
		const child = grid.children[i];
		const expected = observedChildren[i];
		const actual = snapshot.byId.get(child.id);
		assert.ok(actual, child.name + " missing from snapshot");
		if (expected === null) {
			assert.equal(actual.visible, false, child.name + " remains hidden");
			assert.equal(snapshot.appliedStrategies.filter(s => s.id === child.id).length, 0);
			continue; // Native-excluded children have no managed slot.
		}
		const [x, y, w, h, visible] = expected;
		ExpectRect(actual.absoluteRect, [expectedOrigin[0] + x, expectedOrigin[1] + y, w, h], child.name);
		assert.equal(actual.visible, Boolean(visible), child.name + " visibility");
		++comparedChildren;
	}
	return comparedChildren;
}

test("Phase 2M explicit opt-in matches all 21 grid rectangles and 86 participating native child slots", () => {
	for (const viewport of [
		{ x: 0, y: 0, width: 1920, height: 1080 },
		{ x: 0, y: 0, width: 1120, height: 720 }
	]) {
		const snapshot = ArrangeMeasuredGeometry(measured, viewport, 1, options);
		let parents = 0;
		let children = 0;
		for (const grid of root.children) {
			const expected = observed[grid.name];
			assert.ok(expected, grid.name + " missing independently captured native fixture");
			children += CheckGrid(snapshot, grid, expected, manifest.cases.find(c => c.name === grid.name).position);
			++parents;
			if (grid.name === "LNested") {
				const nested = grid.children[0];
				const [px, py] = manifest.cases.find(c => c.name === grid.name).position;
				const [localX, localY] = expected[1][0];
				children += CheckGrid(snapshot, nested, observed.LNestedChild0, [px + localX, py + localY]);
				++parents;
			}
		}
		assert.equal(parents, 21);
		assert.equal(children, 86);
		assert.equal(snapshot.appliedStrategies.filter(s => s.mode === "grid-relative-content-prototype").length, 21);
	}
});

test("Phase 2M disabled by default: old content and fixed-cell prototypes remain unchanged", () => {
	const viewport = { x: 0, y: 0, width: 1920, height: 1080 };
	const baseline = ArrangeMeasuredGeometry(measured, viewport);
	const existing = ArrangeMeasuredGeometry(measured, viewport, 1, {
		constrainedGrid: true, gridContentArrangement: true
	});
	const newFlagWithoutGrid = ArrangeMeasuredGeometry(measured, viewport, 1, {
		gridRelativeContentPrototype: true
	});
	assert.deepEqual(newFlagWithoutGrid.entries, baseline.entries);
	assert.deepEqual(newFlagWithoutGrid.appliedStrategies, baseline.appliedStrategies);
	assert.equal(baseline.appliedStrategies.length, 0);
	assert.equal(existing.appliedStrategies.filter(s => s.mode === "grid-relative-content-prototype").length, 0);
	assert.equal(existing.byId.get(root.children[0].id).absoluteRect.width, 240,
		"Phase 2L remains unsupported in existing guarded mode");
	assert.equal(newFlagWithoutGrid.issues.length, baseline.issues.length);
});

test("Phase 2M unknown relative child dependency fails closed without changing authored content", () => {
	const sample = root.children.find(node => node.name === "LNested");
	const bad = structuredClone(sample);
	bad.children[0].type = "WrapSpacerWidgetClass";
	const mutated = structuredClone(root);
	const index = mutated.children.findIndex(node => node.name === sample.name);
	mutated.children[index] = bad;
	const snapshot = ArrangeMeasuredGeometry(MeasureLayoutTree([mutated]), {
		x: 0, y: 0, width: 1920, height: 1080
	}, 1, options);
	assert.equal(snapshot.appliedStrategies.some(s => s.id === bad.id), false);
	assert.equal(snapshot.issues.some(issue => issue.id === bad.id
		&& issue.code === "unresolved-layout-strategy"), true);
});
