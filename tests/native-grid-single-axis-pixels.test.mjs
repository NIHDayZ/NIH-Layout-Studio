import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { PlanNativeRelativeGrid } from "../.geometry-engine-test-build/GridRelativeContent.js";

const s_Source = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Grid_SingleAxis_Content_Matrix.layout", import.meta.url), "utf8");
const s_Evidence = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/grid-single-axis-phase3k-native-pixels.json", import.meta.url), "utf8"));

function Walk(nodes, result = new Map()) {
	for (const node of nodes) {
		result.set(node.name, node);
		Walk(node.children, result);
	}
	return result;
}

const s_ByName = Walk(new LayoutParser().Parse(s_Source).roots);

function Get(node, key) {
	return node.properties.find(value => value.name.toLowerCase() === key.toLowerCase())?.value;
}

function GetPair(node, key) {
	return Get(node, key).split(/\s+/).map(Number);
}

function Predict(item) {
	const grid = s_ByName.get(item.name);
	assert.ok(grid);
	const slot = s_ByName.get(item.name.replace(/^Grid/, "Slot"));
	const [slotWidth, slotHeight] = GetPair(slot, "size");
	const [authoredWidth, authoredHeight] = GetPair(grid, "size");
	const width = Get(grid, "hexactsize") === "1"
		? authoredWidth : slotWidth * authoredWidth;
	const height = Get(grid, "vexactsize") === "1"
		? authoredHeight : slotHeight * authoredHeight;
	const plan = PlanNativeRelativeGrid({
		columns: Number(Get(grid, "Columns")),
		rows: Number(Get(grid, "Rows")),
		padding: Number(Get(grid, "Padding")),
		margin: Number(Get(grid, "Margin")),
		authoredWidth: width,
		authoredHeight: height,
		contentWidth: Get(grid, "Size To Content H") === "1",
		contentHeight: Get(grid, "Size To Content V") === "1",
		children: grid.children.map(child => {
			const size = GetPair(child, "size");
			return {
				width: size[0], height: size[1],
				exactWidth: Get(child, "hexactsize") === "1",
				exactHeight: Get(child, "vexactsize") === "1"
			};
		})
	});
	assert.ok(plan);
	const [x, y] = GetPair(grid, "position");
	return { plan, rects: plan.rects.map(rect => ({
		x: (x + rect.x) * s_Evidence.zoom,
		y: (y + rect.y) * s_Evidence.zoom,
		width: rect.width * s_Evidence.zoom,
		height: rect.height * s_Evidence.zoom
	})) };
}

function Local(box, bg) {
	return {
		x: box[0] - bg[0], y: box[1] - bg[1],
		width: box[2] - box[0], height: box[3] - box[1]
	};
}

test("Phase 3K native screenshot evidence contains eight measured single-axis controls", () => {
	assert.equal(s_Evidence.kind, "INDEPENDENT_NATIVE_WORKBENCH_SCREENSHOT_SWATCH_RECTANGLES");
	assert.deepEqual(s_Evidence.imageSize, [1919, 1034]);
	assert.equal(s_Evidence.zoom, 0.46);
	assert.equal(s_Evidence.cases.length, 8);
	const byMode = new Map();
	for (const item of s_Evidence.cases) {
		assert.ok(s_ByName.has(item.name));
		byMode.set(item.contentMode, (byMode.get(item.contentMode) ?? 0) + 1);
		for (const color of ["Blue", "Orange", "Green"]) {
			const r = Local(item.swatches[color], item.backgroundRect);
			assert.ok(r.width > 0 && r.height > 0);
			assert.ok(r.x >= 0 && r.y >= 0);
		}
	}
	assert.equal(byMode.get("WidthOnly"), 4);
	assert.equal(byMode.get("HeightOnly"), 4);
});

test("Phase 3K Workbench single-axis swatches are invariant to equivalent parent exact/relative flags", () => {
	for (const mode of ["WidthOnly", "HeightOnly"]) {
		const cases = s_Evidence.cases.filter(item => item.contentMode === mode);
		for (const item of cases.slice(1)) {
			for (const color of ["Blue", "Orange", "Green"]) {
				const start = Local(cases[0].swatches[color], cases[0].backgroundRect);
				const next = Local(item.swatches[color], item.backgroundRect);
				for (const axis of ["x", "y", "width", "height"])
					assert.ok(Math.abs(start[axis] - next[axis]) <= 1,
						mode + " " + item.parentAxisMode + " " + color + " " + axis);
			}
		}
	}
});

test("Phase 3K allocated-parent resolution with existing pure planner predicts 96 native single-axis coordinates", () => {
	let errorSum = 0;
	let maximum = 0;
	let n = 0;
	for (const item of s_Evidence.cases) {
		const { plan, rects } = Predict(item);
		assert.equal(plan.rects.length, 3);
		assert.ok(Number.isFinite(plan.width) && Number.isFinite(plan.height));
		for (let i = 0; i < 3; ++i) {
			const observed = Local(item.swatches[["Blue", "Orange", "Green"][i]], item.backgroundRect);
			for (const axis of ["x", "y", "width", "height"]) {
				const error = Math.abs(observed[axis] - rects[i][axis]);
				errorSum += error;
				maximum = Math.max(maximum, error);
				++n;
			}
		}
	}
	assert.equal(n, 96);
	assert.ok(errorSum / n < 1, "mean native-pixel coordinate error <1px");
	assert.ok(maximum < 2, "maximum native-pixel coordinate error <2px");
});

test("Phase 3K width-only and height-only pure plans preserve the other authored dimension", () => {
	const width = Predict(s_Evidence.cases[0]).plan;
	const height = Predict(s_Evidence.cases[4]).plan;
	assert.ok(Math.abs(width.width - 161.9) < 0.001);
	assert.equal(width.height, 135);
	assert.equal(height.width, 240);
	assert.ok(Math.abs(height.height - 104) < 0.001);
	assert.equal(width.rects[0].x, 8);
	assert.equal(width.rects[1].y, 8);
	assert.equal(height.rects[1].x, 126);
});
