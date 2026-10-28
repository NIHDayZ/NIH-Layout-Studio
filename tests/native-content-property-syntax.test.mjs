import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	ParseNativePropertySyntax, EXPECTED_SYNTAX_CASES, EXPECTED_SYNTAX_PHASES
} from "../scripts/extract-workbench-property-syntax.mjs";

const raw=readFileSync(new URL(
	"./fixtures/workbench-content/capture.property-syntax.native.2026-10-28.log",
	import.meta.url
),"utf8");
const captured=JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-content/capture.property-syntax.native.2026-10-28.json",
	import.meta.url
),"utf8"));
const parsed=ParseNativePropertySyntax(raw,captured.sourceLog);

const beforeUnsupported=[
	"FrameContentBefore0","FrameUnknownBefore0",
	"PanelContentBefore0","PanelUnknownBefore0"
];
const retained=[
	"FrameBase","FrameContentAfter0","FrameUnknownAfter0",
	"FrameClipBefore1","FrameClipAfter1",
	"PanelBase","PanelContentAfter0","PanelUnknownAfter0"
];

test("real independent native syntax log reproduces all 24 frozen getter records exactly",()=>{
	assert.equal(captured.captureKind,"dayz-native-layout-property-syntax");
	assert.equal(captured.status,"native-loader-syntax-diagnostic-not-cpp-parser-proof");
	assert.equal(captured.nativeClientBuild,null);
	assert.equal(captured.provenance.nativeClientBuild,null);
	assert.equal(captured.provenance.gameScriptDefine,"DAYZ_1_30");
	assert.equal(captured.expectedCaseCount,12);
	assert.equal(parsed.expectedCaseCount,12);
	assert.deepEqual(Object.keys(parsed.cases),EXPECTED_SYNTAX_CASES);
	assert.deepEqual(parsed.cases,captured.cases);
	assert.deepEqual(EXPECTED_SYNTAX_PHASES,["after-create","post-update"]);
});

test("ordinary Frame/Panel with unsupported-looking attribute BEFORE child group have no native descendants",()=>{
	for(const name of beforeUnsupported) {
		for(const phase of EXPECTED_SYNTAX_PHASES) {
			const c=captured.cases[name][phase];
			assert.equal(c.rootPresent,true,name);
			assert.equal(c.parentPresent,true,name);
			assert.equal(c.childCount,0,name+"/"+phase);
			assert.equal(c.topFound,false,name+"/"+phase);
			assert.equal(c.bottomFound,false,name+"/"+phase);
			assert.deepEqual(c.screenSize,{width:190,height:20},name+"/"+phase);
			assert.deepEqual(c.localSize,{width:190,height:20},name+"/"+phase);
		}
	}
});

test("moving the SAME unsupported-looking attribute AFTER children preserves both descendants on Frame/Panel",()=>{
	for(const name of retained) {
		for(const phase of EXPECTED_SYNTAX_PHASES) {
			const c=captured.cases[name][phase];
			assert.equal(c.rootPresent,true,name);
			assert.equal(c.parentPresent,true,name);
			assert.equal(c.childCount,2,name+"/"+phase);
			assert.equal(c.topFound,true,name+"/"+phase);
			assert.equal(c.bottomFound,true,name+"/"+phase);
			assert.deepEqual(c.screenSize,{width:190,height:20},name+"/"+phase);
			assert.deepEqual(c.localSize,{width:190,height:20},name+"/"+phase);
		}
	}
});

test("recognized clipchildren before/after leaves both children, excluding ordinary clipping as the explanation",()=>{
	for(const name of ["FrameClipBefore1","FrameClipAfter1"])
		assert.equal(captured.cases[name]["after-create"].childCount,2);
	assert.equal(captured.cases.FrameContentBefore0["after-create"].childCount,0);
	assert.equal(captured.cases.FrameContentAfter0["after-create"].childCount,2);
	assert.equal(captured.cases.FrameUnknownBefore0["after-create"].childCount,0);
	assert.equal(captured.cases.FrameUnknownAfter0["after-create"].childCount,2);
});

test("property-order hierarchy behavior precedes Update and remains stable after it",()=>{
	for(const name of EXPECTED_SYNTAX_CASES) {
		assert.deepEqual(
			captured.cases[name]["after-create"],
			captured.cases[name]["post-update"],
			name
		);
	}
	assert.equal(raw.split("\n").filter(line=>
		line.includes("[NIH_LayoutStudio][SyntaxProbe]")).length,50);
});
