import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";
import { DecodeAuthoredGeometry } from "../.geometry-engine-test-build/WidgetGeometry.js";

const source = readFileSync(new URL(
	"./fixtures/native-aspect/NIH_NativeAspect_Parity.layout", import.meta.url
), "utf8");
const roots = new LayoutParser().Parse(source).roots;
const nodes = new Map();
function Visit(children) {
	for (const node of children) {
		assert.equal(nodes.has(node.name), false, "Duplicate fixture widget name");
		nodes.set(node.name, node);
		Visit(node.children);
	}
}
Visit(roots);
const viewport = { x: 0, y: 0, width: 960, height: 500 };

test("actual Workbench-compatible layout parses all four aspect modes and independent widget families", () => {
	assert.equal(roots.length, 1);
	assert.equal(roots[0].name, "NIHNativeAspectParity");
	for (const [name, mode, type] of [
		["Fill_Mode0", 0, "PanelWidgetClass"],
		["Text_Mode1", 1, "TextWidgetClass"],
		["Image_Mode2", 2, "ImageWidgetClass"],
		["Button_Mode3", 3, "ButtonWidgetClass"]
	]) {
		assert.equal(nodes.get(name)?.type, type);
		assert.equal(DecodeAuthoredGeometry(nodes.get(name)).fixAspectMode, mode);
	}
	assert.equal(DecodeAuthoredGeometry(nodes.get("ExactWidthBypass")).fixAspectMode, 3);
});

test("shared authored geometry predicts explicitly recorded pixel targets for real layout syntax", () => {
	const snapshot = BuildAuthoredGeometrySnapshot(roots, viewport);
	const expected = {
		NIHNativeAspectParity: [0, 0, 960, 500],
		Parent_Mode0: [24, 24, 420, 160],
		Parent_Mode1: [500, 24, 420, 160],
		Parent_Mode2: [24, 264, 420, 160],
		Parent_Mode3: [500, 264, 420, 160],
		Fill_Mode0: [45, 40, 168, 32],
		Text_Mode1: [521, 40, 64, 32],
		Image_Mode2: [45, 280, 320, 160],
		Button_Mode3: [521, 280, 420, 210],
		ExactWidthBypass: [32, 118, 200, 32]
	};
	assert.deepEqual(snapshot.issues, []);
	assert.equal(snapshot.entries.length, Object.keys(expected).length);
	for (const [name, xywh] of Object.entries(expected)) {
		const rect = snapshot.byId.get(nodes.get(name).id)?.absoluteRect;
		assert.ok(rect, "Missing " + name);
		assert.deepEqual([rect.x, rect.y, rect.width, rect.height], xywh, name);
	}
});

test("aspect fixture is a native parity *prediction*, not prepopulated native evidence", () => {
	const names = [...nodes.keys()];
	assert.equal(names.length, 10);
	assert.equal(source.includes("screenRect"), false);
});
