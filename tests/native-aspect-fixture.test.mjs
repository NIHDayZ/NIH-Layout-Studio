import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";
import { DecodeAuthoredGeometry } from "../.geometry-engine-test-build/WidgetGeometry.js";
import { CompareCommonGeometryCaptures } from "../scripts/compare-workbench-common.mjs";

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

test("native aspect capture template remains pending for both independently required root cases", () => {
	const template = JSON.parse(readFileSync(new URL(
		"./fixtures/native-aspect/capture.template.json", import.meta.url
	), "utf8"));
	assert.deepEqual(template.cases.map(item => item.id), [
		"root-960x500-origin", "root-1280x720-offset"
	]);
	assert.ok(template.cases.every(item =>
		item.viewport === null && item.observed === null && item.provenance === null));
	const report = CompareCommonGeometryCaptures(template, roots);
	assert.deepEqual(report.summary, { pass: 0, fail: 0, pending: 2, synthetic: 0 });
	assert.deepEqual(report.reports.map(item => item.total), [9, 9]);
});

test("independent October 29 native fixaspect capture matches 18 descendant rectangles with no measured delta", () => {
	const native = JSON.parse(readFileSync(new URL(
		"./fixtures/native-aspect/capture.runtime.2026-10-29.json", import.meta.url
	), "utf8"));
	assert.equal(native.captureKind, "native-dayz-client-fixaspect");
	assert.equal(native.rootName, "NIHNativeAspectParity");
	assert.deepEqual(native.cases.map(item => item.id), [
		"root-960x500-origin", "root-1280x720-offset"
	]);
	assert.deepEqual(native.cases.map(item => item.viewport), [
		{ x: 0, y: 0, width: 960, height: 500 },
		{ x: 31, y: 19, width: 1280, height: 720 }
	]);
	assert.ok(native.cases.every(item =>
		item.provenance.captureMethod === "dayz-client-script-getters" &&
		item.provenance.versionDefine === "DAYZ_1_30" &&
		item.provenance.nativeBuild === null));
	const compared = CompareCommonGeometryCaptures(native, roots);
	assert.deepEqual(compared.summary, { pass: 0, fail: 0, pending: 2, synthetic: 0 });
	assert.deepEqual(compared.reports.map(item => item.matched), [9, 9]);
	assert.ok(compared.reports.every(item =>
		item.errors.length === 1 && /client build identifier was not captured/i.test(item.errors[0])));
});

test("native aspect mismatch still fails, even when exact client build is unknown", () => {
	const native = JSON.parse(readFileSync(new URL(
		"./fixtures/native-aspect/capture.runtime.2026-10-29.json", import.meta.url
	), "utf8"));
	native.cases[0].observed.Text_Mode1.width += 1;
	const report = CompareCommonGeometryCaptures(native, roots);
	assert.deepEqual(report.summary, { pass: 0, fail: 1, pending: 1, synthetic: 0 });
	assert.match(report.reports[0].errors.join(" "), /Text_Mode1\.width/);
});
