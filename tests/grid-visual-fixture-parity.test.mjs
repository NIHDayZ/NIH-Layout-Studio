import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";

const fixture = name => readFileSync(new URL("./fixtures/workbench-grid/" + name, import.meta.url), "utf8");
const parser = new LayoutParser();
const baseline = parser.Parse(fixture("NIH_Grid_Complex_Matrix.layout")).roots[0];
const visual = parser.Parse(fixture("NIH_Grid_Complex_Visual.layout")).roots[0];

function GeometryOnly(node) {
	return {
		name: node.name,
		type: node.type,
		properties: node.properties.filter(property =>
			!["color", "style"].includes(property.name.toLowerCase())),
		children: node.children.map(GeometryOnly)
	};
}

function Visit(node, callback) {
	callback(node);
	for (const child of node.children)
		Visit(child, callback);
}

function NormalizeRect(rect) {
	return [rect.x, rect.y, rect.width, rect.height];
}

test("Phase 2P visual fixture changes only leaf PanelWidget material and tint", () => {
	assert.deepEqual(GeometryOnly(visual), GeometryOnly(baseline));
	let panels = 0;
	let grids = 0;
	Visit(visual, node => {
		if (node.type === "GridSpacerWidgetClass") {
			++grids;
			assert.equal(node.properties.some(property => property.name.toLowerCase() === "style"), false);
			assert.equal(node.properties.some(property => property.name.toLowerCase() === "color"), false);
		}
		if (node.type !== "PanelWidgetClass")
			return;
		++panels;
		assert.equal(node.children.length, 0, node.name + " must remain a leaf");
		const style = node.properties.filter(p => p.name.toLowerCase() === "style");
		const color = node.properties.filter(p => p.name.toLowerCase() === "color");
		assert.deepEqual(style.map(p => p.value), ["rover_sim_colorable"], node.name);
		assert.equal(color.length, 1, node.name + " exactly one tint");
		const channels = color[0].value.split(/\s+/).map(Number);
		assert.equal(channels.length, 4, node.name);
		assert.ok(channels.every(v => Number.isFinite(v) && v >= 0 && v <= 1), node.name);
		assert.equal(channels[3], 0.94, node.name);
	});
	assert.equal(grids, 21);
	assert.equal(panels, 86);
});

test("Phase 2P visual tint is a pure presentation change in shared opt-in geometry at both native root sizes", () => {
	const basePrepared = MeasureLayoutTree([baseline]);
	const styledPrepared = MeasureLayoutTree([visual]);
	for (const viewport of [
		{ x: 0, y: 0, width: 1920, height: 1080 },
		{ x: 0, y: 0, width: 1120, height: 720 }
	]) {
		const options = { constrainedGrid: true, gridRelativeContentPrototype: true };
		const base = ArrangeMeasuredGeometry(basePrepared, viewport, 1, options);
		const styled = ArrangeMeasuredGeometry(styledPrepared, viewport, 1, options);
		assert.equal(styled.entries.length, base.entries.length);
		for (let i = 0; i < base.entries.length; ++i) {
			const first = base.entries[i];
			const second = styled.entries[i];
			assert.deepEqual(NormalizeRect(second.absoluteRect), NormalizeRect(first.absoluteRect),
				"absolute rect at preorder index " + i);
			assert.deepEqual(NormalizeRect(second.localRect), NormalizeRect(first.localRect),
				"local rect at preorder index " + i);
			assert.equal(second.visible, first.visible, "visibility at index " + i);
		}
		assert.equal(styled.appliedStrategies.length, base.appliedStrategies.length);
		assert.equal(styled.appliedStrategies.filter(s => s.mode === "grid-relative-content-prototype").length, 21);
	}
});
