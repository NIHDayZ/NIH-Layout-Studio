import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";
const source=readFileSync(new URL("./fixtures/workbench-grid/NIH_Grid_Measurement_Matrix.layout",import.meta.url),"utf8");
const root=new LayoutParser().Parse(source).roots[0];
const measured=MeasureLayoutTree([root]);
const viewport={x:0,y:0,width:1920,height:1080};
const scenarios={
	GridContentH:{size:[71,100],children:[[304,24,40,44.5],[347,24,20,44.5],[304,71.5,30,44.5]]},
	GridContentV:{size:[240,51],children:[[584,24,114.5,10],[701.5,24,114.5,15],[584,42,114.5,25]]},
	GridContentBoth:{size:[71,51],children:[[864,24,40,10],[907,24,20,15],[864,42,30,25]]},
	GridHiddenDefault:{size:[81,33],children:[[304,344,40,10],null,[347,344,30,25]]},
	GridHiddenIncluded:{size:[71,51],children:[[584,344,40,10],[627,344,20,15],[584,362,30,25]]},
	GridExplicitCounts:{size:[48,64],children:[[864,344,40,10],[864,357,20,15],[864,375,30,25]]}
};
test("Phase 2H native parent and child rectangles match captured H/V/mixed layouts",()=>{
	const result=ArrangeMeasuredGeometry(measured,viewport,1,{constrainedGrid:true,gridContentArrangement:true});
	for(const [name,record] of Object.entries(scenarios)){
		const grid=root.children.find(x=>x.name===name);
		const actual=result.byId.get(grid.id).absoluteRect;
		assert.deepEqual([actual.width,actual.height],record.size,name+" parent");
		for(let i=0;i<3;i++){
			if(!record.children[i]) continue;
			const rect=result.byId.get(grid.children[i].id).absoluteRect;
			assert.deepEqual([rect.x,rect.y,rect.width,rect.height],record.children[i],name+" child "+i);
		}
	}
});
test("Phase 2H integration stays opt-in and rejects relative-child negotiation",()=>{
	const baseline=ArrangeMeasuredGeometry(measured,viewport);
	const onlyGrid=ArrangeMeasuredGeometry(measured,viewport,1,{constrainedGrid:true});
	assert.deepEqual(onlyGrid.entries,baseline.entries);
	const integrated=ArrangeMeasuredGeometry(measured,viewport,1,{constrainedGrid:true,gridContentArrangement:true});
	const relative=root.children.find(x=>x.name==="GridRelativeChild");
	assert.deepEqual(integrated.byId.get(relative.id).absoluteRect,baseline.byId.get(relative.id).absoluteRect);
	assert.equal(integrated.appliedStrategies.length,6);
});
