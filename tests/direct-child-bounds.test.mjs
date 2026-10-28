import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MeasureContentBounds, MeasureArrangedDirectChildBounds } from "../.geometry-engine-test-build/ContentBounds.js";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const roots = new LayoutParser().Parse(readFileSync(new URL(
	"./fixtures/workbench-common/NIH_Common_Geometry_Parity.layout", import.meta.url
), "utf8")).roots;
const captured = JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-common/capture.runtime.2026-10-28.json", import.meta.url
), "utf8"));

const names = new Map();
function Collect(nodes) {
	for (const node of nodes) {
		names.set(node.name,node.id);
		Collect(node.children);
	}
}
Collect(roots);
const tree = MeasureLayoutTree(roots);

test("generic direct-child envelopes are strictly opt-in and never alter arranged rectangles or native diagnostics",()=>{
	for (const record of captured.cases) {
		const baseline=ArrangeMeasuredGeometry(tree,record.viewport);
		const measured=ArrangeMeasuredGeometry(tree,record.viewport,1,{
			directChildBoundsDiagnostics:true
		});
		assert.equal(baseline.directChildBoundsCandidates.size,0);
		assert.ok(measured.directChildBoundsCandidates.size>0);
		assert.deepEqual(measured.entries,baseline.entries);
		assert.deepEqual(measured.issues,baseline.issues);
		assert.deepEqual(measured.appliedStrategies,baseline.appliedStrategies);
		assert.deepEqual(measured.byId,baseline.byId);
	}
});

test("all native-observed descendant rectangles reconstruct the same direct-child envelopes across both root sizes",()=>{
	// Compute envelope from independent DayZ native screen getters, NOT from
	// the shared engine's predicted child positions. All comparisons remain
	// diagnostic arithmetic; DayZ has not returned native content extents.
	for (const record of captured.cases) {
		const snapshot=ArrangeMeasuredGeometry(tree,record.viewport,1,{
			directChildBoundsDiagnostics:true
		});
		const nativeRect=node=>{
			if (node.name===captured.rootName)
				return record.viewport;
			return record.observed[node.name];
		};
		let compared=0;
		function Visit(node) {
			if(node.children.length>0) {
				const parent=nativeRect(node);
				const childRects=node.children.map(child=>{
					const measured=nativeRect(child);
					assert.ok(measured,child.name);
					return {
						x:measured.x-parent.x, y:measured.y-parent.y,
						width:measured.width, height:measured.height
					};
				});
				const fromNative=MeasureContentBounds(childRects,{allowZeroHeight:true});
				const candidate=snapshot.directChildBoundsCandidates.get(node.id);
				assert.ok(candidate,node.name);
				assert.deepEqual(candidate.bounds,fromNative,record.id+"/"+node.name);
				assert.equal(candidate.evidence,"arranged-direct-child-bounds");
				assert.equal(candidate.assumptions,"all-direct-children-including-hidden-no-native-filter");
				++compared;
			}
			for(const child of node.children)
				Visit(child);
		}
		for(const root of roots)
			Visit(root);
		assert.equal(compared,snapshot.directChildBoundsCandidates.size);
		assert.ok(compared>=5);
	}
});

test("direct children may extend beyond their container without being clipped or removed by the envelope",()=>{
	const snapshot=ArrangeMeasuredGeometry(tree,captured.cases[0].viewport,1,{
		directChildBoundsDiagnostics:true
	});
	const bounds=name=>snapshot.directChildBoundsCandidates.get(names.get(name)).bounds;
	assert.deepEqual(bounds("Frame_Exact"),{
		left:33,top:31.5,right:430,bottom:255,
		width:397,height:223.5,childCount:2
	});
	assert.deepEqual(bounds("Panel_Relative"),{
		left:12,top:6,right:184,bottom:67.5,
		width:172,height:61.5,childCount:3
	});
	assert.deepEqual(bounds("Frame_Overhang"),{
		left:90,top:50,right:180,bottom:110,
		width:90,height:60,childCount:1
	});
	assert.deepEqual(bounds("Panel_Hidden"),{
		left:10,top:10,right:120,bottom:40,
		width:110,height:30,childCount:1
	});
	assert.equal(snapshot.byId.get(names.get("Panel_Hidden")).visible,false);
	assert.ok(bounds("Frame_Overhang").right>snapshot.byId.get(names.get("Frame_Overhang")).absoluteRect.width);
	assert.equal(snapshot.directChildBoundsCandidates.has(names.get("Panel_Negative")),false);
});

test("managed child fallback rectangles remain observable but are never treated as native placement",()=>{
	const grid={
		id:"grid",name:"grid",type:"GridSpacerWidgetClass",
		properties:[
			{name:"size",value:"200 70"},{name:"hexactsize",value:"1"},{name:"vexactsize",value:"1"},
			{name:"Columns",value:"2"},{name:"Rows",value:"1"}
		],
		children:[
			{id:"one",name:"one",type:"PanelWidgetClass",
				properties:[{name:"size",value:"30 20"},{name:"hexactsize",value:"1"},{name:"vexactsize",value:"1"}],children:[]},
			{id:"two",name:"two",type:"ButtonWidgetClass",
				properties:[{name:"size",value:"30 20"},{name:"hexactsize",value:"1"},{name:"vexactsize",value:"1"}],children:[]}
		]
	};
	const measured=MeasureLayoutTree([grid]);
	const parentRect={x:0,y:0,width:500,height:300};
	const authored=ArrangeMeasuredGeometry(measured,parentRect,1,{directChildBoundsDiagnostics:true});
	assert.equal(authored.issues[0].code,"unresolved-layout-strategy");
	assert.equal(authored.appliedStrategies.length,0);
	assert.ok(authored.directChildBoundsCandidates.has("grid"));
	const managed=ArrangeMeasuredGeometry(measured,parentRect,1,{
		constrainedGrid:true,directChildBoundsDiagnostics:true
	});
	assert.equal(managed.appliedStrategies.length,1);
	assert.equal(managed.issues.length,0);
	const actual=MeasureContentBounds([
		managed.byId.get("one").localRect,managed.byId.get("two").localRect
	]);
	assert.deepEqual(managed.directChildBoundsCandidates.get("grid").bounds,actual);
});

test("duplicate widget IDs fail the optional parent grouping closed, leaving the primary geometry diagnostics intact",()=>{
	const rect={x:0,y:0,width:10,height:10};
	const duplicated=[
		{id:"root",parentId:null,localRect:rect},
		{id:"a",parentId:"root",localRect:rect},
		{id:"a",parentId:"root",localRect:rect}
	];
	assert.equal(MeasureArrangedDirectChildBounds(duplicated).size,0);
	const unique=[
		{id:"root",parentId:null,localRect:rect},
		{id:"child",parentId:"missing",localRect:rect}
	];
	assert.equal(MeasureArrangedDirectChildBounds(unique).size,0);
});
