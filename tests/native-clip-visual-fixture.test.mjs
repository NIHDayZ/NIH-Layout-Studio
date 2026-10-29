import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";
import { InspectAuthoredVisibility } from "../.geometry-engine-test-build/GeometryVisibility.js";

const source = readFileSync(new URL(
	"./fixtures/native-clip-visual/NIH_NativeClip_Parity.layout", import.meta.url
), "utf8");
const roots = new LayoutParser().Parse(source).roots;
const all = new Map();
function Collect(nodes) {
	for (const node of nodes) {
		assert.equal(all.has(node.name), false, "Duplicate fixture widget");
		all.set(node.name, node);
		Collect(node.children);
	}
}
Collect(roots);
function Prop(node, name) {
	return node.properties.find(p => p.name.toLowerCase() === name)?.value;
}
function Invariant(node) {
	return node.properties
		.filter(p => !["position", "clipchildren"].includes(p.name.toLowerCase()))
		.map(p => [p.name.toLowerCase(), p.value]);
}
const topPairs = [
	["Frame_NoClip", "Frame_Clip", "FrameWidgetClass"],
	["Panel_NoClip", "Panel_Clip", "PanelWidgetClass"]
];

test("native clipping fixture has four controlled Frame/Panel variants and two nested clip cases", () => {
	assert.equal(roots.length, 1);
	assert.equal(roots[0].name, "NIHNativeClipParity");
	assert.equal(roots[0].children.length, 6);
	assert.equal(all.size, 19);
	for (const [off, on, type] of topPairs) {
		const control = all.get(off);
		const clipped = all.get(on);
		assert.equal(control.type, type);
		assert.equal(clipped.type, type);
		assert.equal(Prop(control, "clipchildren"), "0");
		assert.equal(Prop(clipped, "clipchildren"), "1");
		assert.deepEqual(Invariant(control), Invariant(clipped));
		assert.deepEqual(control.children.map(n => n.type), ["ImageWidgetClass","ImageWidgetClass"]);
		assert.deepEqual(clipped.children.map(n => n.type), ["ImageWidgetClass","ImageWidgetClass"]);
	}
	assert.equal(Prop(all.get("Nested_NoClip_Inner"), "clipchildren"), "0");
	assert.equal(Prop(all.get("Nested_Clip_Inner"), "clipchildren"), "1");
	assert.equal(Prop(all.get("Nested_NoClip_Outer"), "clipchildren"), "1");
	assert.equal(Prop(all.get("Nested_Clip_Outer"), "clipchildren"), "1");
});

test("all ten clipped/unclipped ImageWidgets resolve the same authored source and paint settings", () => {
	const images = [...all.values()].filter(node => node.type === "ImageWidgetClass");
	assert.equal(images.length, 10);
	const reference = images[0];
	for (const image of images) {
		assert.equal(Prop(image, "image0"), "set:dayz_gui image:DayZLogo");
		for (const name of ["mode", "src alpha", "stretch"])
			assert.equal(Prop(image, name), Prop(reference, name));
		assert.equal(Prop(image, "fixaspect"), undefined);
	}
});

test("shared authored rectangles preserve overhang and negative positions before any visual paint decision", () => {
	const snapshot = BuildAuthoredGeometrySnapshot(roots, {x:0,y:0,width:1280,height:720});
	assert.deepEqual(snapshot.issues, []);
	assert.equal(snapshot.entries.length, 19);
	function Rect(name) {
		const node = all.get(name);
		assert.ok(node, "Missing " + name);
		return snapshot.byId.get(node.id)?.absoluteRect;
	}
	assert.deepEqual(Rect("Frame_NoClip"), {x:90,y:110,width:210,height:170});
	assert.deepEqual(Rect("Frame_NoClip_RightOverhang"), {x:225,y:110,width:150,height:160});
	assert.deepEqual(Rect("Frame_NoClip_LeftBottomOverhang"), {x:35,y:225,width:150,height:140});
	assert.deepEqual(Rect("Panel_Clip"), {x:960,y:110,width:210,height:170});
	assert.deepEqual(Rect("Panel_Clip_RightOverhang"), {x:1095,y:110,width:150,height:160});
	assert.deepEqual(Rect("Nested_NoClip_Inner"), {x:280,y:410,width:145,height:110});
	assert.deepEqual(Rect("Nested_NoClip_Image"), {x:370,y:430,width:155,height:150});
	assert.deepEqual(Rect("Nested_Clip_Image"), {x:830,y:430,width:155,height:150});
});

test("visual capture template remains empty and diagnostic clip intersection cannot be promoted to native pixels", () => {
	const template = JSON.parse(readFileSync(new URL(
		"./fixtures/native-clip-visual/capture.template.json", import.meta.url
	), "utf8"));
	assert.equal(template.captureKind, "native-clipping-visual-pending");
	assert.deepEqual(template.cases.map(item => item.id), [
		"Frame_NoClip", "Frame_Clip", "Panel_NoClip", "Panel_Clip", "Nested_NoClip", "Nested_Clip"
	]);
	assert.ok(template.cases.every(item => item.nativePaint === null &&
		item.studioPaint === null && item.observedResult === "pending"));
	const authored = InspectAuthoredVisibility(
		{x:225,y:110,width:150,height:160},
		{x:90,y:110,width:210,height:170},
		true,true
	);
	assert.deepEqual(authored.intersectionCandidate, {x:225,y:110,width:75,height:160});
	assert.equal(authored.evidence, "authored-hierarchy-and-ancestor-clip-candidate");
	assert.equal(template.nativeScissorVerified, false);
});

test("October 29 paired clipping screenshot observations match all six cases without asserting native scissor", () => {
	const observation = JSON.parse(readFileSync(new URL(
		"./fixtures/native-clip-visual/capture.visual.2026-10-29.json", import.meta.url
	), "utf8"));
	assert.equal(observation.captureKind, "paired-workbench-studio-clipping-visual-observation");
	assert.equal(observation.visualClippingAcceptedForTheseCases, true);
	assert.equal(observation.strictPixelParityEstablished, false);
	assert.equal(observation.nativeScissorImplementationEstablished, false);
	assert.deepEqual(observation.cases.map(c => c.id), [
		"Frame_NoClip", "Frame_Clip", "Panel_NoClip", "Panel_Clip",
		"Nested_NoClip", "Nested_Clip"
	]);
	assert.ok(observation.cases.every(c => c.visualOutcome === "match" && c.sourceImageResolvedInBoth));
	assert.deepEqual(observation.sourceImages.map(s => s.previewRoot), [[1280,720],[1280,720]]);
	assert.deepEqual(observation.sourceImages.map(s => s.displayedZoomPercent), [68,68]);
	assert.equal(observation.sourceLog.geometryTests.pass, 271);
	assert.equal(observation.sourceLog.uvTests.pass, 11);
	assert.ok(observation.analysis.wholeFixtureSilhouetteIou > 0.90);
	const samples = observation.analysis.samples;
	assert.equal(samples.length, 10);
	for (const sample of samples) {
		if (sample.expectedState === "visible") {
			assert.ok(sample.workbenchWhitePixels > 0 && sample.studioWhitePixels > 0);
		} else {
			assert.equal(sample.expectedState, "not-visible");
			assert.equal(sample.workbenchWhitePixels, 0);
			assert.equal(sample.studioWhitePixels, 0);
		}
	}
});
