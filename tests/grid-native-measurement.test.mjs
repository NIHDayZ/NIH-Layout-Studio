import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
const source=readFileSync(new URL("./fixtures/workbench-grid/NIH_Grid_Measurement_Matrix.layout",import.meta.url),"utf8");
const native=JSON.parse(readFileSync(new URL("./fixtures/workbench-grid/capture.native.2026-10-30.json",import.meta.url),"utf8"));
const root=new LayoutParser().Parse(source).roots[0];
const measured=MeasureLayoutTree([root]);
const viewport={x:0,y:0,width:1920,height:1080};
test("native Grid diagnostic is opt-in and does not modify parent or child geometry",()=>{
	const baseline=ArrangeMeasuredGeometry(measured,viewport);
	const diagnostic=ArrangeMeasuredGeometry(measured,viewport,1,{gridNativeMeasurementDiagnostics:true});
	assert.equal(baseline.gridNativeMeasurementPrototypes.size,0);
	assert.deepEqual(diagnostic.entries,baseline.entries);
	assert.deepEqual(diagnostic.issues,baseline.issues);
	assert.deepEqual(diagnostic.appliedStrategies,baseline.appliedStrategies);
});
test("strictly guarded Grid prototypes reproduce the six fixed-child native measurements",()=>{
	const diagnostic=ArrangeMeasuredGeometry(measured,viewport,1,{gridNativeMeasurementDiagnostics:true});
	for(const name of ["GridContentH","GridContentV","GridContentBoth","GridHiddenDefault","GridHiddenIncluded","GridExplicitCounts"]) {
		const node=root.children.find(x=>x.name===name);
		const proposal=diagnostic.gridNativeMeasurementPrototypes.get(node.id);
		const observed=native.scenarios.find(x=>x.name===name);
		assert.ok(proposal,name+" has a bounded observation");
		assert.deepEqual([proposal.width,proposal.height],observed.size,name);
	}
	assert.equal(diagnostic.gridNativeMeasurementPrototypes.has(root.children.find(x=>x.name==="GridRelativeChild").id),false);
	assert.equal(diagnostic.gridNativeMeasurementPrototypes.has(root.children.find(x=>x.name==="GridFixed").id),false);
});

test("single-axis Grid content requests retain authored inactive-axis size",()=>{
	const diagnostic=ArrangeMeasuredGeometry(measured,viewport,1,{gridNativeMeasurementDiagnostics:true});
	const hNode=root.children.find(x=>x.name==="GridContentH");
	const vNode=root.children.find(x=>x.name==="GridContentV");
	const hResult=diagnostic.gridNativeMeasurementPrototypes.get(hNode.id);
	const vResult=diagnostic.gridNativeMeasurementPrototypes.get(vNode.id);
	assert.deepEqual([hResult.width,hResult.height],[71,100]);
	assert.deepEqual([vResult.width,vResult.height],[240,51]);
});
