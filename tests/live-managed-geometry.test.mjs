import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PlanLiveManagedChildren, PlanLiveGridContent } from "../.geometry-engine-test-build/LiveManagedGeometry.js";
import { PlanNativeManagedPreview } from "../.geometry-engine-test-build/LiveManagedGeometry.js";
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

test("native strategy dispatcher handles only exact container classes",()=>{
	const children=[{x:0,y:0,width:20,height:10},{x:0,y:0,width:30,height:10}];
	const props=[{name:"Padding",value:"0"},{name:"Margin",value:"0"},{name:"content_halign",value:"right"}];
	assert.equal(PlanNativeManagedPreview("FrameWidgetClass",props,children,parent,"fixed-wrap"),null);
	assert.equal(PlanNativeManagedPreview("WrapSpacerWidgetClass",props,children,parent,"constrained-grid"),null);
	assert.equal(PlanNativeManagedPreview("GridSpacerWidgetClass",props,children,parent,"fixed-wrap"),null);
	assert.deepEqual(PlanNativeManagedPreview("WrapSpacerWidgetClass",props,children,parent,"fixed-wrap").map(r=>r.x),[80,50]);
});
test("native constrained Grid uses one shared strategy entry point",()=>{
	const children=[{x:0,y:0,width:20,height:10},{x:0,y:0,width:20,height:10}];
	const grid=node("GridSpacerWidgetClass",[...fixed(100,60),["Columns","2"],["Rows","1"],["Padding","0"],["Margin","0"]],children.map((_,i)=>node("TextWidgetClass",fixed(20,10))));
	const rects=PlanNativeManagedPreview(grid.type,grid.properties,children,parent,"constrained-grid");
	const live=PlanLiveManagedChildren(grid,parent,{gridLayout:true,nativeConstrainedGrid:true,nativeWrapLayout:false});
	assert.deepEqual(live.rects,rects);
});
