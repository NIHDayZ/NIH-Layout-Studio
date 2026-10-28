import test from "node:test";
import assert from "node:assert/strict";
import { SelectWorkbenchControlFontSize } from "../.grid-layout-test-build/ControlFontSizing.js";

test("60px MetronBook buttons use the shipped 58px font tier", () => {
	assert.equal(SelectWorkbenchControlFontSize("gui/fonts/MetronBook", 60), 58);
});

test("small MetronBook controls use the corresponding font tiers", () => {
	assert.equal(SelectWorkbenchControlFontSize("gui/fonts/MetronBook", 40), 28);
	assert.equal(SelectWorkbenchControlFontSize("gui/fonts/MetronBook", 22), 22);
	assert.equal(SelectWorkbenchControlFontSize("gui/fonts/MetronBook", 14), 14);
});

test("case, slash style and supported font variants are normalized", () => {
	assert.equal(SelectWorkbenchControlFontSize("GUI\\fonts\\MetronBook-Bold", 60), 58);
	assert.equal(SelectWorkbenchControlFontSize('"gui/fonts/MetronLight"', 48), 48);
});

test("unknown fonts and invalid heights retain existing fallback sizing", () => {
	assert.equal(SelectWorkbenchControlFontSize("mod/fonts/Custom", 60), null);
	assert.equal(SelectWorkbenchControlFontSize("gui/fonts/MetronBook", 0), null);
	assert.equal(SelectWorkbenchControlFontSize(undefined, 60), null);
});
