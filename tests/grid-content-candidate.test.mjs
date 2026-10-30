import test from "node:test";
import assert from "node:assert/strict";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";
const N=(id,type,properties=[],children=[])=>({id,name:id,type,properties:properties.map(([name,value])=>({name,value})),children});
const F=(w,h)=>[["size",w+" "+h],["hexactsize","1"],["vexactsize","1"]];
const viewport={x:0,y:0,width:800,height:600};
test("fixed-child content candidate remains read-only and reports a measurable envelope",()=>{
	const children=[N("a","PanelWidgetClass",F(40,10)),N("b","PanelWidgetClass",F(20,15)),N("c","PanelWidgetClass",F(30,25))];
	const grid=N("grid","GridSpacerWidgetClass",[...F(300,200),["Columns","2"],["Rows","2"],["Padding","3"],["Margin","4"],["Size To Content V","1"]],children);
	const prepared=MeasureLayoutTree([grid]);
	const baseline=ArrangeMeasuredGeometry(prepared,viewport,1,{constrainedGrid:true});
	const diagnostic=ArrangeMeasuredGeometry(prepared,viewport,1,{constrainedGrid:true,gridContentCandidateDiagnostics:true});
	assert.equal(baseline.gridContentCandidates.size,0);
	assert.deepEqual(diagnostic.entries,baseline.entries);
	assert.deepEqual(diagnostic.appliedStrategies,[]);
	assert.deepEqual(diagnostic.issues,baseline.issues);
	assert.deepEqual(diagnostic.gridContentCandidates.get("grid"),{id:"grid",width:70,height:50,columns:2,rows:2,measuredChildren:3,evidence:"fixed-child-lower-bound"});
});
test("relative or content-sized child does not become an invented Grid measurement",()=>{
	const relative=N("child","PanelWidgetClass",[["size","1 1"]]);
	const grid=N("grid","GridSpacerWidgetClass",[...F(300,200),["Size To Content V","1"]],[relative]);
	const snapshot=ArrangeMeasuredGeometry(MeasureLayoutTree([grid]),viewport,1,{gridContentCandidateDiagnostics:true,constrainedGrid:true});
	assert.equal(snapshot.gridContentCandidates.size,0);
	assert.equal(snapshot.appliedStrategies.length,0);
	assert.equal(snapshot.issues.some(issue=>issue.code==="unresolved-layout-strategy"),true);
});
