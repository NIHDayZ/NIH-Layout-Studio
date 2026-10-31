import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";

const canvas = readFileSync(new URL("../src/components/Canvas.tsx", import.meta.url), "utf8");
const source = readFileSync(new URL("./fixtures/workbench-grid/NIH_Grid_Complex_Matrix.layout", import.meta.url), "utf8");
const root = new LayoutParser().Parse(source).roots[0];
const measured = MeasureLayoutTree([root]);
const viewport = { x: 0, y: 0, width: 1920, height: 1080 };

test("Phase 2O preview requires both shared snapshot and explicit relative-grid URL gate", () => {
	assert.ok(canvas.includes('get("experimentalGeometrySnapshot") === "1"'));
	assert.ok(canvas.includes('get("experimentalGridRelativeContent") === "1"'));
	assert.ok(canvas.includes("const relativeGridPreviewEnabled = snapshotEnabled &&"));
	assert.ok(canvas.includes("constrainedGrid: relativeGridPreviewEnabled,"));
	assert.ok(canvas.includes("gridRelativeContentPrototype: relativeGridPreviewEnabled,"));
	assert.ok(canvas.includes("[snapshotEnabled, relativeGridPreviewEnabled, nodes, width, height]"));
	assert.ok(canvas.includes("geometryById?.get(node.id)?.localRect ?? forcedRect ?? ResolveRect(node, parent)"));
});

test("Phase 2O toggle is an arrangement opt-in, not a new rendering algorithm", () => {
	const baseline = ArrangeMeasuredGeometry(measured, viewport);
	const preview = ArrangeMeasuredGeometry(measured, viewport, 1, {
		constrainedGrid: true,
		gridRelativeContentPrototype: true
	});
	const container = root.children.find(node => node.name === "LSameRow");
	assert.ok(container);
	assert.equal(baseline.byId.get(container.id).absoluteRect.width, 240);
	assert.equal(preview.byId.get(container.id).absoluteRect.width, 198);
	assert.equal(baseline.appliedStrategies.length, 0);
	assert.ok(preview.appliedStrategies.some(s =>
		s.id === container.id && s.mode === "grid-relative-content-prototype"));
});
