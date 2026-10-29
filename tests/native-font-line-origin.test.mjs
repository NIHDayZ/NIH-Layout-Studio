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

test("independent Hg9 holdout supports shared FNT5 origin while preserving native parity limitations", () => {
	const evidence=JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-line-origin/capture.holdout.2026-10-29.json",import.meta.url
	),"utf8"));
	assert.equal(evidence.captureKind,"native-font-shared-origin-Hg9-independent-visual-holdout");
	assert.equal(evidence.layout,"tests/fixtures/native-font-line-origin/NIH_NativeFontBaselineHoldout.layout");
	assert.equal(evidence.comparison.holdoutCases,20);
	assert.equal(evidence.cases.length,20);
	assert.deepEqual(evidence.sources.workbench.rootPixelRect,{x:472,y:134,width:876,height:493});
	assert.deepEqual(evidence.sources.studio.rootPixelRect,{x:308,y:221,width:867,height:488});
	const meanAbs=(values)=>values.reduce((a,b)=>a+Math.abs(b),0)/values.length;
	const current=meanAbs(evidence.cases.map(item=>item.studioTop-item.workbenchTop));
	const projected=meanAbs(evidence.cases.map(item=>item.studioTop-item.workbenchTop+
		(item.id.startsWith("Text") ? item.height*0.08 : item.height*-0.045)));
	assert.ok(Math.abs(current-evidence.comparison.currentMeanAbsGlyphTopError)<1e-9);
	assert.ok(Math.abs(projected-evidence.comparison.projectedLegacyMeanAbsGlyphTopError)<1e-9);
	assert.ok(current<projected*0.55);
	assert.equal(evidence.browserLog.fnt5PlacementRecords,60);
	assert.equal(evidence.browserLog.rawInkOutsideWidgetCount,20);
	assert.equal(evidence.browserLog.outsideWidgetCharacter,"g");
	assert.equal(evidence.disposition.nativePixelParity,"not-established");
	assert.equal(evidence.comparison.nativeRuleRecovered,false);
});
