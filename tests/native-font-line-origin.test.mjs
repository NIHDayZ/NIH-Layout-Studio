import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ResolveExperimentalFnt5LineOrigin } from "../.geometry-engine-test-build/Fnt5LineOriginExperiment.js";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";

test("default font baseline is unchanged without the research switch", () => {
	for(const base of [0,-3,-4.25,-8.5,-13.75])
		assert.equal(ResolveExperimentalFnt5LineOrigin(null,110,base,true,1),base);
});

test("shared FNT5 origin aligns TextWidget and ButtonWidget without per-font conditionals", () => {
	for(const height of [24,34,68,110]) {
		const target=-height*.08;
		assert.ok(Math.abs(ResolveExperimentalFnt5LineOrigin("0.08",height,0,true,1)-target)<1e-10);
		assert.ok(Math.abs(ResolveExperimentalFnt5LineOrigin("0.08",height,-height*.125,true,1)-target)<1e-10);
	}
});

test("multi-line, non-FNT5, invalid and out-of-range conditions retain their existing origin", () => {
	for(const mode of [null,"","bogus","-1","0.26","Infinity"]) {
		assert.equal(ResolveExperimentalFnt5LineOrigin(mode,68,-8.5,true,1),-8.5);
	}
	assert.equal(ResolveExperimentalFnt5LineOrigin("0.08",68,-8.5,true,2),-8.5);
	assert.equal(ResolveExperimentalFnt5LineOrigin("0.08",68,-8.5,false,1),-8.5);
	assert.equal(ResolveExperimentalFnt5LineOrigin("0.08",0,0,true,1),0);
});

test("diagnostic FNT5 dedup includes penX as well as baseY", () => {
	const source=readFileSync(new URL("../src/project/SdfTextCanvas.tsx",import.meta.url),"utf8");
	assert.ok(source.includes("widgetWidth, widgetHeight, baseY, penX]"));
	assert.ok(source.includes("ResolveExperimentalFnt5LineOrigin(experimentalFnt5LineOrigin, height, baseY, !!resource.fnt5PixelMetrics, lines.length)"));
});

test("holdout changes only glyph text, not the native-valid 20-widget layout", () => {
	const raw=readFileSync(new URL("./fixtures/native-font-line-origin/NIH_NativeFontBaselineHoldout.layout",import.meta.url),"utf8");
	const roots=new LayoutParser().Parse(raw).roots;
	assert.equal(roots.length,1);
	assert.equal(roots[0].name,"NIHNativeFontBaselineHoldout");
	assert.equal(roots[0].children.length,20);
	assert.ok(roots[0].children.every(node=>node.properties.some(p=>p.name.toLowerCase()==="text"&&p.value==="Hg9")));
	assert.equal(raw.includes('"text valign"'),false);
});

test("holdout contains no invented native baseline measurements", () => {
	const obs=JSON.parse(readFileSync(new URL("./fixtures/native-font-line-origin/capture.template.json",import.meta.url),"utf8"));
	assert.equal(obs.nativeRuleConfirmed,false);
	assert.equal(obs.cases.length,20);
	assert.ok(obs.cases.every(v=>v.result==="pending"&&v.nativeInkBounds===null&&v.studioInkBounds===null));
});
