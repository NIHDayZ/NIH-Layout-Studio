import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";

const source = readFileSync(
	new URL("./fixtures/workbench-grid/runtime-mod/NIH_GridMeasurementRuntime.c", import.meta.url), "utf8"
);
const fixture = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Panel_Style_Comparison.layout", import.meta.url), "utf8"
);
const staging = readFileSync(
	new URL("./fixtures/workbench-grid/runtime-mod/Prepare-GridProbe.ps1", import.meta.url), "utf8"
);
const root = new LayoutParser().Parse(fixture).roots[0];
const names = new Set();
function Visit(node) {
	names.add(node.name);
	for (const child of node.children)
		Visit(child);
}
Visit(root);

test("Phase 2T native probe captures only 18 actual panel names without IDs", () => {
	const start = source.indexOf("\tprotected void StartPanelStyleProbe()");
	const end = source.indexOf("\tprotected void CaptureComplex(string phase)", start);
	assert.ok(start > 0 && end > start);
	const block = source.slice(start, end);
	const selections = [...block.matchAll(/CapturePanelStyleWidget\("([^"]+)", phase\);/g)]
		.map(match => match[1]);
	assert.equal(selections.length, 18);
	assert.equal(new Set(selections).size, 18);
	for (const name of selections)
		assert.ok(names.has(name), "missing native widget " + name);
	assert.equal(selections.filter(name => name.startsWith("QTBackdrop")).length, 2);
	assert.equal(selections.filter(name => name.includes("Plain")).length, 8);
	assert.equal(selections.filter(name => name.includes("Styled")).length, 8);
	assert.ok(block.includes("after-create"));
	assert.ok(block.includes("post-update"));
	assert.ok(!block.includes("GetUserID("));
	assert.ok(!block.includes("FindAnyWidgetById("));
	assert.ok(staging.includes("NIH_Panel_Style_Comparison.layout"));
});

test("Phase 2T native state probe reads style, color, alpha and flags without mutation", () => {
	assert.ok(source.includes("CallLater(StartPanelStyleProbe, 900, false)"));
	const start = source.indexOf("\tprotected void StartPanelStyleProbe()");
	const end = source.indexOf("\tprotected void CaptureComplex(string phase)", start);
	const block = source.slice(start, end);
	for (const getter of [
		"widget.GetStyleName()", "widget.GetColor()", "widget.GetAlpha()",
		"widget.GetFlags()", "widget.GetTypeName()", "widget.IsVisible()"
	])
		assert.ok(block.includes(getter), getter + " missing");
	for (const change of [".SetFlags(", ".ClearFlags(", ".SetColor(", ".SetAlpha(", ".SetScreenSize(", ".SetSize("])
		assert.equal(block.includes(change), false, "read-only probe must not use " + change);
	assert.ok(block.includes("m_PanelStyleRoot.Update()"));
	assert.ok(source.includes("CallLater(StartColorFlagProbe, 1800, false)"),
		"old geometry and color research sequence must remain in place");
	assert.ok(block.includes('[NIH_LayoutStudio][PanelStyleProbe]'));
});
