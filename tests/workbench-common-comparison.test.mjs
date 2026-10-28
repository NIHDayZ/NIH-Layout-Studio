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
const runtime = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-common/capture.runtime.2026-10-28.json", import.meta.url),
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
			captureMethod:"dayz-client-script-getters",nativeBuild:"unit-test-fixture-01",evidenceFile:"not-a-native-file",
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
	const managed=[{id:"root",name:"root",type:"FrameWidgetClass",properties:[],children:[
		{id:"grid",name:"grid",type:"GridSpacerWidgetClass",properties:[],children:[
			{id:"button",name:"button",type:"ButtonWidgetClass",properties:[],children:[]}
		]}
	]}];
	assert.throws(()=>CompareCommonGeometryCaptures(template,managed),/managed\/content-sized/);
});

test("unit-test-double capture never counts as independently observed native PASS",()=>{
	const item=PopulateSyntheticFixture();
	item.provenance.captureMethod="unit-test-double";
	const report=CompareCommonGeometryCaptures({schemaVersion:1,cases:[item]},roots);
	assert.deepEqual(report.summary,{pass:0,fail:0,pending:0,synthetic:1});
});

test("actual October 28 DayZ client getter rectangles match both root sizes but require client-build provenance",()=>{
	const report=CompareCommonGeometryCaptures(runtime,roots);
	assert.deepEqual(report.summary,{pass:0,fail:0,pending:2,synthetic:0});
	assert.deepEqual(report.reports.map(item=>item.matched),[16,16]);
	assert.ok(report.reports.every(item=>item.errors.length===1 &&
		/client build identifier was not captured/i.test(item.errors[0])));
	assert.deepEqual(runtime.cases.map(item=>item.id),["viewport-1120x460","viewport-1440x900"]);
	assert.equal(runtime.rootName,"NIHCommonParity");
	assert.ok(runtime.cases.every(item=>item.provenance.nativeBuild===null));
});

test("native getter captures confirm local authored geometry and inherited visibility across five classes",()=>{
	const names=new Map();
	function Collect(nodes) {
		for (const node of nodes) {
			names.set(node.name,node);
			Collect(node.children);
		}
	}
	Collect(roots[0].children);
	assert.equal(names.size,16);
	let maxCoordinateDelta=0;
	const property=(node,key,fallback)=>{
		const raw=node.properties.find(p=>p.name.toLowerCase()===key)?.value;
		return raw===undefined?fallback:raw;
	};
	for (const item of runtime.cases) {
		const snap=ArrangeMeasuredGeometry(MeasureLayoutTree(roots[0].children),item.viewport);
		assert.deepEqual(Object.keys(item.observed),[...names.keys()]);
		for (const [name,node] of names) {
			const arranged=snap.byId.get(node.id);
			const nativeRect=item.observed[name];
			for(const key of ["x","y","width","height"]) {
				const difference=Math.abs(arranged.absoluteRect[key]-nativeRect[key]);
				maxCoordinateDelta=Math.max(maxCoordinateDelta,difference);
				assert.ok(difference<0.000001,item.id+"/"+name+"/"+key+": "+difference);
			}
			assert.equal(arranged.visible,item.observedVisibility[name].hierarchy,
				"hierarchical native visibility for "+name);
			const local=item.observedLocal[name];
			const pos=property(node,"position","0 0").split(/\s+/).map(Number);
			const size=property(node,"size","1 1").split(/\s+/).map(Number);
			assert.deepEqual([local.x,local.y,local.width,local.height],
				[pos[0],pos[1],size[0],size[1]],"native local getters for "+name);
		}
	}
	assert.ok(maxCoordinateDelta<0.000001);
	assert.deepEqual(runtime.cases.map(c=>c.observedVisibility.Panel_Hidden),
		[{self:false,hierarchy:false},{self:false,hierarchy:false}]);
	assert.deepEqual(runtime.cases.map(c=>c.observedVisibility.Text_HiddenDescendant),
		[{self:true,hierarchy:false},{self:true,hierarchy:false}]);
});
