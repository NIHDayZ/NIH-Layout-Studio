import test from "node:test";
import assert from "node:assert/strict";
import {
  ProjectNativeScrollChildContext,
  MeasureNativeScrollNormalizedPosition
} from "../.geometry-engine-test-build/ScrollOffset.js";

test("explicit native offsets shift child context without moving the viewport", () => {
  const viewport = Object.freeze({ x: 10, y: 0, width: 90, height: 50 });
  const offsets = Object.freeze({ horizontal: 17, vertical: 23 });
  const result = ProjectNativeScrollChildContext(viewport, offsets);
  assert.deepEqual(result.childContext, { x: -7, y: -23, width: 90, height: 50 });
  assert.deepEqual(result.viewport, viewport);
  assert.deepEqual(result.offsets, offsets);
  assert.equal(result.evidence, "native-derived-scroll-child-origin");
  assert.deepEqual(viewport, { x: 10, y: 0, width: 90, height: 50 });
  assert.deepEqual(offsets, { horizontal: 17, vertical: 23 });
});

test("zero offsets retain left-scrollbar-origin shift", () => {
  const result = ProjectNativeScrollChildContext(
    { x: 10, y: 0, width: 90, height: 50 },
    { horizontal: 0, vertical: 0 }
  );
  assert.deepEqual(result.childContext, { x: 10, y: 0, width: 90, height: 50 });
});

test("malformed or overflowed offset inputs are rejected", () => {
  const viewport = { x: 0, y: 0, width: 100, height: 60 };
  assert.equal(ProjectNativeScrollChildContext(viewport, { horizontal: NaN, vertical: 0 }), null);
  assert.equal(ProjectNativeScrollChildContext(viewport, { horizontal: 0, vertical: Infinity }), null);
  assert.equal(ProjectNativeScrollChildContext({ ...viewport, width: 0 }, { horizontal: 0, vertical: 0 }), null);
  assert.equal(ProjectNativeScrollChildContext({ ...viewport, x: -Number.MAX_VALUE },
    { horizontal: Number.MAX_VALUE, vertical: 0 }), null);
});

test("native normalized H/V positions use the opposite scrollbar's reservation", () => {
  const result = MeasureNativeScrollNormalizedPosition({
    contentWidth: 250, contentHeight: 180,
    widgetWidth: 100, widgetHeight: 60,
    verticalScrollbar: true, horizontalScrollbar: true, scrollbarThickness: 10,
    offsets: { horizontal: 80, vertical: 65 }
  });
  assert.equal(result.horizontalRange, 160);
  assert.equal(result.verticalRange, 130);
  assert.equal(result.horizontal, 0.5);
  assert.equal(result.vertical, 0.5);
  assert.equal(result.evidence, "native-derived-scroll-position-ratios");
});

test("zero scrolling range returns zero; negative or nonfinite range is refused", () => {
  const base = {
    contentWidth: 100, contentHeight: 60, widgetWidth: 100, widgetHeight: 60,
    verticalScrollbar: false, horizontalScrollbar: false, scrollbarThickness: 10,
    offsets: { horizontal: 0, vertical: 0 }
  };
  const zero = MeasureNativeScrollNormalizedPosition(base);
  assert.deepEqual([zero.horizontal, zero.vertical, zero.horizontalRange, zero.verticalRange], [0,0,0,0]);
  assert.equal(MeasureNativeScrollNormalizedPosition({ ...base, contentWidth: 80 }), null);
  assert.equal(MeasureNativeScrollNormalizedPosition({ ...base, scrollbarThickness: Infinity }), null);
});
