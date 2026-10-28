import test from "node:test";
import assert from "node:assert/strict";
import {
	ParseNativePropertyMatrix,
	EXPECTED_PROPERTY_PHASES,
	EXPECTED_PROPERTY_CASES
} from "../scripts/extract-workbench-property-matrix.mjs";

const prefix="[NIH_LayoutStudio][PropertyProbe]";
function MakeLog() {
	const lines=[prefix+" REQUEST viewport=1120,720"];
	for(const phase of EXPECTED_PROPERTY_PHASES) {
		lines.push(prefix+" BEGIN "+phase);
		lines.push(prefix+" phase="+phase+" rootScreenSize=1120,720");
		for(const name of EXPECTED_PROPERTY_CASES) {
			lines.push(prefix+" phase="+phase+" case="+name+
				" parentPresent=1 childCount=2 topFound=1 bottomFound=1");
			lines.push(prefix+" phase="+phase+" case="+name+
				" screenSize=190,20 localSize=190,20");
		}
		lines.push(prefix+" END "+phase);
	}
	return lines.join("\n")+"\n";
}

test("native property matrix parser requires all 14 cases, three phases and actual native dimensions",()=>{
	assert.equal(EXPECTED_PROPERTY_CASES.length,14);
	assert.equal(EXPECTED_PROPERTY_PHASES.length,3);
	const result=ParseNativePropertyMatrix(MakeLog(),"script-test.log");
	assert.equal(result.schemaVersion,1);
	assert.equal(result.nativeClientBuild,null);
	assert.equal(result.status,"native-diagnostic-not-algorithm-parity");
	assert.deepEqual(result.phases.map(x=>x.phase),EXPECTED_PROPERTY_PHASES);
	assert.equal(result.expectedCaseCount,14);
	assert.equal(result.phases[0].rootScreenSize.width,1120);
	assert.deepEqual(result.phases[0].cases.PFrameNoFlag,{
		parentPresent:true,childCount:2,topFound:true,bottomFound:true,
		screenSize:{width:190,height:20},localSize:{width:190,height:20}
	});
});

test("native absent children are retained as zero counts without filling expected authored children",()=>{
	const modified=MakeLog().replace(
		"parentPresent=1 childCount=2 topFound=1 bottomFound=1",
		"parentPresent=1 childCount=0 topFound=0 bottomFound=0");
	const result=ParseNativePropertyMatrix(modified);
	assert.equal(result.phases[0].cases.PFrameNoFlag.childCount,0);
	assert.equal(result.phases[0].cases.PFrameNoFlag.topFound,false);
	assert.equal(result.phases[0].cases.PFrameNoFlag.bottomFound,false);
	assert.equal(result.phases[0].cases.PFrameNoFlag.screenSize.height,20);
	assert.equal(result.status,"native-diagnostic-not-algorithm-parity");
});

test("unknown, missing, duplicated and mismatched phases and cases reject the capture",()=>{
	const good=MakeLog();
	assert.throws(()=>ParseNativePropertyMatrix(good.replace(
		"BEGIN after-create","BEGIN post-update")),/Invalid native phase|Missing/);
	assert.throws(()=>ParseNativePropertyMatrix(good.replace(
		"END after-resize","END other")),/Invalid native phase END/);
	assert.throws(()=>ParseNativePropertyMatrix(good.replace(
		"END after-resize","")),/Unclosed native property-matrix phase/);
	assert.throws(()=>ParseNativePropertyMatrix(good.replace(
		"case=PFrameNoFlag ","case=PUnexpected ")),/Unexpected or duplicate native case/);
	assert.throws(()=>ParseNativePropertyMatrix(good.replace(
		"case=PFrameNoFlag screenSize=190,20 localSize=190,20","")),/Missing native parent dimensions|Unknown native/);
	assert.throws(()=>ParseNativePropertyMatrix(good.replace(
		"phase=after-create case=PFrameNoFlag parentPresent=1 childCount=2 topFound=1 bottomFound=1",
		"phase=after-create case=PFrameNoFlag parentPresent=1 childCount=2 topFound=1 bottomFound=1\n"+
		prefix+" phase=after-create case=PFrameNoFlag parentPresent=1 childCount=2 topFound=1 bottomFound=1"
	)),/Unexpected or duplicate native case/);
});

test("native size parsing refuses NaN, Infinity, negative widths and unsafe child counts",()=>{
	const good=MakeLog();
	for(const invalid of [
		"screenSize=NaN,20","screenSize=Infinity,20","screenSize=-10,20"
	]) {
		assert.throws(()=>ParseNativePropertyMatrix(
			good.replace("screenSize=190,20",invalid)
		),/Invalid native size/);
	}
	assert.throws(()=>ParseNativePropertyMatrix(good.replace(
		"childCount=2","childCount=9007199254740992"
	)),/Invalid native child count/);
	assert.throws(()=>ParseNativePropertyMatrix(good+prefix+" ERROR: test resource unavailable"),
		/Native property probe error/);
});

test("native missing-parent records are legal only without a second dimensions record",()=>{
	const good=MakeLog();
	const edited=good.replace(
		"parentPresent=1 childCount=2 topFound=1 bottomFound=1",
		"parentPresent=0 childCount=0 topFound=0 bottomFound=0"
	).replace(
		"phase=after-create case=PFrameNoFlag screenSize=190,20 localSize=190,20",
		""
	);
	const parsed=ParseNativePropertyMatrix(edited);
	assert.equal(parsed.phases[0].cases.PFrameNoFlag.parentPresent,false);
	assert.equal(parsed.phases[0].cases.PFrameNoFlag.screenSize,null);
	assert.throws(()=>ParseNativePropertyMatrix(good.replace(
		"parentPresent=1 childCount=2 topFound=1 bottomFound=1",
		"parentPresent=0 childCount=0 topFound=0 bottomFound=0"
	)),/Unexpected or duplicate native case size/);
});
