import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ParseNativePropertySyntax, EXPECTED_SYNTAX_CASES, EXPECTED_SYNTAX_PHASES } from "../scripts/extract-workbench-property-syntax.mjs";

const prefix="[NIH_LayoutStudio][SyntaxProbe]";
function FixtureLog() {
	const lines=[prefix+" BEGIN"];
	for (const id of EXPECTED_SYNTAX_CASES) {
		for (const phase of EXPECTED_SYNTAX_PHASES) {
			lines.push(prefix+" phase="+phase+" case="+id+
				" rootPresent=1 parentPresent=1 childCount=2 topFound=1 bottomFound=1");
			lines.push(prefix+" phase="+phase+" case="+id+
				" screenSize=190,20 localSize=190,20");
		}
	}
	lines.push(prefix+" END");
	return lines.join("\n")+"\n";
}
const source=id=>readFileSync(new URL(
	"./fixtures/workbench-content/syntax-matrix/"+id+".layout",import.meta.url
),"utf8");
const strip=(raw,id)=>raw
	.replaceAll(id,"PROBE")
	.replace(/\s+(?:"Size To Content V"|"NIH_ProbeUnknown"|clipchildren)\s+[01]/g,"")
	.replace(/\s+/g," ").trim();

test("all 12 isolated native input resources differ from their family control ONLY by property and identifier",()=>{
	assert.equal(EXPECTED_SYNTAX_CASES.length,12);
	for (const [family, ids] of [
		["Frame",EXPECTED_SYNTAX_CASES.filter(id=>id.startsWith("Frame"))],
		["Panel",EXPECTED_SYNTAX_CASES.filter(id=>id.startsWith("Panel"))]
	]) {
		const baseline=strip(source(family+"Base"),family+"Base");
		for(const id of ids) {
			const layout=source(id);
			assert.deepEqual(strip(layout,id),baseline,id);
			assert.equal((layout.match(/PanelWidgetClass PROBE/g)||[]).length,0);
			assert.ok(layout.includes(id+"_Top")&&layout.includes(id+"_Bottom"),id);
			assert.ok(layout.includes("size 190 20"),id);
			assert.ok(layout.includes("size 60 24")&&layout.includes("size 90 28"),id);
			const attr=/"Size To Content V" 0|"NIH_ProbeUnknown" 0|clipchildren 1/.exec(layout);
			if(id.endsWith("Base"))
				assert.equal(attr,null,id);
			else {
				assert.ok(attr,id);
				const childIndex=layout.indexOf(id+"_Top");
				const endChildIndex=layout.indexOf(id+"_Bottom");
				if(id.includes("Before"))
					assert.ok(attr.index<childIndex,id+" attribute before child block");
				if(id.includes("After"))
					assert.ok(attr.index>endChildIndex,id+" attribute after child block");
			}
		}
	}
});

test("native syntax parser reconstructs each case's two phases, retains actual getters and provenance limit",()=>{
	const record=ParseNativePropertySyntax(FixtureLog(),"script-test.log");
	assert.equal(record.schemaVersion,1);
	assert.equal(record.status,"native-loader-syntax-diagnostic-not-cpp-parser-proof");
	assert.equal(record.nativeClientBuild,null);
	assert.equal(record.expectedCaseCount,12);
	assert.deepEqual(Object.keys(record.cases),EXPECTED_SYNTAX_CASES);
	for(const id of EXPECTED_SYNTAX_CASES) {
		for(const phase of EXPECTED_SYNTAX_PHASES) {
			assert.deepEqual(record.cases[id][phase],{
				rootPresent:true,parentPresent:true,childCount:2,
				topFound:true,bottomFound:true,screenSize:{width:190,height:20},
				localSize:{width:190,height:20}
			});
		}
	}
});

test("a resource failing to load or a parent with zero children is valid native evidence, not a parser PASS",()=>{
	const all=FixtureLog();
	const missing=all.replace(
		"rootPresent=1 parentPresent=1 childCount=2 topFound=1 bottomFound=1",
		"rootPresent=0 parentPresent=0 childCount=0 topFound=0 bottomFound=0"
	).replace("phase=after-create case=FrameBase screenSize=190,20 localSize=190,20","");
	const result=ParseNativePropertySyntax(missing);
	assert.equal(result.cases.FrameBase["after-create"].rootPresent,false);
	assert.equal(result.cases.FrameBase["after-create"].screenSize,null);
	assert.equal(result.status,"native-loader-syntax-diagnostic-not-cpp-parser-proof");
	const absentChildren=all.replace(
		"rootPresent=1 parentPresent=1 childCount=2 topFound=1 bottomFound=1",
		"rootPresent=1 parentPresent=1 childCount=0 topFound=0 bottomFound=0"
	);
	assert.equal(ParseNativePropertySyntax(absentChildren).cases.FrameBase["after-create"].childCount,0);
});

test("missing, reordered, duplicate or malformed native observations fail closed",()=>{
	const good=FixtureLog();
	const swaps=good.replace(
		"phase=after-create case=FrameBase rootPresent=1",
		"phase=post-update case=FrameBase rootPresent=1"
	);
	assert.throws(()=>ParseNativePropertySyntax(swaps),/out-of-order/);
	assert.throws(()=>ParseNativePropertySyntax(good.replace(
		"case=FrameUnknownAfter0 rootPresent=1",
		"case=NeverExists rootPresent=1"
	)),/out-of-order/);
	assert.throws(()=>ParseNativePropertySyntax(good.replace(
		prefix+" END",""
	)),/Incomplete native syntax capture/);
	assert.throws(()=>ParseNativePropertySyntax(good.replace(
		"screenSize=190,20","screenSize=NaN,20"
	)),/Malformed native syntax size/);
	assert.throws(()=>ParseNativePropertySyntax(good.replace(
		"childCount=2","childCount=9007199254740992"
	)),/Invalid native syntax child count/);
	assert.throws(()=>ParseNativePropertySyntax(good.replace(
		"phase=after-create case=FrameBase screenSize=190,20 localSize=190,20",""
	)),/Missing native syntax case dimensions/);
	assert.throws(()=>ParseNativePropertySyntax(good.replace(
		prefix+" END",prefix+" ERROR: native syntax failure\n"+prefix+" END"
	)),/Native syntax probe error/);
});
