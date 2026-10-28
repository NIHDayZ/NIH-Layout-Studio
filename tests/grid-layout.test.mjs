import test from "node:test";
import assert from "node:assert/strict";
import { PlanGrid } from "../.grid-layout-test-build/GridLayout.js";

const rect = (width, height) => ({ x: 0, y: 0, width, height });

test("one column lays out five children beyond four configured rows without dropping a child", () => {
 const plan = PlanGrid(Array.from({ length: 5 }, () => rect(320, 40)), 1, 4, 0);
 assert.equal(plan.columns, 1);
 assert.equal(plan.rows, 5);
 assert.equal(plan.contentHeight, 200);
 assert.deepEqual(plan.rects.map((r) => r.y), [0, 40, 80, 120, 160]);
});
test("two columns use each row's maximum height and each column's maximum width", () => {
 const plan = PlanGrid([rect(20, 10), rect(30, 15), rect(40, 25), rect(10, 5)], 2, 0, 2);
 assert.equal(plan.contentWidth, 72);
 assert.equal(plan.contentHeight, 42);
 assert.deepEqual(plan.rects.map(({ x, y }) => [x, y]), [[0, 0], [42, 0], [0, 17], [42, 17]]);
});
test("rows hint supplies columns only if no columns were authored", () => {
 const plan = PlanGrid([rect(10, 10), rect(10, 10), rect(10, 10), rect(10, 10)], 0, 2, 0);
 assert.equal(plan.columns, 2);
 assert.equal(plan.rows, 2);
});
test("invalid settings and empty grids are safe", () => {
 const plan = PlanGrid([], Number.NaN, -1, -3);
 assert.equal(plan.columns, 1);
 assert.equal(plan.rows, 0);
 assert.equal(plan.contentHeight, 0);
});

test("relative-sized child does not inflate its own grid measurement", () => {
 const children = [rect(50, 10), rect(50, 30)];
 const measured = [rect(50, 10), rect(50, 0)];
 const plan = PlanGrid(children, 1, 2, 0, measured);
 assert.equal(plan.contentHeight, 10);
 assert.deepEqual(plan.rects.map(({ y, height }) => [y, height]), [[0, 10], [10, 30]]);
});

test("parent growth does not change intrinsic content for relative-sized children", () => {
 const first = PlanGrid([rect(50, 10), rect(50, 30)], 1, 2, 0, [rect(50, 10), rect(50, 0)]);
 const expanded = PlanGrid([rect(50, 10), rect(50, 40)], 1, 2, 0, [rect(50, 10), rect(50, 0)]);
 assert.equal(first.contentHeight, expanded.contentHeight);
 assert.equal(first.rects[1].y, expanded.rects[1].y);
 assert.equal(expanded.rects[1].height, 40);
});

test("measurement array must have one entry for each rendered child", () => {
 assert.throws(() => PlanGrid([rect(10, 10)], 1, 1, 0, []), /measurements must match/i);
});
