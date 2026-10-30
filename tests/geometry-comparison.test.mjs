import test from "node:test";
import assert from "node:assert/strict";
import { CompareLiveToSnapshot } from "../.geometry-engine-test-build/GeometryComparison.js";
const N=(id,type,properties=[],children=[])=>({id,name:id,type,properties:properties.map(([name,value])=>({name,value})),children});
const F=(w,h)=>[["size",w+" "+h],["hexactsize","1"],["vexactsize","1"]];
const root={x:0,y:0,width:800,height:600};
const off={gridLayout:false,nativeConstrainedGrid:false,nativeWrapLayout:false};
test("whole-tree ordinary positioning agrees with snapshot",()=>{
	const child=N("child","TextWidgetClass",[["position","0.5 0.5"],["size","0.5 0.5"]]);
	const frame=N("frame","FrameWidgetClass",[...F(200,100),["position","50 40"],["hexactpos","1"],["vexactpos","1"]],[child]);
	const c=CompareLiveToSnapshot([frame],root,off);
	assert.equal(c.total,2);assert.equal(c.matched,2);assert.equal(c.differences.length,0);
});
test("managed Wrap divergence is attributed to container and descendants, not arbitrary widget IDs",()=>{
	const children=[N("first","ImageWidgetClass",F(35,35)),N("second","ImageWidgetClass",F(35,35))];
	const wrap=N("wrap","WrapSpacerWidgetClass",[...F(100,60),["Padding","0"],["Margin","0"],["content_halign","right"]],children);
	const c=CompareLiveToSnapshot([wrap],root,{...off,nativeWrapLayout:true});
	assert.ok(c.differences.length>=2);
	assert.ok(c.differences.every(d=>d.origin!=="ordinary"));
	assert.deepEqual(c.differences.map(d=>d.parentId),["wrap","wrap"]);
	assert.equal(c.unresolved.some(x=>x.code==="unresolved-layout-strategy"),true);
});
test("comparison retains explicit duplicate ID diagnostic instead of claiming parity",()=>{
	const c=CompareLiveToSnapshot([N("dup","FrameWidgetClass"),N("dup","PanelWidgetClass")],root,off);
	assert.deepEqual(c.duplicateIds,["dup"]);
	assert.equal(c.matched+c.differences.length<c.total,false);
});
