import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("Canvas uses whole-tree measured geometry only behind an explicit flag",()=>{
	const source=readFileSync(new URL("../src/components/Canvas.tsx",import.meta.url),"utf8");
	assert.ok(source.includes('get("experimentalGeometrySnapshot") === "1"'));
	assert.ok(source.includes("ArrangeMeasuredGeometry(MeasureLayoutTree(nodes), root)"));
	assert.ok(source.includes("geometryById?.get(node.id)?.localRect ?? forcedRect ?? ResolveRect(node, parent)"));
	assert.ok(source.includes("if (!geometryById && experimentalGridLayout"));
	assert.ok(source.includes("geometryById={geometryById}"));
	assert.ok(source.includes('issue.code === "duplicate-widget-id"'));
});
