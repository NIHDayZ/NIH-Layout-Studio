import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { PlanNativeRelativeGrid } from "../.geometry-engine-test-build/GridRelativeContent.js";

const s_Fixture = readFileSync(new URL(
	"./fixtures/workbench-grid/NIH_Grid_RelativeParent_Axis_Matrix.layout", import.meta.url), "utf8");
const s_Evidence = JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-grid/grid-relative-parent-phase3h-native-pixels.json", import.meta.url), "utf8"));
const s_Zoom = s_Evidence.nativeZoom;
const s_ColorNames = ["Blue", "Orange", "Green"];
const s_SourceNodes = new Map();

function Visit(nodes) {
	for (const node of nodes) {
		s_SourceNodes.set(node.name, node);
		Visit(node.children);
	}
}
Visit(new LayoutParser().Parse(s_Fixture).roots);

function Property(node, name) {
	return node.properties.find(item => item.name.toLowerCase() === name.toLowerCase())?.value;
}

function Pair(node, name) {
	return Property(node, name).trim().split(/\s+/).map(Number);
}

function LocalRect(box, bg) {
	return {
		x: box[0] - bg[0], y: box[1] - bg[1],
		width: box[2] - box[0], height: box[3] - box[1]
	};
}

/**
 * Independent, OFFLINE prediction: resolve authored fractional GridSpacer
 * dimensions against the already known, exact parent frame, then reuse the
 * previously native-validated pure cell planner. This does NOT change the
 * production bridge or native eligibility flags.
 */
function PredictCase(group) {
	const grid = s_SourceNodes.get(group.name);
	assert.ok(grid, "missing source GridSpacer " + group.name);
	const parentId = group.name.replace(/^Grid/, "");
	const parent = s_SourceNodes.get(group.group === "Direct"
		? "Slot" + parentId : "Parent" + parentId);
	assert.ok(parent);
	const parentSize = Pair(parent, "size");
	const originalSize = Pair(grid, "size");
	const exactX = Property(grid, "hexactsize") === "1";
	const exactY = Property(grid, "vexactsize") === "1";
	const width = exactX ? originalSize[0] : originalSize[0] * parentSize[0];
	const height = exactY ? originalSize[1] : originalSize[1] * parentSize[1];
	const children = grid.children.map(child => ({
		width: Pair(child, "size")[0],
		height: Pair(child, "size")[1],
		exactWidth: Property(child, "hexactsize") === "1",
		exactHeight: Property(child, "vexactsize") === "1"
	}));
	const plan = PlanNativeRelativeGrid({
		columns: Number(Property(grid, "Columns")),
		rows: Number(Property(grid, "Rows")),
		margin: Number(Property(grid, "Margin")),
		padding: Number(Property(grid, "Padding")),
		authoredWidth: width, authoredHeight: height,
		contentWidth: Property(grid, "Size To Content H") === "1",
		contentHeight: Property(grid, "Size To Content V") === "1",
		children
	});
	assert.ok(plan);
	const position = Pair(grid, "position");
	if (group.group === "Nested") {
		const outer = Pair(parent, "position");
		position[0] += outer[0];
		position[1] += outer[1];
	}
	return {
		gridWidth: width, gridHeight: height,
		plan,
		rects: plan.rects.map(rect => ({
			x: (position[0] + rect.x) * s_Zoom,
			y: (position[1] + rect.y) * s_Zoom,
			width: rect.width * s_Zoom,
			height: rect.height * s_Zoom
		}))
	};
}

test("Phase 3H Workbench swatch evidence captures all eight axes/nesting variants, not inferred shader bounds", () => {
	assert.equal(s_Evidence.kind, "MEASURED_WORKBENCH_NATIVE_AND_STUDIO_SWATCH_RECTANGLES");
	assert.equal(s_Evidence.nativeScreenshotSize[0], 1919);
	assert.equal(s_Evidence.nativeCases.length, 8);
	assert.equal(s_Evidence.studioCases.length, 8);
	assert.equal(s_Evidence.nativeZoom, 0.46);
	assert.equal(s_SourceNodes.size > 40, true);
	assert.deepEqual(s_Evidence.nativeCases.map(group => group.axis),
		["ExactBoth", "RelativeWidth", "RelativeHeight", "RelativeBoth",
		 "ExactBoth", "RelativeWidth", "RelativeHeight", "RelativeBoth"]);
	for (const group of s_Evidence.nativeCases) {
		assert.ok(s_SourceNodes.has(group.name));
		for (const name of s_ColorNames) {
			const rect = LocalRect(group.swatches[name], group.backgroundRect);
			assert.ok(rect.width > 0 && rect.height > 0);
			assert.ok(rect.x >= 0 && rect.y >= 0);
		}
	}
	assert.ok(s_Evidence.interpretationLimits.some(line =>
		line.includes("do not infer final invisible GridSpacer bounds")));
});

test("Phase 3H Workbench local swatch placements are invariant across exact/relative parent flags", () => {
	for (const groupName of ["Direct", "Nested"]) {
		const cases = s_Evidence.nativeCases.filter(item => item.group === groupName);
		const original = cases[0];
		for (const item of cases.slice(1)) {
			for (const name of s_ColorNames) {
				const base = LocalRect(original.swatches[name], original.backgroundRect);
				const next = LocalRect(item.swatches[name], item.backgroundRect);
				for (const axis of ["x", "y", "width", "height"])
					assert.ok(Math.abs(next[axis] - base[axis]) <= 1,
						groupName + "/" + item.axis + "/" + name + "/" + axis);
			}
		}
	}
});

test("Phase 3H independently pre-recorded Workbench pixel rectangles support resolved-parent native-grid candidate", () => {
	let totalError = 0;
	let maxError = 0;
	let channels = 0;
	for (const group of s_Evidence.nativeCases) {
		const prediction = PredictCase(group);
		assert.equal(prediction.plan.rects.length, 3);
		assert.ok(Math.abs(prediction.gridWidth - (group.group === "Direct" ? 240 : 180)) < .001);
		assert.ok(Math.abs(prediction.gridHeight - (group.group === "Direct" ? 135 : 96)) < .001);
		for (let index = 0; index < s_ColorNames.length; ++index) {
			const observed = LocalRect(group.swatches[s_ColorNames[index]], group.backgroundRect);
			const expected = prediction.rects[index];
			for (const axis of ["x", "y", "width", "height"]) {
				const delta = Math.abs(observed[axis] - expected[axis]);
				totalError += delta;
				maxError = Math.max(maxError, delta);
				++channels;
			}
		}
	}
	assert.equal(channels, 96);
	assert.ok(maxError < 2, "largest native screenshot error must remain below 2 px");
	assert.ok(totalError / channels < 1, "mean native screenshot error must remain below 1 px");
});

test("Phase 3H original Studio renderer does not match native Grid placements", () => {
	let totalOrangeXError = 0;
	for (const group of s_Evidence.nativeCases) {
		const studio = s_Evidence.studioCases.find(item => item.name === group.name);
		assert.ok(studio);
		const nativeOrange = LocalRect(group.swatches.Orange, group.backgroundRect);
		const studioOrange = LocalRect(studio.swatches.Orange, studio.backgroundRect);
		totalOrangeXError += Math.abs(nativeOrange.x - studioOrange.x);
	}
	assert.ok(totalOrangeXError / s_Evidence.nativeCases.length > 35,
		"baseline Studio should still visibly fail native second-column placement");
});

test("Phase 3H local pixels do not authorize production relative-grid guard removal", () => {
	for (const item of s_Evidence.nativeCases) {
		const geometry = PredictCase(item);
		assert.equal(geometry.plan.rects[0].x, 8);
		assert.equal(geometry.plan.rects[1].x, 90);
		assert.equal(geometry.plan.rects[2].x, 8);
		assert.equal(geometry.plan.rects[0].y, 8);
		assert.equal(geometry.plan.rects[2].y, 48);
	}
	// Our experimental bridge stays untouched: only the independent pure
	// native-derived planner is reused with externally resolved dimensions.
});
