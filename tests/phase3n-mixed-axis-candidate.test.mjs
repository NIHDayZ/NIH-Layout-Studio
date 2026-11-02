import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ProbeMixedAxisGrid } from "../.geometry-engine-test-build/SnapshotForTests.js";

function Leaf(width, height, exactWidth, exactHeight, kind = "authored") {
	return {
		strategy: { kind, requiresArrangement: kind !== "authored" },
		authored: {
			sizeX: width, sizeY: height,
			exactSizeX: exactWidth, exactSizeY: exactHeight,
			sizeToContentWidth: false, sizeToContentHeight: false, visible: true
		},
		unresolvedContentWidth: false, unresolvedContentHeight: false,
		children: []
	};
}

function Grid(width, height, exactWidth, exactHeight, contentWidth, contentHeight,
	children, columns = 1, rows = children.length) {
	return {
		strategy: { kind: "grid", requiresArrangement: true },
		nativeGrid: { columns, rows, padding: 0, margin: 0 },
		nativeIgnoreInvisible: true,
		authored: {
			sizeX: width, sizeY: height, exactSizeX: exactWidth, exactSizeY: exactHeight,
			sizeToContentWidth: contentWidth, sizeToContentHeight: contentHeight, visible: true
		},
		unresolvedContentWidth: contentWidth, unresolvedContentHeight: contentHeight,
		children
	};
}

test("Phase 3N candidate measures nested one-column Grid and exact-height Scroll child", () => {
	const header = Grid(1, 40, false, true, true, false, [
		Leaf(90, 1, true, false),
		Leaf(1, 1, false, false),
		Leaf(120, 1, true, false),
		Leaf(120, 1, true, false),
		Leaf(100, 1, true, false),
		Leaf(10, 1, true, false)
	], 6, 1);
	const content = Grid(1, 0.328, false, false, true, true,
		[header, Leaf(1, 720, false, true, "scroll")]);
	const root = Grid(0.63, 1080, false, true, true, true,
		[content, Leaf(1, 40, false, true)]);
	const result = ProbeMixedAxisGrid(root, 1920, 1080);
	assert.ok(result);
	assert.ok(Math.abs(result.root.plan.width - 1209.6) < 0.001);
	assert.equal(result.root.plan.height, 800);
	assert.equal(result.plans.get(content).plan.height, 760);
	assert.equal(result.plans.get(header).plan.height, 40);
	assert.ok(Math.abs(result.plans.get(header).plan.rects[1].width - 769.6) < 0.001);
	assert.equal(result.plans.get(content).plan.rects[1].y, 40);
	assert.equal(result.root.plan.rects[1].y, 760);
});

test("Phase 3N candidate measures stacked nested filter content, spacer and button grid", () => {
	const filtersContent = Grid(1, 0.6, false, false, true, true,
		Array.from({ length: 10 }, () => Leaf(1, 30, false, true)));
	const buttons = Grid(0.197, 0.102, false, false, false, true, [
		Leaf(1, 30, false, true), Leaf(1, 30, false, true),
		Leaf(1, 30, false, true), Leaf(48, 10, true, true),
		Leaf(1, 30, false, true), Leaf(48, 10, true, true)
	]);
	const filters = Grid(0.25, 1, false, false, false, true,
		[filtersContent, Leaf(1, 10, false, true), buttons]);
	const right = Grid(0.27, 1, false, false, false, true,
		[Leaf(1, 40, false, true), filters]);
	const result = ProbeMixedAxisGrid(right, 1920, 1080);
	assert.ok(result);
	assert.ok(Math.abs(result.root.plan.width - 518.4) < 0.001);
	assert.equal(result.root.plan.height, 490);
	assert.equal(result.plans.get(filters).plan.height, 450);
	assert.equal(result.plans.get(filtersContent).plan.height, 300);
	assert.equal(result.plans.get(buttons).plan.height, 140);
	assert.ok(Math.abs(result.plans.get(filters).plan.width - 518.4) < 0.001);
	assert.ok(Math.abs(result.plans.get(buttons).plan.width - 518.4) < 0.001);
	assert.equal(result.root.plan.rects[1].y, 40);
	assert.equal(result.plans.get(filters).plan.rects[2].y, 310);
});

test("Phase 3N candidate preserves Phase 3M six native nested fixtures without renderer integration", () => {
	const source = readFileSync(new URL(
		"./fixtures/workbench-grid/NIH_Grid_Nested_Dependency_Matrix.layout", import.meta.url), "utf8");
	const native = JSON.parse(readFileSync(new URL(
		"./fixtures/workbench-grid/grid-nested-phase3m-runtime-screen-rects.json", import.meta.url), "utf8"));
	const measured = MeasureLayoutTree(new LayoutParser().Parse(source).roots);
	const nodes = [];
	function Walk(node) {
		nodes.push(node);
		for (const child of node.children)
			Walk(child);
	}
	for (const root of measured.roots)
		Walk(root);
	for (const sample of native.cases) {
		const parent = nodes.find(node => node.node.name === "Outer" + sample.name);
		assert.ok(parent);
		const plan = ProbeMixedAxisGrid(parent, 570, 465);
		assert.ok(plan, "native matrix rejected " + sample.name);
		const nativeOuter = sample.rects.Outer;
		assert.ok(Math.abs(plan.root.plan.width - nativeOuter[2]) < 0.025);
		assert.ok(Math.abs(plan.root.plan.height - nativeOuter[3]) < 0.025);
	}
});

test("Phase 3N candidate refuses unknown size dependencies and unmeasured Scroll height", () => {
	const root = Grid(1, 1, false, false, true, true,
		[Grid(1, 1, false, false, true, true, [Leaf(1, 10, false, true)]),
			Leaf(1, 0.2, false, false, "scroll")]);
	assert.equal(ProbeMixedAxisGrid(root, 1920, 1080), null);
});
