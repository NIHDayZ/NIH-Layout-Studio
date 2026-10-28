import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const capture=JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-content/capture.runtime.partial.v2.2026-10-28.json",import.meta.url
),"utf8"));
const baseline=capture.cases[0];
const phases=[
	"baseline-1120x460", "short-text-1120x460",
	"restored-1120x460", "baseline-720x460"
];
const absent=[
	"FrameChildTop","FrameChildBottom","PanelChild",
	"VisibleChild","HiddenChild","UpperFrameTop","UpperFrameBottom"
].sort();

test("v2 complete native client probe phases preserve 20/27 observed, not full native parity",()=>{
	assert.equal(capture.captureKind,"native-dayz-client-content-getters-incomplete");
	assert.equal(capture.status,"incomplete-native-capture");
	assert.equal(capture.provenance.gameVersionDefine,"DAYZ_1_30");
	assert.equal(capture.provenance.nativeClientBuild,null);
	assert.equal(capture.expectedWidgetCount,27);
	assert.equal(capture.observedWidgetCount,20);
	assert.deepEqual([...capture.missingWidgetNames].sort(),absent);
	assert.deepEqual(capture.cases.map(x=>x.phase),phases);
	for(const phase of capture.cases) {
		assert.equal(phase.complete,true);
		assert.equal(phase.expectedWidgetCount,27);
		assert.equal(phase.observedWidgetCount,20);
		assert.equal(Object.keys(phase.widgets).length,20);
		assert.equal(Object.keys(phase.lookups).length,11);
		assert.equal(Object.keys(phase.parentChildCounts).length,6);
		assert.deepEqual([...phase.missingWidgetNames].sort(),absent);
	}
});

test("the native widget tree is empty below flagged ordinary Frame/Panel, not a recursive traversal omission",()=>{
	for(const phase of capture.cases) {
		for(const name of ["FrameContentHeight","PanelContentBoth","FrameContentHidden","FrameContentUpper"]) {
			assert.ok(phase.widgets[name],name+" parent exists");
			assert.equal(phase.parentChildCounts[name],0,name+" has no runtime children");
			assert.deepEqual(phase.widgets[name].screenRect,phase.widgets[name].localRect,
				name+" retained authored outer geometry");
		}
		for(const name of absent) {
			assert.equal(phase.lookups[name],false,name+" direct lookup failed");
			assert.equal(phase.widgets[name],undefined,name+" not in traversal");
		}
	}
});

test("fixed Frame and managed WrapSpacer retain two native descendants each",()=>{
	for(const phase of capture.cases) {
		assert.equal(phase.parentChildCounts.FrameFixedControl,2);
		assert.equal(phase.parentChildCounts.WrapContentUpper,2);
		for(const name of ["FixedFrameTop","FixedFrameBottom","WrapItemOne","WrapItemTwo"]) {
			assert.equal(phase.lookups[name],true,name+" direct lookup works");
			assert.ok(phase.widgets[name],name+" traversal works");
		}
		assert.deepEqual(phase.widgets.FrameFixedControl.screenRect,
			{x:500,y:350,width:190,height:20});
		assert.deepEqual(phase.widgets.FixedFrameBottom.screenRect,
			{x:510,y:395,width:90,height:28});
		assert.ok(phase.widgets.FixedFrameBottom.screenRect.y >
			phase.widgets.FrameFixedControl.screenRect.y +
			phase.widgets.FrameFixedControl.screenRect.height,
			"an overhanging descendant survives a fixed Frame");
	}
});

test("native WrapSpacer height grows from authored 20 to child max height 28 in both root sizes",()=>{
	for(const phase of capture.cases) {
		const wrap=phase.widgets.WrapContentUpper;
		assert.deepEqual(wrap.localRect,{x:310,y:350,width:190,height:20});
		assert.deepEqual(wrap.screenRect,{x:310,y:350,width:190,height:28});
		assert.deepEqual(phase.widgets.WrapItemOne.screenRect,
			{x:310,y:350,width:60,height:24});
		assert.deepEqual(phase.widgets.WrapItemTwo.screenRect,
			{x:370,y:350,width:90,height:28});
	}
});

test("native text-to-text behavior is stable across content probe versions and phases",()=>{
	for(const phase of capture.cases) {
		const expectedWidth=phase.phase==="short-text-1120x460"?9:128;
		assert.equal(phase.widgets.TextFixed.textPixels.width,expectedWidth);
		assert.equal(phase.widgets.TextToTextH.textPixels.width,expectedWidth);
		assert.equal(phase.widgets.TextToTextH.screenRect.width,expectedWidth);
		assert.equal(phase.widgets.TextToTextBoth.screenRect.width,expectedWidth);
		assert.equal(phase.widgets.TextToTextV.screenRect.height,16);
		assert.equal(phase.widgets.TextToTextBoth.screenRect.height,16);
		assert.equal(phase.widgets.TextToContentBoth.screenRect.width,220);
		assert.equal(phase.widgets.TextToContentBoth.screenRect.height,36);
	}
	assert.equal(baseline.widgets.TextLongNarrow.textPixels.width,235);
	assert.equal(baseline.widgets.TextLongNarrow.screenRect.width,140);
});
