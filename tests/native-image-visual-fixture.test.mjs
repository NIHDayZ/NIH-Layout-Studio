import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";
import { DecodeNativeImageWidgetFlags, NativeImageFlipCssTransform } from "../.geometry-engine-test-build/NativeImageUv.js";

const source = readFileSync(new URL(
	"./fixtures/native-image-visual/NIH_NativeImageUv_Parity.layout", import.meta.url
), "utf8");
const roots = new LayoutParser().Parse(source).roots;
const samples = [
	["UV_None", 0, 24, undefined],
	["UV_FlipU", 0x04000000, 264, "scale(-1, 1)"],
	["UV_FlipV", 0x08000000, 504, "scale(1, -1)"],
	["UV_FlipUV", 0x0c000000, 744, "scale(-1, -1)"]
];
function Prop(node, name) {
	return node.properties.find(property => property.name.toLowerCase() === name)?.value;
}

test("actual image UV layout syntax includes four comparable ImageWidgets and one image resource", () => {
	assert.equal(roots.length, 1);
	assert.equal(roots[0].name, "NIHNativeImageUvParity");
	assert.deepEqual(roots[0].children.map(node => node.name), samples.map(row => row[0]));
	for (const node of roots[0].children) {
		assert.equal(node.type, "ImageWidgetClass");
		assert.equal(Prop(node, "image0"), Prop(roots[0].children[0], "image0"));
		assert.match(Prop(node, "image0"), /set:dayz_gui image:DayZLogo/);
		assert.equal(Prop(node, "mode"), "blend");
		assert.equal(Prop(node, "stretch"), "1");
		assert.equal(Prop(node, "src alpha"), "1");
		assert.equal(Prop(node, "fixaspect"), undefined);
		const invariant = node.properties.filter(property =>
			!["position", "flip u", "flip v"].includes(property.name.toLowerCase()));
		const reference = roots[0].children[0].properties.filter(property =>
			!["position", "flip u", "flip v"].includes(property.name.toLowerCase()));
		assert.deepEqual(invariant, reference);
	}
});

test("native flip decoder distinguishes none, U, V and U+V without changing widget geometry", () => {
	const snapshot = BuildAuthoredGeometrySnapshot(roots, {x:0,y:0,width:960,height:320});
	assert.deepEqual(snapshot.issues, []);
	assert.equal(snapshot.entries.length, 5);
	for (const [index, node] of roots[0].children.entries()) {
		const [name, expectedFlags, x, transform] = samples[index];
		assert.equal(node.name, name);
		const flags = DecodeNativeImageWidgetFlags(node.properties);
		assert.equal(flags, expectedFlags);
		assert.equal(NativeImageFlipCssTransform(flags), transform);
		const rect = snapshot.byId.get(node.id)?.absoluteRect;
		assert.ok(rect, "Missing geometry for " + name);
		assert.deepEqual([rect.x, rect.y, rect.width, rect.height], [x, 64, 192, 192]);
	}
});

test("UV visual capture template is empty; no fixture prediction qualifies as native pixel evidence", () => {
	const template = JSON.parse(readFileSync(new URL(
		"./fixtures/native-image-visual/capture.template.json", import.meta.url
	), "utf8"));
	assert.equal(template.captureKind, "native-image-pixel-pending");
	assert.deepEqual(template.cases.map(c => c.id), samples.map(row => row[0]));
	assert.ok(template.cases.every(c =>
		c.nativePixels === null && c.studioPixels === null &&
		c.resourceResolvedNative === null && c.resourceResolvedStudio === null));
});
