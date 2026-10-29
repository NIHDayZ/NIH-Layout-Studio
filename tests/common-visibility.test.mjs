import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { InspectAuthoredVisibility } from "../.geometry-engine-test-build/GeometryVisibility.js";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const layout = new LayoutParser().Parse(readFileSync(
	new URL("./fixtures/workbench-common/NIH_Common_Geometry_Parity.layout", import.meta.url), "utf8"
)).roots;
const runtime = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-common/capture.runtime.2026-10-28.json", import.meta.url), "utf8"
));
const descendants = layout[0].children;

function CollectNames(nodes, map = new Map()) {
	for (const node of nodes) {
		map.set(node.name, node.id);
		CollectNames(node.children, map);
	}
	return map;
}
const names = CollectNames(descendants);

test("generic clip candidate separates authored self visibility from hierarchy visibility", () => {
	const absolute = {x:10,y:20,width:60,height:40};
	const clip = {x:0,y:0,width:45,height:45};
	const visible = InspectAuthoredVisibility(absolute,clip,true,true);
	assert.equal(visible.selfVisible,true);
	assert.equal(visible.hierarchyVisible,true);
	assert.equal(visible.hiddenByAncestor,false);
	assert.deepEqual(visible.intersectionCandidate,{x:10,y:20,width:35,height:25});
	assert.deepEqual(visible.paintCandidate,visible.intersectionCandidate);
	assert.equal(visible.outsideAncestorClip,false);
	assert.deepEqual(visible.ancestorClip,clip);
	assert.notStrictEqual(visible.ancestorClip,clip);
	const inheritedHidden=InspectAuthoredVisibility(absolute,clip,true,false);
	assert.equal(inheritedHidden.selfVisible,true);
	assert.equal(inheritedHidden.hierarchyVisible,false);
	assert.equal(inheritedHidden.hiddenByAncestor,true);
	assert.equal(inheritedHidden.paintCandidate,null);
	assert.deepEqual(inheritedHidden.intersectionCandidate,visible.intersectionCandidate);
	const selfHidden=InspectAuthoredVisibility(absolute,clip,false,true);
	assert.equal(selfHidden.hiddenByAncestor,false);
	assert.equal(selfHidden.hierarchyVisible,false);
	assert.equal(selfHidden.paintCandidate,null);
});

test("outside clip or invalid rectangles never claim a paintable native area",()=>{
	const widget={x:100,y:100,width:25,height:30};
	const clip={x:0,y:0,width:40,height:40};
	const outside=InspectAuthoredVisibility(widget,clip,true,true);
	assert.equal(outside.outsideAncestorClip,true);
	assert.equal(outside.paintCandidate,null);
	assert.equal(outside.hierarchyVisible,true,
		"native hierarchical visibility does not imply clip intersection");
	const unbounded=InspectAuthoredVisibility(widget,null,true,true);
	assert.deepEqual(unbounded.paintCandidate,widget);
	assert.equal(unbounded.ancestorClip,null);
	const bad=[
		{x:NaN,y:0,width:20,height:20},
		{x:0,y:0,width:-1,height:20},
		{x:Number.MAX_VALUE,y:0,width:Number.MAX_VALUE,height:20}
	];
	for (const rect of bad)
		assert.equal(InspectAuthoredVisibility(rect,clip,true,true),null);
	assert.equal(InspectAuthoredVisibility(widget,{x:0,y:0,width:Infinity,height:20},true,true),null);
	assert.equal(InspectAuthoredVisibility({x:0,y:0,width:0,height:50},null,true,true).paintCandidate,null);
});

test("actual native DayZ self and hierarchical visibility match the shared candidate across both root sizes",()=>{
	assert.equal(runtime.cases.length,2);
	assert.equal(names.size,16);
	const prepared=MeasureLayoutTree(descendants);
	for (const capture of runtime.cases) {
		const base=ArrangeMeasuredGeometry(prepared,capture.viewport);
		const snap=ArrangeMeasuredGeometry(prepared,capture.viewport,1,{authoredVisibilityDiagnostics:true});
		assert.deepEqual(snap.entries,base.entries);
		assert.deepEqual(snap.issues,base.issues);
		assert.deepEqual(snap.appliedStrategies,base.appliedStrategies);
		assert.equal(base.visibilityDiagnostics.size,0);
		assert.equal(snap.visibilityDiagnostics.size,16);
		for (const [name,id] of names) {
			const diagnostic=snap.visibilityDiagnostics.get(id);
			const native=capture.observedVisibility[name];
			assert.ok(diagnostic,name);
			assert.equal(diagnostic.selfVisible,native.self,capture.id+"/"+name+"/self");
			assert.equal(diagnostic.hierarchyVisible,native.hierarchy,capture.id+"/"+name+"/hierarchy");
			assert.equal(diagnostic.hierarchyVisible,snap.byId.get(id).visible);
		}
		assert.equal(snap.visibilityDiagnostics.get(names.get("Panel_Hidden")).selfVisible,false);
		const hiddenChild=snap.visibilityDiagnostics.get(names.get("Text_HiddenDescendant"));
		assert.equal(hiddenChild.selfVisible,true);
		assert.equal(hiddenChild.hiddenByAncestor,true);
		assert.equal(hiddenChild.hierarchyVisible,false);
		assert.equal(hiddenChild.paintCandidate,null);
	}
});

test("overhanging and negative widgets produce distinct clip candidates, not inferred native scissor results",()=>{
	const capture=runtime.cases[0];
	const snap=ArrangeMeasuredGeometry(MeasureLayoutTree(descendants),capture.viewport,1,{
		authoredVisibilityDiagnostics:true
	});
	const diagnostic=name=>snap.visibilityDiagnostics.get(names.get(name));
	assert.deepEqual(diagnostic("Frame_Overhang").intersectionCandidate,
		{x:310,y:185,width:40,height:45});
	assert.deepEqual(diagnostic("Button_Overhang").ancestorClip,
		{x:310,y:185,width:40,height:45});
	assert.equal(diagnostic("Button_Overhang").outsideAncestorClip,true);
	assert.equal(diagnostic("Button_Overhang").hierarchyVisible,true);
	assert.equal(diagnostic("Button_Overhang").paintCandidate,null);
	assert.deepEqual(diagnostic("Panel_Negative").intersectionCandidate,
		{x:0,y:0,width:108,height:61});
	assert.deepEqual(diagnostic("Panel_Negative").paintCandidate,
		{x:0,y:0,width:108,height:61});
	assert.equal(diagnostic("Panel_Negative").evidence,
		"authored-hierarchy-and-ancestor-clip-candidate");
});

test("candidate intersection never changes authored geometry, managed strategy or measured native evidence",()=>{
	const grid={
		id:"grid",name:"grid",type:"GridSpacerWidgetClass",
		properties:[],children:[{
			id:"child",name:"child",type:"PanelWidgetClass",
			properties:[],children:[]
		}]
	};
	const prepared=MeasureLayoutTree([grid]);
	const viewport={x:0,y:0,width:500,height:300};
	const base=ArrangeMeasuredGeometry(prepared,viewport);
	const enabled=ArrangeMeasuredGeometry(prepared,viewport,1,{authoredVisibilityDiagnostics:true});
	assert.deepEqual(enabled.entries,base.entries);
	assert.deepEqual(enabled.issues,base.issues);
	assert.deepEqual(enabled.appliedStrategies,base.appliedStrategies);
	assert.equal(enabled.visibilityDiagnostics.size,2);
	assert.equal(enabled.issues[0].code,"unresolved-layout-strategy");
});
