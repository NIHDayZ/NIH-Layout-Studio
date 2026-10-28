import test from "node:test";
import assert from "node:assert/strict";
import { ParseNativeContentProbe, EXPECTED_CONTENT_PHASES, EXPECTED_CONTENT_WIDGETS } from "../scripts/extract-workbench-content.mjs";

const prefix="[NIH_LayoutStudio][ContentProbe]";
function MakeSample({missingPhase=false,missingText=false,duplicate=false,hasError=false}={}) {
	const lines=["13:04:00 SCRIPT : "+prefix+" REQUEST viewport=1120,460"];
	for(const [index,phase] of EXPECTED_CONTENT_PHASES.entries()) {
		if(missingPhase&&index===3)
			break;
		lines.push("13:04:01 SCRIPT : "+prefix+" BEGIN "+phase);
		for(const name of EXPECTED_CONTENT_WIDGETS) {
			let type="PanelWidget";
			if (name==="NIHContentParity" || name.startsWith("Frame"))
				type="FrameWidget";
			else if (name.startsWith("Text"))
				type="TextWidget";
			else if (name.startsWith("Image"))
				type="ImageWidget";
			let rect="0,0,100,40";
			if (name==="NIHContentParity")
				rect="0,0,1120,460";
			else if (name==="TextFixed")
				rect="20,20,220,40";
			else if (name==="ImageFixed")
				rect="330,20,90,55";
			lines.push("13:04:01 SCRIPT : "+prefix+" phase="+phase+" name="+name+" type="+type+" screenRect="+rect);
			lines.push("13:04:01 SCRIPT : "+prefix+" phase="+phase+" name="+name+" localRect=0,0,1,1 flags=1024 selfVisible=1");
			if(type==="TextWidget"&&!missingText)
				lines.push("13:04:01 SCRIPT : "+prefix+" phase="+phase+" name="+name+" textPixels=112,16");
		}
		if(duplicate&&index===0)
			lines.push("13:04:01 SCRIPT : "+prefix+" phase="+phase+" name=TextFixed textPixels=112,16");
		lines.push("13:04:01 SCRIPT : "+prefix+" END "+phase);
	}
	if(hasError)
		lines.push("13:04:02 SCRIPT : "+prefix+" ERROR: missing font resource");
	return lines.join("\n")+"\n";
}

test("native content parser preserves independent widget and text pixel getters without inferring intrinsic image size",()=>{
	const parsed=ParseNativeContentProbe(MakeSample(),"script_2026-10-28.log");
	assert.equal(parsed.schemaVersion,1);
	assert.equal(parsed.nativeClientBuild,null);
	assert.equal(parsed.status,"captured-unversioned-not-native-parity");
	assert.deepEqual(parsed.cases.map(item=>item.phase),EXPECTED_CONTENT_PHASES);
	assert.equal(parsed.cases.length,4);
	assert.equal(EXPECTED_CONTENT_WIDGETS.length,18);
	assert.equal(Object.keys(parsed.cases[0].widgets).length,18);
	assert.equal(parsed.cases[0].widgets.TextFixed.textPixels.width,112);
	assert.equal(parsed.cases[0].widgets.TextFixed.textPixels.height,16);
	assert.deepEqual(parsed.cases[0].widgets.TextFixed.screenRect,{x:20,y:20,width:220,height:40});
	assert.equal(parsed.cases[0].widgets.ImageFixed.textPixels,undefined);
	assert.equal(parsed.cases[0].widgets.ImageFixed.screenRect.width,90);
	assert.ok(parsed.notes.includes("not evidence of imageset intrinsic"));
});

test("a fixture widget missing from every phase still rejects the native capture",()=>{
	const missing=MakeSample().split("\\n").filter(line=>!line.includes("name=FrameChildBottom ")).join("\\n");
	assert.throws(()=>ParseNativeContentProbe(missing),/Missing or extra fixture widget records/);
});

test("missing capture phase, native getter, duplicate record or reported probe ERROR rejects whole capture",()=>{
	assert.throws(()=>ParseNativeContentProbe(MakeSample({missingPhase:true})),/Missing or unordered/);
	assert.throws(()=>ParseNativeContentProbe(MakeSample({missingText:true})),/Incomplete native getter records/);
	assert.throws(()=>ParseNativeContentProbe(MakeSample({duplicate:true})),/Duplicate textPixels/);
	assert.throws(()=>ParseNativeContentProbe(MakeSample({hasError:true})),/probe error/);
});

test("parser rejects overflowing, nonfinite and negative native measurement values",()=>{
	const good=MakeSample();
	assert.throws(()=>ParseNativeContentProbe(good.replace("20,20,220,40","20,NaN,220,40")),/Malformed native getter/);
	assert.throws(()=>ParseNativeContentProbe(good.replace("112,16","-1,16")),/Negative native text pixel size/);
	assert.throws(()=>ParseNativeContentProbe(good.replace("330,20,90,55","330,20,Infinity,55")),/Malformed native getter/);
	assert.throws(()=>ParseNativeContentProbe(good.replace("localRect=0,0,1,1","localRect=0,0,NaN,1")),/Malformed native getter/);
});

test("out-of-order, unclosed and mixed-phase records are not silently accepted",()=>{
	const good=MakeSample();
	assert.throws(()=>ParseNativeContentProbe(good.replace(
		"BEGIN baseline-1120x460","BEGIN baseline-720x460"
	)),/outside active phase|Unexpected|Missing or unordered/);
	assert.throws(()=>ParseNativeContentProbe(good.replace(
		"END baseline-720x460","END other"
	)),/Unexpected native capture END/);
	assert.throws(()=>ParseNativeContentProbe(good.replace(
		"END baseline-720x460",""
	)),/Unclosed native content capture/);
});
