import test from "node:test";
import assert from "node:assert/strict";
import { IntersectRects, ResolveChildClip, TranslateRect } from "../.geometry-engine-test-build/GeometryCore.js";

test("nested child coordinates use parent absolute origin without resizing", () => {
 const parent = { x: 400, y: 100, width: 600, height: 300 };
 const child = { x: -20, y: 30, width: 120, height: 70 };
 assert.deepEqual(TranslateRect(child, parent), { x: 380, y: 130, width: 120, height: 70 });
 assert.deepEqual(parent, { x: 400, y: 100, width: 600, height: 300 });
});

test("rect intersections preserve fractional and negative positions", () => {
 const a = { x: -10.5, y: 10, width: 40.5, height: 30 };
 const b = { x: 0, y: 5, width: 21.25, height: 20 };
 assert.deepEqual(IntersectRects(a, b), { x: 0, y: 10, width: 21.25, height: 15 });
});

test("disjoint rectangles have no negative intersection dimensions", () => {
 const a = { x: 0, y: 0, width: 10, height: 10 };
 const b = { x: 30, y: 25, width: 5, height: 5 };
 const c = IntersectRects(a, b);
 assert.equal(c.width, 0);
 assert.equal(c.height, 0);
});

test("non-clipping containers preserve ancestor clipping", () => {
 const ancestor = { x: 0, y: 0, width: 100, height: 100 };
 const larger = { x: -10, y: -10, width: 200, height: 200 };
 assert.equal(ResolveChildClip(ancestor, larger, false), ancestor);
 assert.equal(ResolveChildClip(null, larger, false), null);
});

test("nested clipping never expands beyond the ancestor's bounds", () => {
 const ancestor = { x: 0, y: 0, width: 100, height: 100 };
 const child = { x: 80, y: 40, width: 50, height: 30 };
 assert.deepEqual(ResolveChildClip(ancestor, child, true), { x: 80, y: 40, width: 20, height: 30 });
 assert.deepEqual(ResolveChildClip(null, child, true), child);
});
