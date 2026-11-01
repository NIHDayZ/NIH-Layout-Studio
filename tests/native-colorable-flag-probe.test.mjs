import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";

const fixture = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Panel_Background_Calibration.layout", import.meta.url), "utf8"
);
const script = readFileSync(
	new URL("./fixtures/workbench-grid/runtime-mod/NIH_GridMeasurementRuntime.c", import.meta.url), "utf8"
);
const root = new LayoutParser().Parse(fixture).roots[0];
const allNames = new Set();
function Visit(node) {
	allNames.add(node.name);
	for (const child of node.children)
		Visit(child);
}
Visit(root);

test("Phase 2S probes only native-existing color widgets without requiring widget IDs", () => {
	const methods = [...script.matchAll(/CaptureColorWidget\(m_ColorRoot, "([^"]+)", phase\);/g)];
	assert.equal(methods.length, 10);
	assert.equal(new Set(methods.map(match => match[1])).size, 10);
	for (const item of methods)
		assert.ok(allNames.has(item[1]), item[1] + " missing from native calibration layout");
	assert.ok(!script.includes("FindAnyWidgetById("));
	assert.ok(!script.includes("GetUserID("));
	assert.ok(script.includes("CallLater(StartColorFlagProbe, 1800, false)"));
	assert.ok(script.includes("g_Game.GetWorkspace().CreateWidgets(\"NIH_GridMeasurementProbe/gui/layouts/NIH_Panel_Background_Calibration.layout\")"));
});

test("Phase 2S captures native rendering state without modifying widgets or prior grid geometry", () => {
	const start = script.indexOf("\tprotected void StartColorFlagProbe()");
	const end = script.indexOf("\tprotected void CaptureComplex(string phase)", start);
	assert.ok(start > 0 && end > start);
	const block = script.slice(start, end);
	for (const getter of [
		"widget.GetFlags()", "widget.GetColor()", "widget.GetAlpha()",
		"widget.GetStyleName()", "widget.GetTypeName()", "widget.IsVisible()"
	])
		assert.ok(block.includes(getter), getter + " missing");
	for (const name of ["SOURCEALPHA", "BLEND", "ADDITIVE", "NOFILTER"])
		assert.ok(block.includes("WidgetFlags." + name));
	for (const mutation of [".SetFlags(", ".ClearFlags(", ".SetColor(", ".SetAlpha(", ".SetSize(", ".SetScreenSize("])
		assert.equal(block.includes(mutation), false, "the research flag reader must not mutate state: " + mutation);
	assert.ok(script.includes('Print("[NIH_LayoutStudio][GridProbe] BEGIN " + phase)'));
	assert.ok(block.includes('Print("[NIH_LayoutStudio][ColorFlagProbe] BEGIN " + phase)'));
});
