import test from "node:test";
import assert from "node:assert/strict";
import { FitUnresolvedCssFontSize, ResolveTextStyle } from "../.geometry-engine-test-build/LayoutMath.js";

function Widget(font, extraProperties = []) {
	return {
		id: "font-test", type: "TextWidgetClass", name: "FontTest",
		properties: [
			{ name: "font", value: font },
			...extraProperties
		],
		children: []
	};
}

const Rect = (height) => ({ x: 0, y: 0, width: 300, height });

test("unresolved MetronBook72 nominal 72px size fits short HUD widgets without clipped glyph fragments", () => {
	const widget = Widget("gui/fonts/sdf_MetronBook72");
	const rect = Rect(12);
	const nominal = ResolveTextStyle(widget, rect).fontSize;
	assert.equal(nominal, 72, "preserve author-generator sizing in shared style resolution");
	assert.equal(FitUnresolvedCssFontSize(widget, rect, nominal), 10.8);
	assert.equal(FitUnresolvedCssFontSize(widget, Rect(24), nominal), 21.6);
	assert.equal(FitUnresolvedCssFontSize(widget, Rect(100), nominal), 72);
});

test("unresolved Light24, short controls, and no-font fallbacks use the same generic rule", () => {
	const light = Widget("gui/fonts/sdf_MetronLight24");
	assert.equal(FitUnresolvedCssFontSize(light, Rect(15), ResolveTextStyle(light, Rect(15)).fontSize), 13.5);
	const anonymous = Widget("");
	const inferred = ResolveTextStyle(anonymous, Rect(8)).fontSize;
	assert.equal(inferred, 10);
	assert.equal(FitUnresolvedCssFontSize(anonymous, Rect(8), inferred), 7.2);
});

test("explicit authored sizes are respected even when clipping is intentional", () => {
	for (const property of ["exact text size", "exact size", "fontsize", "font size"]) {
		const widget = Widget("gui/fonts/sdf_MetronBook72", [{ name: property, value: "28" }]);
		assert.equal(ResolveTextStyle(widget, Rect(9)).fontSize, 28);
		assert.equal(FitUnresolvedCssFontSize(widget, Rect(9), 28), 28, property);
	}
});

test("invalid and zero widget heights do not produce arbitrary font sizes", () => {
	const widget = Widget("gui/fonts/sdf_MetronBook72");
	for (const height of [0, -4, NaN, Infinity])
		assert.equal(FitUnresolvedCssFontSize(widget, Rect(height), 72), 72);
	assert.equal(FitUnresolvedCssFontSize(widget, Rect(10), 0), 0);
	assert.equal(FitUnresolvedCssFontSize(widget, Rect(10), NaN), NaN);
});
