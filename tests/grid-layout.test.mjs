import test from "node:test";
import assert from "node:assert/strict";
import { PlanConstrainedGrid, PlanGrid } from "../.grid-layout-test-build/GridLayout.js";

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

test("Workbench SpacerTest2 implicit 3x3 grid reserves fixed edges and stretches middle cells", () => {
 // Values from the vanilla example (author-defined parent 454.336 x 611.67798).
 const width = 454.336, height = 611.67798;
 const children = [
  rect(60, 60), rect(width, 60), rect(60, 60),
  rect(60, height), rect(width, height), rect(60, height),
  rect(60, 60), rect(width, 60), rect(60, 60)
 ];
 const measured = [
  rect(60, 60), rect(0, 60), rect(60, 60),
  rect(60, 0), rect(0, 0), rect(60, 0),
  rect(60, 60), rect(0, 60), rect(60, 60)
 ];
 const plan = PlanGrid(children, 0, 0, 0, measured, { width, height });
 assert.equal(plan.columns, 3);
 assert.equal(plan.rows, 3);
 assert.equal(plan.contentWidth, width);
 assert.equal(plan.contentHeight, height);
 assert.deepEqual(plan.rects.map(({ x, y }) => [Math.round(x), Math.round(y)]),
  [[0,0],[60,0],[394,0],[0,60],[60,60],[394,60],[0,552],[60,552],[394,552]]);
 assert.equal(Math.round(plan.rects[4].width), 334);
 assert.equal(Math.round(plan.rects[4].height), 492);
 assert.equal(plan.rects[0].width, 60);
 assert.equal(plan.rects[8].height, 60);
});

test("flexible cells use their own column and row dimensions for fractional children", () => {
 const plan = PlanGrid(
  [rect(60, 30), rect(100, 60), rect(60, 30), rect(60, 60)],
  2, 2, 0,
  [rect(60, 30), rect(0, 30), rect(60, 30), rect(0, 30)],
  { width: 200, height: 60 }
 );
 assert.equal(plan.rects[1].width, 140 * 100 / 200);
 assert.equal(plan.rects[3].width, 140 * 60 / 200);
 assert.equal(plan.contentWidth, 200);
});

test("configured single-column grids retain vertical flow", () => {
 const plan = PlanGrid(Array.from({length:5},()=>rect(320,40)),1,4,0,undefined,{width:320,height:160});
 assert.equal(plan.columns,1);
 assert.equal(plan.rows,5);
 assert.equal(plan.contentHeight,200);
});

test("native constrained-grid arithmetic evenly divides a 3-by-3 parent", () => {
 const plan = PlanConstrainedGrid(8, 3, 3, { width: 675, height: 480 }, 0);
 assert.equal(plan.columns, 3);
 assert.equal(plan.rows, 3);
 assert.deepEqual(plan.rects.map(({ x, y, width, height }) => [x, y, width, height]), [
  [0, 0, 225, 160], [225, 0, 225, 160], [450, 0, 225, 160],
  [0, 160, 225, 160], [225, 160, 225, 160], [450, 160, 225, 160],
  [0, 320, 225, 160], [225, 320, 225, 160]
 ]);
});

test("native constrained grid keeps explicit five rows when only seven children exist", () => {
 const plan = PlanConstrainedGrid(7, 2, 5, { width: 180, height: 160 }, 0);
 assert.equal(plan.rows, 5);
 assert.equal(plan.rects[0].width, 90);
 assert.equal(plan.rects[0].height, 32);
 assert.deepEqual([plan.rects[6].x, plan.rects[6].y], [0, 96]);
 assert.equal(plan.contentHeight, 160);
});

test("native constrained grid subtracts padding and inter-cell gaps before dividing", () => {
 const plan = PlanConstrainedGrid(4, 2, 2, { width: 200, height: 100 }, 4, 12);
 assert.equal(plan.rects[0].width, 86);
 assert.equal(plan.rects[0].height, 36);
 assert.deepEqual([plan.rects[3].x, plan.rects[3].y], [102, 52]);
});

test("native constrained grid clamps impossible available sizes instead of emitting NaN", () => {
 const plan = PlanConstrainedGrid(2, 2, 1, { width: 2, height: 3 }, 100, 40);
 assert.equal(plan.rects[0].width, 0);
 assert.equal(plan.rects[0].height, 0);
 assert.ok(plan.rects.every((child) => Number.isFinite(child.x) && Number.isFinite(child.y)));
});
