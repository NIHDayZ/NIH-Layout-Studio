import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const fixtureText = readFileSync(new URL(
	"./fixtures/native-font-route/NIH_NativeFontRoute_Parity.layout", import.meta.url
), "utf8");
const document = new LayoutParser().Parse(fixtureText);
const roots = document.roots;
const cases = [
	["Text_Book72_Short", "TextWidgetClass", 70, 95, 480, 34, "gui/fonts/sdf_MetronBook72"],
	["Text_Book72_Tall", "TextWidgetClass", 70, 165, 480, 110, "gui/fonts/sdf_MetronBook72"],
	["Text_Book24", "TextWidgetClass", 70, 325, 480, 44, "gui/fonts/sdf_MetronBook24"],
	["Text_Light24", "TextWidgetClass", 70, 415, 480, 44, "gui/fonts/sdf_MetronLight24"],
	["Button_Book72", "ButtonWidgetClass", 670, 95, 480, 68, "gui/fonts/sdf_MetronBook72"],
	["Button_Book24", "ButtonWidgetClass", 670, 205, 480, 44, "gui/fonts/sdf_MetronBook24"],
	["Text_Default", "TextWidgetClass", 670, 325, 480, 44, null]
];
function Prop(node, name) {
	return node.properties.find(p => p.name.toLowerCase() === name)?.value;
}

test("native font-route fixture parses seven explicit cross-font/widget cases without replacing native font files", () => {
	assert.equal(roots.length, 1);
	assert.equal(roots[0].name, "NIHNativeFontRouteParity");
	assert.equal(roots[0].type, "FrameWidgetClass");
	assert.equal(roots[0].children.length, cases.length);
	assert.deepEqual(roots[0].children.map(n => n.name), cases.map(c => c[0]));
	for (const [index, node] of roots[0].children.entries()) {
		const [name, type,,,,, fontPath] = cases[index];
		assert.equal(node.type, type, name);
		assert.equal(Prop(node, "font") ?? null, fontPath, name);
		assert.equal(Prop(node, "text"), "ABC012", name);
		assert.equal(Prop(node, "exact text size"), undefined);
		assert.equal(Prop(node, "size to text h"), undefined);
		assert.equal(Prop(node, "size to text v"), undefined);
	}
});

test("shared geometry keeps all font control rectangles invariant across resource-resolution modes", () => {
	const snapshot = BuildAuthoredGeometrySnapshot(roots, { x: 0, y: 0, width: 1280, height: 720 });
	assert.deepEqual(snapshot.issues, []);
	assert.equal(snapshot.entries.length, 8);
	for (const [index, node] of roots[0].children.entries()) {
		const [name,,x,y,w,h] = cases[index];
		const rect = snapshot.byId.get(node.id)?.absoluteRect;
		assert.ok(rect, "Missing " + name);
		assert.deepEqual([rect.x, rect.y, rect.width, rect.height], [x,y,w,h], name);
	}
});

test("font-route controls cover Book72, Book24, Light24 and native-default CSS without assuming font paint parity", () => {
	const named = roots[0].children.map(node => Prop(node, "font")).filter(Boolean);
	assert.deepEqual([...new Set(named)].sort(), [
		"gui/fonts/sdf_MetronBook24", "gui/fonts/sdf_MetronBook72",
		"gui/fonts/sdf_MetronLight24"
	].sort());
	assert.equal(named.length, 6);
	assert.equal(Prop(roots[0].children[6], "font"), undefined);
	assert.equal(cases[0][6], cases[1][6]);
	assert.notEqual(cases[0][5], cases[1][5]);
});

test("default and experimental FNT5 route observations remain pending until independently captured", () => {
	const template = JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-route/capture.template.json", import.meta.url
	), "utf8"));
	assert.equal(template.captureKind, "native-font-route-visual-pending");
	assert.deepEqual(template.cases.map(row => row.id), cases.map(row => row[0]));
	assert.equal(template.workbenchVersion, "1.30.164200.56");
	assert.deepEqual(template.studioModes.map(mode => mode.id), ["baseline","standalone-fnt5"]);
	assert.ok(template.cases.every(row =>
		row.workbenchPixels === null && row.studioBaselinePixels === null &&
		row.studioExperimentalPixels === null &&
		row.baselineRoute === null && row.experimentalRoute === null));
	assert.ok(template.studioModes.every(mode => mode.logEvidence === null && mode.visualEvidence === null));
	assert.equal(template.conclusion, "pending");
});
