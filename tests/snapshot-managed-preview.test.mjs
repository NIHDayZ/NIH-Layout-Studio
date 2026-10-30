import test from "node:test";
import assert from "node:assert/strict";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/GeometryComparison.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometryComparison.js";
const N=(id,type,properties=[],children=[])=>({id,name:id,type,properties:properties.map(([name,value])=>({name,value})),children});
const F=(w,h)=>[["size",w+" "+h],["hexactsize","1"],["vexactsize","1"]];
test("snapshot native fixed Wrap uses right-to-left order only when preview option is set",()=>{
	const children=[N("a","ImageWidgetClass",F(20,10)),N("b","ImageWidgetClass",F(30,10))];
	const root=N("wrap","WrapSpacerWidgetClass",[...F(100,60),["Padding","0"],["Margin","0"],["content_halign","right"]],children);
	const tree=MeasureLayoutTree([root]);
	const viewport={x:0,y:0,width:800,height:600};
	const baseline=ArrangeMeasuredGeometry(tree,viewport);
	const strict=ArrangeMeasuredGeometry(tree,viewport,1,{fixedWrap:true});
	const preview=ArrangeMeasuredGeometry(tree,viewport,1,{fixedWrap:true,fixedWrapPreview:true});
	assert.equal(baseline.appliedStrategies.length,0);
	assert.equal(strict.appliedStrategies.length,0);
	assert.equal(preview.appliedStrategies.length,1);
	assert.equal(preview.byId.get("a").localRect.x,80);
	assert.equal(preview.byId.get("b").localRect.x,50);
});
test("preview never promotes content-sized Wrap into fixed arrangement",()=>{
	const child=N("child","ImageWidgetClass",F(20,10));
	const root=N("wrap","WrapSpacerWidgetClass",[...F(100,60),["Size To Content H","1"],["content_halign","right"]],[child]);
	const snapshot=ArrangeMeasuredGeometry(MeasureLayoutTree([root]),{x:0,y:0,width:800,height:600},1,{fixedWrap:true,fixedWrapPreview:true});
	assert.equal(snapshot.appliedStrategies.length,0);
	assert.equal(snapshot.issues.some(x=>x.code==="unresolved-layout-strategy"),true);
});
