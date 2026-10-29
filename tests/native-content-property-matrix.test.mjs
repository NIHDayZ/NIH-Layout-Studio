import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	ParseNativePropertyMatrix, EXPECTED_PROPERTY_CASES, EXPECTED_PROPERTY_PHASES
} from "../scripts/extract-workbench-property-matrix.mjs";

const evidence=readFileSync(new URL(
	"./fixtures/workbench-content/capture.property-matrix.native.2026-10-28.log",
	import.meta.url
),"utf8");
const frozen=JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-content/capture.property-matrix.native.2026-10-28.json",
	import.meta.url
),"utf8"));
const parsed=ParseNativePropertyMatrix(evidence,frozen.sourceLog);
const phaseNames=["after-create","post-update","after-resize"];

test("real native property-matrix log independently reconstructs all frozen getter values",()=>{
	assert.equal(frozen.status,"native-diagnostic-not-algorithm-parity");
	assert.equal(frozen.provenance.nativeClientBuild,null);
	assert.equal(frozen.provenance.buildDefine,"DAYZ_1_30");
	assert.deepEqual(phaseNames,EXPECTED_PROPERTY_PHASES);
	assert.deepEqual(parsed.phases,frozen.phases);
	assert.deepEqual(parsed.requests,frozen.requests);
	assert.equal(frozen.expectedCaseCount,14);
	for(const phase of frozen.phases) {
		assert.equal(phase.complete,true);
		assert.deepEqual(Object.keys(phase.cases),EXPECTED_PROPERTY_CASES);
		for(const [name,item] of Object.entries(phase.cases)) {
			assert.equal(item.parentPresent,true,name);
			assert.deepEqual(item.localSize,{width:190,height:20},name);
			assert.equal(item.topFound,item.bottomFound,name);
			assert.equal(item.childCount,item.topFound?2:0,name);
		}
	}
});

test("native Frame and Panel subtree omission correlates with property PRESENCE, even when its value is zero",()=>{
	const suppressed=[
		"PFrameFlagZero","PFrameFlagOne","PFrameHorizontalOne",
		"PFrameBothOne","PFrameTextOne",
		"PPanelFlagZero","PPanelFlagOne","PPanelHorizontalOne"
	];
	for(const phase of frozen.phases) {
		for(const name of suppressed) {
			const entry=phase.cases[name];
			assert.equal(entry.parentPresent,true,phase.phase+"/"+name);
			assert.equal(entry.childCount,0,phase.phase+"/"+name);
			assert.equal(entry.topFound,false,phase.phase+"/"+name);
			assert.equal(entry.bottomFound,false,phase.phase+"/"+name);
			assert.equal(entry.screenSize.height,20,phase.phase+"/"+name);
		}
		for(const name of ["PFrameNoFlag","PFrameClipped","PPanelNoFlag"]) {
			const entry=phase.cases[name];
			assert.equal(entry.childCount,2,phase.phase+"/"+name);
			assert.equal(entry.topFound,true,phase.phase+"/"+name);
			assert.equal(entry.bottomFound,true,phase.phase+"/"+name);
		}
	}
});

test("native subtree divergence occurs immediately after CreateWidgets, not during Update or viewport resize",()=>{
	for(const name of EXPECTED_PROPERTY_CASES) {
		const before=frozen.phases[0].cases[name];
		for(const later of frozen.phases.slice(1)) {
			const after=later.cases[name];
			assert.equal(after.parentPresent,before.parentPresent,name);
			assert.equal(after.childCount,before.childCount,name);
			assert.equal(after.topFound,before.topFound,name);
			assert.equal(after.bottomFound,before.bottomFound,name);
			assert.deepEqual(after.screenSize,before.screenSize,name);
			assert.deepEqual(after.localSize,before.localSize,name);
		}
	}
	assert.deepEqual(frozen.phases.map(x=>x.rootScreenSize),[
		{width:1920,height:1080},{width:1120,height:720},{width:1120,height:620}
	]);
});

test("WrapSpacer children survive property absent/zero/one and only enabled sizing grows to 28 in this fixture",()=>{
	for(const phase of frozen.phases) {
		for(const name of ["PWrapNoFlag","PWrapFlagZero","PWrapFlagOne"]) {
			const entry=phase.cases[name];
			assert.equal(entry.childCount,2);
			assert.equal(entry.topFound,true);
			assert.equal(entry.bottomFound,true);
			assert.equal(entry.screenSize.width,190);
			assert.equal(entry.localSize.height,20);
		}
		assert.equal(phase.cases.PWrapNoFlag.screenSize.height,20);
		assert.equal(phase.cases.PWrapFlagZero.screenSize.height,20);
		assert.equal(phase.cases.PWrapFlagOne.screenSize.height,28);
	}
});
