import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const capture=JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-content/capture.runtime.partial.2026-10-28.json",import.meta.url
),"utf8"));
const original=capture.phases[0].widgets;
const short=capture.phases[1].widgets;
const restored=capture.phases[2].widgets;
const small=capture.phases[3].widgets;
const texts=["TextFixed","TextToTextH","TextToTextV","TextToTextBoth","TextToContentBoth"];

test("real native content probe has all four phases but incomplete descendants, never full parity",()=>{
	assert.equal(capture.schemaVersion,1);
	assert.equal(capture.captureKind,"native-dayz-client-content-getters-incomplete");
	assert.equal(capture.gameClientBuild,null);
	assert.equal(capture.inspectionStatus,"partial-valid-native-observations-not-full-fixture");
	assert.equal(capture.phases.length,4);
	assert.equal(capture.expectedWidgetCount,18);
	assert.equal(capture.observedWidgetCount,13);
	assert.deepEqual([...capture.missingWidgets].sort(),[
		"FrameChildBottom","FrameChildTop","HiddenChild","PanelChild","VisibleChild"
	].sort());
	for (const phase of capture.phases) {
		assert.equal(phase.complete,true,"BEGIN and END are independent from widget completeness");
		assert.equal(phase.observedWidgetCount,13);
		assert.deepEqual(Object.keys(phase.widgets),Object.keys(original));
		for (const missing of capture.missingWidgets)
			assert.equal(phase.widgets[missing],undefined);
	}
});

test("native horizontal size-to-text equals measured GetTextSize width, preserving authored getter values",()=>{
	for (const phase of capture.phases) {
		for (const name of ["TextToTextH","TextToTextBoth"]) {
			const item=phase.widgets[name];
			assert.equal(item.screenRect.width,item.textPixels.width,name+"/"+phase.phase);
			assert.equal(item.localRect.width,220,name+" retains authored GetSize width");
		}
		const fixed=phase.widgets.TextFixed;
		assert.equal(fixed.screenRect.width,220);
		assert.equal(fixed.localRect.width,220);
		const content=phase.widgets.TextToContentBoth;
		assert.equal(content.screenRect.width,220,"not enough to claim native content-width policy");
	}
	assert.equal(original.TextToTextH.textPixels.width,128);
	assert.equal(short.TextToTextH.textPixels.width,9);
	assert.equal(restored.TextToTextH.textPixels.width,128);
	assert.equal(small.TextToTextH.textPixels.width,128);
});

test("native vertical size-to-text equals measured GetTextSize height without altering authored GetSize",()=>{
	for (const phase of capture.phases) {
		for (const name of ["TextToTextV","TextToTextBoth","TextLongNarrow"]) {
			const item=phase.widgets[name];
			assert.equal(item.screenRect.height,item.textPixels.height,name+"/"+phase.phase);
			assert.equal(item.localRect.height,36);
		}
		assert.equal(phase.widgets.TextToTextH.screenRect.height,36);
		assert.equal(phase.widgets.TextFixed.screenRect.height,40);
	}
});

test("native GetTextSize and widget screen geometry are independently reported, not interchanged",()=>{
	for (const name of texts) {
		assert.equal(original[name].textPixels.width,128);
		assert.equal(short[name].textPixels.width,9);
		assert.equal(restored[name].textPixels.width,128);
		assert.equal(small[name].textPixels.width,128);
		assert.equal(original[name].textPixels.height,16);
	}
	assert.equal(original.TextLongNarrow.textPixels.width,235);
	assert.equal(original.TextLongNarrow.screenRect.width,140);
	assert.equal(original.TextLongNarrow.screenRect.height,16);
	assert.ok(original.TextLongNarrow.textPixels.width>original.TextLongNarrow.screenRect.width,
		"this fixture does not prove wrapped text heights");
});

test("image and Frame/Panel outer rectangles stayed authored in this incomplete capture",()=>{
	const unaffected=["ImageFixed","ImageContentBoth","ImageContentWide",
		"FrameContentHeight","PanelContentBoth","FrameContentHidden"];
	for (const phase of capture.phases) {
		for (const name of unaffected) {
			const widget=phase.widgets[name];
			assert.deepEqual(widget.screenRect,widget.localRect,name+"/"+phase.phase);
		}
	}
	assert.deepEqual(small.NIHContentParity.screenRect,
		{x:0,y:0,width:720,height:460});
	assert.equal(small.widgets.NIHContentParity.localRect.width,0.375);
	assert.equal(original.NIHContentParity.localRect.width,0.583333);
});
