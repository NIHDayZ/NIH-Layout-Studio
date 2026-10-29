import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const source = readFileSync(new URL(
	"./fixtures/native-font-default-baseline/NIH_NativeFontDefaultBaseline.layout", import.meta.url
), "utf8");
const root = new LayoutParser().Parse(source).roots;
const groups = [
	["TextBook72","TextWidgetClass","gui/fonts/sdf_MetronBook72",65],
	["TextBook24","TextWidgetClass","gui/fonts/sdf_MetronBook24",195],
	["TextLight24","TextWidgetClass","gui/fonts/sdf_MetronLight24",325],
	["ButtonBook72","ButtonWidgetClass","gui/fonts/sdf_MetronBook72",455],
	["ButtonBook24","ButtonWidgetClass","gui/fonts/sdf_MetronBook24",585]
];
const heights=[24,34,68,110];
const xs=[40,350,660,970];
function Prop(node, name) {
	return node.properties.find(property=>property.name.toLowerCase()===name)?.value;
}

test("native baseline fixture has 20 Text/Button samples without unverified explicit text alignment", () => {
	assert.equal(root.length,1);
	assert.equal(root[0].name,"NIHNativeFontDefaultBaseline");
	assert.equal(root[0].children.length,20);
	assert.equal(source.includes('"text valign"'),false);
	assert.equal(source.includes('"text halign"'),false);
	for(let r=0;r<groups.length;++r) {
		for(let c=0;c<heights.length;++c) {
			const node=root[0].children[r*4+c];
			assert.equal(node.name,groups[r][0]+"_H"+heights[c]);
			assert.equal(node.type,groups[r][1]);
			assert.equal(Prop(node,"font"),groups[r][2]);
			assert.equal(Prop(node,"text"),"ABC");
			assert.equal(Prop(node,"text valign"),undefined);
			assert.equal(Prop(node,"text halign"),undefined);
		}
	}
});

test("height-only variation preserves independently authored geometry in all 20 samples", () => {
	const snapshot=BuildAuthoredGeometrySnapshot(root,{x:0,y:0,width:1280,height:720});
	assert.deepEqual(snapshot.issues,[]);
	assert.equal(snapshot.entries.length,21);
	for(let r=0;r<groups.length;++r) {
		for(let c=0;c<heights.length;++c) {
			const node=root[0].children[r*4+c];
			assert.deepEqual(snapshot.byId.get(node.id)?.absoluteRect,
				{x:xs[c],y:groups[r][3],width:270,height:heights[c]});
		}
	}
});

test("source evidence marks previous explicit-valign native capture invalid without altering the original fixture", () => {
	const evidence=JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-default-baseline/rejected-valign.2026-10-29.json",import.meta.url
	),"utf8"));
	assert.equal(evidence.captureKind,"rejected-native-text-valign-visual-fixture");
	assert.equal(evidence.observedNativeErrors.property,"text valign");
	assert.equal(evidence.observedNativeErrors.explicitPropertyOccurrencesInSource,15);
	assert.equal(evidence.conclusion.explicitAlignmentNativeParity,"invalid-capture");
	assert.equal(evidence.conclusion.studioVerticalAlignmentPolicy,"not-validated-for-native");
	assert.equal(evidence.conclusion.workbenchVersionGeneralization,"not-established");
	assert.ok(evidence.nativeScreenshot.sha256 && evidence.studioScreenshot.sha256);
});

test("native default font ink template is incomplete until paired native captures are measured", () => {
	const capture=JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-default-baseline/capture.template.json",import.meta.url
	),"utf8"));
	assert.equal(capture.captureKind,"native-font-default-baseline-pending");
	assert.equal(capture.nativePaintVerified,false);
	assert.equal(capture.cases.length,20);
	assert.deepEqual(capture.cases.map(c=>c.id),root[0].children.map(n=>n.name));
	assert.ok(capture.cases.every(c=>c.workbenchInkBounds===null &&
		c.studioInkBounds===null && c.result==="pending"));
});

test("paired default FNT5 baseline capture reveals common native Text and Button ink origins, unlike Studio", () => {
	const capture=JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-default-baseline/capture.visual.2026-10-29.json",import.meta.url
	),"utf8"));
	assert.equal(capture.captureKind,"native-font-default-workbench-studio-20case-visual");
	assert.equal(capture.cases.length,20);
	assert.equal(capture.matchedNativeTextButton.length,8);
	assert.equal(capture.conclusions.strictPixelParity,"not established");
	assert.equal(capture.conclusions.globalNativeGlyphBaselineFormula,"not recovered");
	assert.equal(capture.conclusions.regressionSuiteAfterScreenshot,"not supplied");
	assert.ok(capture.cases.every(item=>item.id && item.native.inkWidth>0 && item.studio.inkWidth>0));
	for (const item of capture.matchedNativeTextButton) {
		assert.ok(Math.abs(item.nativeTextVsButtonTop)<1,item.font+" "+item.height);
	}
	assert.ok(capture.cases.filter(item=>item.widgetType==="TextWidget").every(item=>item.deltaTop>1));
	const book72= capture.cases.filter(item=>item.widgetType==="ButtonWidget" && item.font==="sdf_MetronBook72");
	assert.ok(book72.every(item=>Math.abs(item.deltaTop)<2));
	const book24= capture.cases.filter(item=>item.widgetType==="ButtonWidget" && item.font==="sdf_MetronBook24");
	assert.ok(book24.every(item=>item.deltaTop<0));
});

test("default baseline console confirms twenty SDF widgets but placement dedup loses Button baselines", () => {
	const evidence=JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-default-baseline/capture.console.2026-10-29.json",import.meta.url
	),"utf8"));
	assert.equal(evidence.captureKind,"native-font-default-studio-console-observation");
	assert.equal(evidence.indexing.eddsDecoded,203);
	assert.equal(evidence.indexing.eddsFailed,0);
	assert.equal(evidence.textRoutes.count,20);
	assert.equal(evidence.textRoutes.route,"SDF");
	assert.equal(evidence.sdfWidgets.count,20);
	assert.equal(evidence.sdfWidgets.placementMode,"bearing");
	assert.equal(evidence.sdfWidgets.experimentalMsdf,true);
	assert.deepEqual(evidence.sdfWidgets.requestedSizeByEachRow,[24,34,68,110]);
	assert.equal(evidence.placementLogs.count,36);
	assert.deepEqual(evidence.placementLogs.allBaseY,0);
	assert.equal(evidence.conclusions.textVsButtonPlacementInstrumented,"not-yet-complete");
	assert.equal(evidence.conclusions.nativeVerticalAlignmentModel,"not-yet-recovered");
	assert.equal(evidence.conclusions.fullRegressionAndBuildFromThisLog,"not-present");
});

test("debug FNT5 placement dedup distinguishes same font and size with different baseline origins", () => {
	const source=readFileSync(new URL("../src/project/SdfTextCanvas.tsx",import.meta.url),"utf8");
	assert.match(source,
		/JSON\.stringify\(\[ResourceId\(resource\), glyph\.codePoint, mode, requestedFontSize, widgetWidth, widgetHeight, baseY\]\)/);
	assert.match(source,/widgetSize: \[width, height\], hAlign, vAlign, debugExpandedCanvas:/);
	// Only log-key/fields are under test. Glyph draw position and native baseline parity are unchanged.
});

test("instrumented Text and Button FNT5 placements confirm split baseline and preserve shared-origin hypothesis as unverified", () => {
	const observation=JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-default-baseline/capture.instrumentation.2026-10-29.json",import.meta.url
	),"utf8"));
	assert.equal(observation.captureKind,"paired-font-baseline-instrumentation-and-shared-origin-hypothesis");
	assert.equal(observation.log.placementRecords,60);
	assert.equal(observation.log.textPlacements,36);
	assert.equal(observation.log.buttonPlacements,24);
	assert.deepEqual(observation.log.textBaseYByHeight,[0,0,0,0]);
	assert.deepEqual(observation.log.buttonBaseYByHeight,[-3,-4.25,-8.5,-13.75]);
	assert.equal(observation.log.sdfWidgetRecords,20);
	assert.equal(observation.log.atlasDecodes.failed,0);
	const capture=JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-default-baseline/capture.visual.2026-10-29.json",import.meta.url
	),"utf8"));
	assert.equal(capture.cases.length,observation.log.pairedMeasurements.caseCount);
	const mean=(a)=>a.reduce((sum,value)=>sum+value,0)/a.length;
	const oldError=mean(capture.cases.map(item=>Math.abs(item.deltaTop)));
	const error=(ratio)=>mean(capture.cases.map(item=>{
		const oldBaseY=item.widgetType==="TextWidget"?0:-item.widgetHeight*0.125;
		const newBaseY=-item.widgetHeight*ratio;
		return Math.abs(item.deltaTop+newBaseY-oldBaseY);
	}));
	assert.ok(Math.abs(oldError-observation.log.pairedMeasurements.existingMeanAbsVerticalError)<1e-9);
	for(const candidate of observation.log.pairedMeasurements.hypotheticalSharedOriginRatios)
		assert.ok(Math.abs(error(candidate.ratio)-candidate.meanAbsVerticalError)<1e-9);
	assert.ok(error(0.08)<oldError*.4);
	assert.equal(observation.log.pairedMeasurements.independentValidation,false);
	assert.equal(observation.result.nativeLineOriginExactFormulaRecovered,false);
});
