import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
const native=JSON.parse(readFileSync(new URL("./fixtures/workbench-grid/capture.native.2026-10-30.json",import.meta.url),"utf8"));
const source=readFileSync(new URL("./fixtures/workbench-grid/NIH_Grid_Measurement_Matrix.layout",import.meta.url),"utf8");
const root=new LayoutParser().Parse(source).roots[0];
test("native Grid capture includes all eight independently measured containers",()=>{
	assert.equal(native.provenance.evidence,"independent-native-getters");
	assert.deepEqual(native.provenance.phaseWidgetCounts,[33,33,33]);
	assert.deepEqual(native.scenarios.map(x=>x.name),root.children.map(x=>x.name));
	assert.equal(native.scenarios.every(x=>x.children.length===3),true);
	assert.deepEqual(native.scenarios.map(x=>x.size),[[240,100],[71,100],[240,51],[71,51],[145.5,63],[81,33],[71,51],[48,64]]);
});
test("native Grid content measurements preserve per-case discrepancies without universal offset assumptions",()=>{
	const prepared=MeasureLayoutTree([root]);
	const snapshot=ArrangeMeasuredGeometry(prepared,{x:0,y:0,width:1920,height:1080},1,{gridContentCandidateDiagnostics:true});
	// Independently captured native dimensions remain frozen in capture.native JSON.
	// The fixed-child diagnostic is deliberately a lower-bound candidate,
	// not a claim that every axis differs from native by one unit.
	const expectedCandidates=new Map([
		["GridContentH",[70,50]],
		["GridContentV",[70,50]],
		["GridContentBoth",[70,50]],
		["GridHiddenDefault",[80,35]],
		["GridHiddenIncluded",[70,50]],
		["GridExplicitCounts",[46,64]]
	]);
	for(const [name,dimensions] of expectedCandidates) {
		const grid=root.children.find(x=>x.name===name);
		const estimate=snapshot.gridContentCandidates.get(grid.id);
		assert.ok(estimate,name+" candidate should be independently measurable");
		assert.deepEqual([estimate.width,estimate.height],dimensions,name+" fixed-child diagnostic");
		const actual=native.scenarios.find(x=>x.name===name);
		assert.ok(actual,name+" has native capture");
		assert.notDeepEqual(actual.size,dimensions,name+" native geometry differs from provisional candidate");
	}
	assert.equal(snapshot.gridContentCandidates.has(root.children.find(x=>x.name==="GridRelativeChild").id),false);
	assert.equal(snapshot.appliedStrategies.length,0);
});
test("native fixed Grid child rectangles retain separately captured screen positions",()=>{
	const fixed=native.scenarios.find(x=>x.name==="GridFixed");
	assert.deepEqual(fixed.children,[[24,24,114.5,44.5],[141.5,24,114.5,44.5],[24,71.5,114.5,44.5]]);
	assert.deepEqual(native.provenance.baselineRootScreen,[1920,1080]);
	assert.deepEqual(native.provenance.resizedRootScreen,[1120,720]);
});
