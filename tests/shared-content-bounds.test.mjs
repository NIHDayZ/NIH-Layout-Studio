import test from "node:test";
import assert from "node:assert/strict";
import { MeasureContentBounds } from "../.geometry-engine-test-build/ContentBounds.js";
import { MeasureAuthoredScrollViewport } from "../.geometry-engine-test-build/ScrollViewport.js";
import { DecodeNativeWrapSettings, MeasureFixedWrapContent } from "../.geometry-engine-test-build/FixedWrap.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ResolveBoundedParentHeight } from "../.geometry-engine-test-build/ParentContent.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

function Node(id, type, properties = [], children = []) {
	return { id, name:id, type, properties:properties.map(([name,value]) => ({name,value})), children };
}
const sized = (width, height) => [
	["size",width+" "+height],["hexactsize","1"],["vexactsize","1"]
];
const pos = (x,y) => [
	["position",x+" "+y],["hexactpos","1"],["vexactpos","1"]
];

test("one shared envelope preserves fractional, positive and negative child edges with no source mutation",()=>{
	const rectangles=[
		Object.freeze({x:-8.5,y:-4.25,width:20.5,height:17.25}),
		Object.freeze({x:40.25,y:60.75,width:70.5,height:30.25})
	];
	const before=JSON.stringify(rectangles);
	const bounds=MeasureContentBounds(rectangles);
	assert.deepEqual(bounds,{
		left:-8.5,top:-4.25,right:110.75,bottom:91,
		width:119.25,height:95.25,childCount:2
	});
	assert.equal(JSON.stringify(rectangles),before);
	assert.equal(MeasureContentBounds(rectangles),bounds===null?null:bounds);
	assert.deepEqual(MeasureContentBounds(rectangles.slice().reverse()),bounds);
});

test("invalid, empty and overflowed children are rejected atomically instead of producing partial content",()=>{
	assert.equal(MeasureContentBounds([]),null);
	const valid={x:0,y:0,width:25,height:10};
	for(const invalid of [
		{x:NaN,y:0,width:5,height:10},
		{x:0,y:Infinity,width:5,height:10},
		{x:0,y:0,width:0,height:10},
		{x:0,y:0,width:5,height:0},
		{x:0,y:0,width:5,height:-1},
		{x:Number.MAX_VALUE,y:0,width:Number.MAX_VALUE,height:10},
		{x:0,y:Number.MAX_VALUE,width:10,height:Number.MAX_VALUE},
		{x:-Number.MAX_VALUE,y:0,width:10,height:10}
	]) {
		assert.equal(MeasureContentBounds([valid,invalid]),null,
			"unsafe child cannot leave a partial envelope: "+JSON.stringify(invalid));
	}
	assert.equal(MeasureContentBounds([{x:0,y:0,width:10,height:0}]),null);
	assert.deepEqual(MeasureContentBounds([{x:0,y:9,width:10,height:0}],{
		allowZeroHeight:true
	}),{
		left:0,top:9,right:10,bottom:9,width:10,height:0,childCount:1
	});
});

test("Scroll viewport uses shared direct-child bounds without assuming native scrollbar or clipping",()=>{
	const children=[
		{x:-8,y:-4,width:20,height:20},
		{x:70,y:45,width:40,height:30}
	];
	const bounds=MeasureContentBounds(children);
	const measured=MeasureAuthoredScrollViewport({width:100,height:60},children);
	assert.deepEqual(measured.directChildBounds,{
		x:bounds.left,y:bounds.top,width:bounds.width,height:bounds.height
	});
	assert.equal(measured.directChildCount,bounds.childCount);
	assert.deepEqual(measured.overhang,{left:8,right:10,top:4,bottom:15});
	assert.equal(measured.evidence,"authored-direct-child-bounds");
	assert.equal(MeasureAuthoredScrollViewport({width:100,height:60},[
		{x:0,y:8,width:10,height:0}
	]),null,"Scroll still requires a strictly positive child height");
});

test("Frame/Panel height probe uses the same envelope but keeps parent-specific zero-height and dependency policy",()=>{
	const parent=Node("frame","FrameWidgetClass",[
		...sized(200,10),["Size To Content V","1"]
	],[
		Node("zero","PanelWidgetClass",[...pos(0,6),...sized(30,0)]),
		Node("later","ImageWidgetClass",[...pos(40,12),...sized(50,18)])
	]);
	const measured=MeasureLayoutTree([parent]);
	const attempt=ResolveBoundedParentHeight(measured.roots[0],200,{
		textHeight:()=>null,intrinsicHeight:()=>null
	});
	assert.equal(attempt.failure,null);
	assert.deepEqual(attempt.result,{
		height:30,contributingChildren:2,evidence:"bounded-child-extent-prototype"
	});
	const snapshot=ArrangeMeasuredGeometry(measured,{x:0,y:0,width:500,height:300},1,{
		boundedParentContent:true
	});
	assert.equal(snapshot.byId.get("frame").localRect.height,30);
	assert.equal(snapshot.byId.get("zero").localRect.height,0);
	assert.deepEqual(snapshot.appliedParentContent.map(v=>v.id),["frame"]);
	const hiddenParent=Node("parent","PanelWidgetClass",[
		...sized(200,10),["Size To Content V","1"]
	],[Node("hidden","ImageWidgetClass",[
		...pos(0,2),...sized(30,20),["visible","0"]
	])]);
	const rejected=ResolveBoundedParentHeight(MeasureLayoutTree([hiddenParent]).roots[0],200,{
		textHeight:()=>null,intrinsicHeight:()=>null
	});
	assert.equal(rejected.failure,"hidden-child");
	assert.equal(rejected.causeId,"hidden");
});

test("generic Wrap line packing's measured bottom extent remains consistent with shared rectangle bounds",()=>{
	const settings=DecodeNativeWrapSettings([]);
	const plan=MeasureFixedWrapContent([
		{width:40,height:10},{width:40,height:20},{width:40,height:12}
	],100,settings);
	assert.ok(plan);
	const bounds=MeasureContentBounds(plan.rects);
	assert.equal(plan.lineCount,2);
	assert.equal(bounds.left,settings.padding);
	assert.equal(bounds.top,settings.padding);
	assert.equal(bounds.bottom+settings.padding,plan.requiredHeight);
	assert.equal(plan.requiredHeight,plan.usedHeight+2*settings.padding);
	assert.equal(plan.rects.length,bounds.childCount);
});
