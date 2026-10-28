import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";
import { CompareCommonGeometryCaptures } from "../scripts/compare-workbench-common.mjs";

const roots = new LayoutParser().Parse(readFileSync(
	new URL("./fixtures/workbench-common/NIH_Common_Geometry_Parity.layout", import.meta.url),
	"utf8"
)).roots;
const template = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-common/capture.template.json", import.meta.url),
	"utf8"
));
function Copy(value) {
	return JSON.parse(JSON.stringify(value));
}
function PopulateSyntheticFixture(caseId="mock") {
	const viewport = { x:41,y:-17,width:1440,height:900 };
	const snap = ArrangeMeasuredGeometry(MeasureLayoutTree(roots[0].children), viewport);
	const observed = {};
	function Collect(nodes) {
		for (const node of nodes) {
			observed[node.name] = { ...snap.byId.get(node.id).absoluteRect };
			Collect(node.children);
		}
	}
	Collect(roots[0].children);
	return {
		id:caseId, viewport, observed,
		provenance:{
			captureMethod:"unit-test-double",nativeBuild:"mock",evidenceFile:"not-a-native-file",
			viewportSource:"test-only"
		},tolerance:0.5
	};
}

test("two common layout native capture slots are genuinely pending",()=>{
	const result=CompareCommonGeometryCaptures(template,roots);
	assert.deepEqual(result.summary,{pass:0,fail:0,pending:2,synthetic:0});
	assert.deepEqual(result.reports.map(r=>r.total),[16,16]);
	assert.ok(template.cases.every(item=>item.viewport===null&&item.observed===null));
});

test("comparator accepts complete model-derived unit doubles only as an internal math check",()=>{
	const item=PopulateSyntheticFixture();
	const report=CompareCommonGeometryCaptures({schemaVersion:1,cases:[item]},roots);
	assert.deepEqual(report.summary,{pass:1,fail:0,pending:0,synthetic:0});
	assert.equal(report.reports[0].matched,16);
	item.observed.Image_RightRef.x+=10;
	const failed=CompareCommonGeometryCaptures({schemaVersion:1,cases:[item]},roots);
	assert.equal(failed.summary.fail,1);
	assert.match(failed.reports[0].errors.join(" "),/Image_RightRef\.x/);
});

test("incomplete native captures cannot be called passing",()=>{
	const item=PopulateSyntheticFixture();
	delete item.observed.Text_Exact;
	let report=CompareCommonGeometryCaptures({schemaVersion:1,cases:[item]},roots);
	assert.equal(report.summary.pending,1);
	assert.equal(report.reports[0].matched,15);
	item.observed.NonexistentWidget={x:0,y:0,width:20,height:20};
	report=CompareCommonGeometryCaptures({schemaVersion:1,cases:[item]},roots);
	assert.equal(report.summary.fail,1);
	assert.match(report.reports[0].errors.join(" "),/Unrecognized native widget name/);
});

test("unmeasured workspace context never produces false parity",()=>{
	const item=PopulateSyntheticFixture();
	item.viewport=null;
	const report=CompareCommonGeometryCaptures({schemaVersion:1,cases:[item]},roots);
	assert.equal(report.summary.pending,1);
	assert.match(report.reports[0].errors[0],/root screen rectangle/);
});

test("synthetic captures and missing provenance never count as native parity",()=>{
	const item=PopulateSyntheticFixture();
	item.provenance.captureMethod="synthetic";
	const synthetic=CompareCommonGeometryCaptures({schemaVersion:1,cases:[item]},roots);
	assert.deepEqual(synthetic.summary,{pass:0,fail:0,pending:0,synthetic:1});
	item.provenance=null;
	assert.throws(()=>CompareCommonGeometryCaptures({schemaVersion:1,cases:[item]},roots),
		/native capture provenance/);
});

test("malformed comparison inputs fail closed instead of inventing native rectangles",()=>{
	assert.throws(()=>CompareCommonGeometryCaptures({schemaVersion:1,cases:[]},roots),/nonempty/);
	const dup=Copy(template);
	dup.cases.push(Copy(dup.cases[0]));
	assert.throws(()=>CompareCommonGeometryCaptures(dup,roots),/duplicate/);
	const bad=PopulateSyntheticFixture();
	bad.tolerance=-1;
	assert.throws(()=>CompareCommonGeometryCaptures({schemaVersion:1,cases:[bad]},roots),/tolerance/);
	const managed=[{id:"a",name:"grid",type:"GridSpacerWidgetClass",properties:[],children:[
		{id:"b",name:"button",type:"ButtonWidgetClass",properties:[],children:[]}
	]}];
	assert.throws(()=>CompareCommonGeometryCaptures(template,managed),/managed\/content-sized/);
});
