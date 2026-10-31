import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";
const source=readFileSync(new URL("./fixtures/workbench-grid/NIH_Grid_Variation_Matrix.layout",import.meta.url),"utf8");
const root=new LayoutParser().Parse(source).roots[0];
const observed=new Map([
	["VBaseline",[71,51]],["VPaddingZero",[68,48]],["VPaddingSeven",[75,55]],
	["VMarginZero",[63,43]],["VMarginSeven",[77,57]],["VOneChild",[51,18]],
	["VTwoChildren",[71,23]],["VFourChildren",[71,51]],
	["VThreeByTwo",[104,33]],["VTwoByThree",[71,51]],["VOneByFour",[48,64]]
]);
test("Phase 2G fixed-child measurements match all eleven independent native observations",()=>{
	const result=ArrangeMeasuredGeometry(MeasureLayoutTree([root]),
		{x:0,y:0,width:1920,height:1080},1,{gridNativeMeasurementDiagnostics:true});
	assert.equal(result.gridNativeMeasurementPrototypes.size,11);
	for(const node of root.children) {
		const native=observed.get(node.name);
		const proposal=result.gridNativeMeasurementPrototypes.get(node.id);
		if(!native) {
			assert.equal(proposal,undefined,"relative-sized child remains unresolved");
			continue;
		}
		assert.ok(proposal,node.name);
		assert.deepEqual([proposal.width,proposal.height],native,node.name);
	}
});
test("Phase 2G measurement diagnostic never changes default arrangements",()=>{
	const prepared=MeasureLayoutTree([root]);
	const bounds={x:0,y:0,width:1920,height:1080};
	const baseline=ArrangeMeasuredGeometry(prepared,bounds);
	const diagnostic=ArrangeMeasuredGeometry(prepared,bounds,1,{gridNativeMeasurementDiagnostics:true});
	assert.deepEqual(diagnostic.entries,baseline.entries);
	assert.deepEqual(diagnostic.appliedStrategies,baseline.appliedStrategies);
	assert.deepEqual(diagnostic.issues,baseline.issues);
});

test("Phase 2J shares compact participating indices and configured column/occupied row maxima",()=>{
	const snapshot=ArrangeMeasuredGeometry(MeasureLayoutTree([root]),{x:0,y:0,width:1920,height:1080},1,
		{gridNativeMeasurementDiagnostics:true});
	const cases=[
		["VOneChild",[40,0],[10],[0]],
		["VTwoChildren",[40,20],[15],[0,1]],
		["VThreeByTwo",[40,20,30],[25],[0,1,2]],
		["VOneByFour",[40],[10,15,25],[0,1,2]]
	];
	for(const [name,columns,rows,indices] of cases){
		const node=root.children.find(x=>x.name===name);
		const measurement=snapshot.gridNativeMeasurementPrototypes.get(node.id);
		assert.deepEqual(measurement.columnWidths,columns,name+" columns");
		assert.deepEqual(measurement.rowHeights,rows,name+" occupied rows");
		assert.deepEqual(measurement.participatingIndices,indices,name+" participation");
	}
});
