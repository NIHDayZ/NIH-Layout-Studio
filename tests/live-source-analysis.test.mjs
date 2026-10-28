import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { InspectNativePropertyCompatibility } from "../.geometry-engine-test-build/NativePropertyCompatibility.js";

const File=(name)=>readFileSync(new URL(
	"./fixtures/workbench-content/syntax-matrix/"+name+".layout",import.meta.url
),"utf8");

test("formatting analyzer reuses exactly one current SOURCE parse and returns identical diagnostics",()=>{
	const source=File("FrameContentBefore0").replace(
		"size 190 20",
		"size 190 20\n\t\t\tsize 200 21"
	);
	const parser=new LayoutParser();
	const original=parser.Parse.bind(parser);
	let parseCalls=0;
	parser.Parse=(text)=>{
		++parseCalls;
		return original(text);
	};
	const liveDocument=parser.Parse(source);
	const warnings=InspectNativePropertyCompatibility(liveDocument.roots);
	const reused=parser.AnalyzeFormatting(source,liveDocument);
	assert.equal(parseCalls,1,"native and formatting analysis should share the same parse");
	assert.ok(warnings.some(x=>x.code==="observed-native-child-loss-risk"));
	assert.ok(reused.some(x=>x.type==="duplicate"&&x.message.includes("size")));
	const baseline=parser.AnalyzeFormatting(source);
	assert.equal(parseCalls,2,"default public API should still parse when no document provided");
	assert.deepEqual(reused,baseline,"shared parse must preserve formatting results");
});

test("a stale document is not silently reused for a newly edited source",()=>{
	const parser=new LayoutParser();
	const before=File("FrameBase");
	const after=before.replace("size 190 20","size 190 20\n\t\t\tsize 190 21");
	const outdated=parser.Parse(before);
	const expected=parser.AnalyzeFormatting(after);
	assert.ok(expected.some(x=>x.type==="duplicate"));
	assert.deepEqual(parser.AnalyzeFormatting(after,outdated),expected);
	assert.equal(outdated.source,before,"source-backed document remains unchanged");
});

test("all twelve native syntax cases have equal formatting output with and without shared parse",()=>{
	const parser=new LayoutParser();
	for(const name of [
		"FrameBase","FrameContentBefore0","FrameContentAfter0",
		"FrameUnknownBefore0","FrameUnknownAfter0",
		"FrameClipBefore1","FrameClipAfter1",
		"PanelBase","PanelContentBefore0","PanelContentAfter0",
		"PanelUnknownBefore0","PanelUnknownAfter0"
	]) {
		const source=File(name);
		assert.deepEqual(parser.AnalyzeFormatting(source,parser.Parse(source)),
			parser.AnalyzeFormatting(source),name);
	}
});
