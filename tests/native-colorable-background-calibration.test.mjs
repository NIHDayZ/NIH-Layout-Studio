import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";

const raw = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Panel_Background_Calibration.layout", import.meta.url), "utf8"
);
const root = new LayoutParser().Parse(raw).roots[0];

function Properties(node) {
	return new Map(node.properties.map(p => [p.name.toLowerCase(), p.value]));
}

test("Phase 2R backdrop experiment has two exact 100%-opaque parents and 60 comparable colorable children", () => {
	assert.equal(root.name, "NIHColorableBackgroundCalibration");
	assert.equal(root.children.length, 2);
	const backgrounds = [
		{ name: "Dark", position: "36 36", color: "0.10 0.10 0.10 1" },
		{ name: "Light", position: "898 36", color: "0.80 0.80 0.80 1" }
	];
	const alphaLevels = [1, 0.94, 0.75, 0.5, 0.25, 0];
	let total = 0;
	const geometrySignatures = [];
	for (let parentIndex = 0; parentIndex < backgrounds.length; ++parentIndex) {
		const parent = root.children[parentIndex];
		const expected = backgrounds[parentIndex];
		const properties = Properties(parent);
		assert.equal(parent.name, "QBackdrop" + expected.name);
		assert.equal(parent.type, "PanelWidgetClass");
		assert.equal(properties.get("position"), expected.position);
		assert.equal(properties.get("size"), "800 670");
		assert.equal(properties.get("color"), expected.color);
		assert.equal(properties.get("style"), "rover_sim_colorable");
		assert.equal(parent.children.length, 30);
		const signatures = [];
		for (let i = 0; i < 30; ++i) {
			const child = parent.children[i];
			const attrs = Properties(child);
			const row = Math.floor(i / 5);
			const column = i % 5;
			assert.equal(child.type, "PanelWidgetClass");
			assert.equal(child.children.length, 0);
			assert.equal(attrs.get("style"), "rover_sim_colorable");
			assert.equal(attrs.get("size"), "124 78");
			assert.equal(attrs.get("position"), `${22 + column * 150} ${27 + row * 101}`);
			for (const key of ["hexactpos", "vexactpos", "hexactsize", "vexactsize"])
				assert.equal(attrs.get(key), "1");
			const channels = attrs.get("color").split(/\s+/).map(Number);
			assert.equal(channels.length, 4);
			assert.ok(channels.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
			assert.equal(channels[3], alphaLevels[row]);
			signatures.push([attrs.get("position"), attrs.get("size"), attrs.get("color"), attrs.get("style")]);
			++total;
		}
		geometrySignatures.push(signatures);
	}
	assert.equal(total, 60);
	assert.deepEqual(geometrySignatures[0], geometrySignatures[1],
		"alpha/color and child geometry must be identical across backgrounds");
});

test("Phase 2R passive panel nesting does not activate managed geometry heuristics", () => {
	const measured = MeasureLayoutTree([root]);
	for (const viewport of [
		{ x: 0, y: 0, width: 1920, height: 1080 },
		{ x: 0, y: 0, width: 1120, height: 720 }
	]) {
		const baseline = ArrangeMeasuredGeometry(measured, viewport);
		const guarded = ArrangeMeasuredGeometry(measured, viewport, 1, {
			constrainedGrid: true,
			gridRelativeContentPrototype: true
		});
		assert.equal(baseline.entries.length, 63);
		assert.deepEqual(guarded.entries, baseline.entries);
		assert.equal(guarded.appliedStrategies.length, 0);
	}
});
