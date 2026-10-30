import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PlanLiveManagedChildren, PlanLiveGridContent } from "../.geometry-engine-test-build/LiveManagedGeometry.js";
const node=(type, props=[], children=[])=>({
	id:type,name:type,type,properties:props.map(([name,value])=>({name,value})),children
});
const fixed=(w,h)=>[["size",w+" "+h],["hexactsize","1"],["vexactsize","1"]];
const parent={x:0,y:0,width:100,height:60};
test("unified live adapter preserves authored Wrap when experiment disabled",()=>{
	const children=[node("ImageWidgetClass",fixed(20,10)),node("TextWidgetClass",fixed(30,10))];
	const wrap=node("WrapSpacerWidgetClass",[...fixed(100,60),["Padding","0"],["Margin","0"],["content_halign","right"]],children);
	const off=PlanLiveManagedChildren(wrap,parent,{gridLayout:false,nativeConstrainedGrid:false,nativeWrapLayout:false});
	assert.deepEqual(off.rects.map(r=>r.x),[0,0]);
	const on=PlanLiveManagedChildren(wrap,parent,{gridLayout:false,nativeConstrainedGrid:false,nativeWrapLayout:true});
	assert.deepEqual(on.rects.map(r=>r.x),[80,50]);
	assert.equal(on.wrapApplied,true);
});
test("non-Wrap container never inherits opt-in Wrap arrangement",()=>{
	const children=[node("ImageWidgetClass",fixed(20,10)),node("TextWidgetClass",fixed(30,10))];
	const frame=node("FrameWidgetClass",fixed(100,60),children);
	const result=PlanLiveManagedChildren(frame,parent,{gridLayout:false,nativeConstrainedGrid:false,nativeWrapLayout:true});
	assert.deepEqual(result.rects.map(r=>r.x),[0,0]);
	assert.equal(result.wrapApplied,false);
});
test("live grid content and child arrangements share one engine module",()=>{
	const children=[node("TextWidgetClass",fixed(20,10)),node("TextWidgetClass",fixed(20,10))];
	const grid=node("GridSpacerWidgetClass",[...fixed(100,60),["Rows","1"],["Columns","2"]],children);
	const opts={gridLayout:true,nativeConstrainedGrid:false,nativeWrapLayout:false};
	const slots=PlanLiveManagedChildren(grid,parent,opts);
	const contents=PlanLiveGridContent(grid,parent,false);
	assert.deepEqual(slots.rects,contents.rects);
});
test("Canvas no longer defines independent spacer algorithms or imports their planners",()=>{
	const canvas=readFileSync(new URL("../src/components/Canvas.tsx",import.meta.url),"utf8");
	assert.ok(canvas.includes("PlanLiveManagedChildren(node, childParent, {"));
	assert.ok(canvas.includes("PlanLiveGridContent(node,"));
	for(const old of ["function GetGridPlan(", "function GetSpacerDirection(", "function GetSpacerGap(", "PlanFixedWrapPreview(", "PlanConstrainedGrid(", "PlanGrid("])
		assert.equal(canvas.includes(old),false,old);
});
