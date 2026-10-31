import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";

const source = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Panel_Color_Alpha_Calibration.layout", import.meta.url), "utf8"
);
const root = new LayoutParser().Parse(source).roots[0];

test("Phase 2Q alpha-calibration fixture has 30 isolated colorable panels and exactly six alpha levels", () => {
	assert.equal(root.name, "NIHColorableAlphaCalibration");
	assert.equal(root.children.length, 30);
	assert.equal(root.children.some(child => child.children.length !== 0), false);
	const alphaCounts = new Map();
	const palette = new Map();
	for (const child of root.children) {
		assert.equal(child.type, "PanelWidgetClass");
		const properties = new Map(child.properties.map(p => [p.name.toLowerCase(), p.value]));
		assert.equal(properties.get("style"), "rover_sim_colorable", child.name);
		assert.equal(properties.get("hexactpos"), "1", child.name);
		assert.equal(properties.get("vexactpos"), "1", child.name);
		assert.equal(properties.get("hexactsize"), "1", child.name);
		assert.equal(properties.get("vexactsize"), "1", child.name);
		assert.equal(properties.get("size"), "124 78", child.name);
		const channels = properties.get("color").trim().split(/\s+/).map(Number);
		assert.equal(channels.length, 4, child.name);
		assert.ok(channels.every(v => Number.isFinite(v) && v >= 0 && v <= 1), child.name);
		const alpha = channels[3];
		alphaCounts.set(alpha, (alphaCounts.get(alpha) ?? 0) + 1);
		const rgb = channels.slice(0, 3).join(" ");
		palette.set(rgb, (palette.get(rgb) ?? 0) + 1);
	}
	assert.deepEqual([...alphaCounts.entries()].sort((a, b) => a[0] - b[0]),
		[[0, 5], [0.25, 5], [0.5, 5], [0.75, 5], [0.94, 5], [1, 5]]);
	assert.equal(palette.size, 5);
	assert.ok([...palette.values()].every(count => count === 6));
});

test("Phase 2Q color calibration remains a conventional unmanaged layout at two native root sizes", () => {
	const measured = MeasureLayoutTree([root]);
	for (const viewport of [
		{ x: 0, y: 0, width: 1920, height: 1080 },
		{ x: 0, y: 0, width: 1120, height: 720 }
	]) {
		const base = ArrangeMeasuredGeometry(measured, viewport);
		const experiment = ArrangeMeasuredGeometry(measured, viewport, 1, {
			constrainedGrid: true,
			gridRelativeContentPrototype: true
		});
		assert.equal(base.entries.length, 31);
		assert.deepEqual(experiment.entries, base.entries);
		assert.equal(experiment.appliedStrategies.length, 0);
	}
});
