import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";
const source=readFileSync(new URL("./fixtures/workbench-grid/NIH_Grid_Relative_Matrix.layout",import.meta.url),"utf8");
const root=new LayoutParser().Parse(source).roots[0];
const names=["RControl","RWidth25","RWidth75","RHeight25","RHeight75","RParentSmall","RParentLarge","RContentH","RContentV","RFixed","RWidthZero","RHeightZero"];
test("Phase 2K matrix isolates twelve relative-child contexts",()=>{
	assert.equal(root.type,"FrameWidgetClass");
	assert.deepEqual(root.children.map(node=>node.name),names);
	for(const grid of root.children){
		assert.equal(grid.children.length,3);
		const child=grid.children[1];
		assert.equal(child.properties.find(p=>p.name==="hexactsize").value,"0");
		assert.equal(child.properties.find(p=>p.name==="vexactsize").value,"0");
		assert.equal(grid.children[0].properties.find(p=>p.name==="hexactsize").value,"1");
		assert.equal(grid.children[2].properties.find(p=>p.name==="vexactsize").value,"1");
	}
});
test("Phase 2K keeps all relative-child content requests unresolved",()=>{
	const snapshot=ArrangeMeasuredGeometry(MeasureLayoutTree([root]),
		{x:0,y:0,width:1920,height:1080},1,{constrainedGrid:true,gridContentArrangement:true,gridNativeMeasurementDiagnostics:true});
	for(const grid of root.children){
		assert.equal(snapshot.gridNativeMeasurementPrototypes.has(grid.id),false,grid.name);
		assert.equal(snapshot.appliedStrategies.some(strategy=>strategy.id===grid.id && strategy.mode==="grid-content-prototype"),false,grid.name);
	}
});
