import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";

const s_Native = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/grid-nested-phase3l-workbench-pixels.json", import.meta.url), "utf8"));
const s_Source = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Grid_Nested_Dependency_Matrix.layout", import.meta.url), "utf8");
const s_Slots = new Map();
const s_GridNames = ["HeightOuter", "WidthOuter", "BothOuter"];

function Walk(nodes) {
	for (const node of nodes) {
		s_Slots.set(node.name, node);
		Walk(node.children);
	}
}
Walk(new LayoutParser().Parse(s_Source).roots);

function Property(node, key) {
	return node.properties.find(prop => prop.name.toLowerCase() === key.toLowerCase())?.value;
}

function Local(box, background) {
	if (box === null)
		return null;
	return {
		x: box[0] - background[0],
		y: box[1] - background[1],
		width: box[2] - box[0],
		height: box[3] - box[1]
	};
}

test("Phase 3L native screenshot preserves 27 measured rectangles and three unmeasurable orange regions", () => {
	assert.equal(s_Native.kind, "INDEPENDENT_NATIVE_WORKBENCH_NESTED_GRID_VISIBLE_PIXEL_RECTS");
	assert.deepEqual(s_Native.imageSize, [1919, 1032]);
	assert.deepEqual(s_Native.root, [1920, 1080]);
	assert.equal(s_Native.zoom, 0.46);
	assert.equal(s_Native.cases.length, 6);
	let n = 0;
	for (const [i, item] of s_Native.cases.entries()) {
		assert.ok(s_Slots.has("Outer" + item.name));
		assert.ok(s_Slots.has("Inner" + item.name));
		assert.equal(s_Slots.has("Leaf" + item.name), i >= 3);
		for (const [color, rect] of Object.entries(item.visibleRects)) {
			if (rect === null) {
				assert.equal(color, "Orange");
				assert.ok(i >= 3);
				assert.equal(item.orangeObservation, "not-separately-visible-in-captured-exact-RGB");
				continue;
			}
			++n;
			const loc = Local(rect, item.backgroundRect);
			assert.ok(loc.x >= 0 && loc.y >= 0);
			assert.ok(loc.width > 0 && loc.height > 0);
		}
	}
	assert.equal(n, 27);
	assert.ok(s_Native.nativeLimits.some(note =>
		note.includes("NOT GetSize/GetScreenSize of invisible GridSpacer")));
});

test("Phase 3L native outer marker verifies equal-column/row expansion on the non-content axis", () => {
	const zoom = s_Native.zoom;
	for (const item of s_Native.cases) {
		const outer = s_Slots.get("Outer" + item.name);
		const slot = s_Slots.get("Slot" + item.name);
		const dims = Property(slot, "size").split(/\s+/).map(Number);
		const size = Property(outer, "size").split(/\s+/).map(Number);
		const width = dims[0] * size[0];
		const height = dims[1] * size[1];
		const margin = Number(Property(outer, "Margin"));
		const padding = Number(Property(outer, "Padding"));
		const marker = Local(item.visibleRects.OuterMarker, item.backgroundRect);
		const widthContent = Property(outer, "Size To Content H") === "1";
		const heightContent = Property(outer, "Size To Content V") === "1";
		const expectedMarkerWidth = (widthContent ? 32 :
			(width - 2 * margin - padding) / 2) * zoom;
		const expectedMarkerHeight = (heightContent ? 32 :
			(height - 2 * margin - padding) / 2) * zoom;
		assert.ok(Math.abs(marker.width - expectedMarkerWidth) <= 1,
			item.name + ": marker width mismatch");
		assert.ok(Math.abs(marker.height - expectedMarkerHeight) <= 1,
			item.name + ": marker height mismatch");
	}
});

test("Phase 3L nested leaf changes native child geometry while outer marker axes remain consistent", () => {
	for (let i = 0; i < 3; ++i) {
		const parent = s_Native.cases[i];
		const deeper = s_Native.cases[i + 3];
		const topMarker = Local(parent.visibleRects.OuterMarker, parent.backgroundRect);
		const lowerMarker = Local(deeper.visibleRects.OuterMarker, deeper.backgroundRect);
		for (const axis of ["width", "height"])
			assert.ok(Math.abs(topMarker[axis] - lowerMarker[axis]) <= 1);
		const topBlue = Local(parent.visibleRects.Blue, parent.backgroundRect);
		const lowerBlue = Local(deeper.visibleRects.Blue, deeper.backgroundRect);
		assert.ok(lowerBlue.x - topBlue.x >= 2 && lowerBlue.x - topBlue.x <= 5);
		const topGreen = Local(parent.visibleRects.Green, parent.backgroundRect);
		const lowerGreen = Local(deeper.visibleRects.Green, deeper.backgroundRect);
		assert.ok(topGreen.height - lowerGreen.height >= 9);
		assert.equal(deeper.visibleRects.Orange, null);
	}
});

test("Phase 3L disposable client native runtime logs exact nested parent bounds without relying on IDs", () => {
	const script = readFileSync(new URL(
		"./fixtures/workbench-grid/runtime-mod/NIH_GridMeasurementRuntime.c", import.meta.url), "utf8");
	assert.match(script, /m_NestedDependencyRoot/);
	assert.match(script, /StartNestedDependencies/);
	assert.match(script, /NIH_Grid_Nested_Dependency_Matrix\.layout/);
	assert.match(script, /CaptureNestedDependencies\("after-create"\)/);
	assert.match(script, /CaptureNestedDependencies\("post-update"\)/);
	assert.match(script, /CaptureNestedDependencies\("post-settle"\)/);
	assert.match(script, /CaptureNestedDependencies\("after-resize-1120x720"\)/);
	assert.match(script, /m_NestedDependencyRoot\.Update\(\)/);
	assert.match(script, /widget\.GetPos\(localX, localY\)/);
	assert.match(script, /widget\.GetSize\(localWidth, localHeight\)/);
	assert.match(script, /widget\.GetScreenSize\(screenWidth, screenHeight\)/);
	assert.match(script, /widget\.GetName\(\)/);
	assert.ok(!script.includes("widget.GetID()"));
	assert.match(script, /if \(g_Game\.IsDedicatedServer\(\)\)/);
});
