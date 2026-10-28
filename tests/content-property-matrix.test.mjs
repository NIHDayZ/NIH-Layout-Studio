import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const source=readFileSync(new URL(
	"./fixtures/workbench-content/NIH_ContentProperty_Matrix.layout",import.meta.url
),"utf8");
const parsed=new LayoutParser().Parse(source);
const roots=parsed.roots;
const parent=roots[0];
const cases=new Map(parent.children.map(node=>[node.name,node]));
const families=[
	["PFrameNoFlag","PFrameFlagZero","PFrameFlagOne","PFrameHorizontalOne","PFrameBothOne","PFrameTextOne","PFrameClipped"],
	["PPanelNoFlag","PPanelFlagZero","PPanelFlagOne","PPanelHorizontalOne"],
	["PWrapNoFlag","PWrapFlagZero","PWrapFlagOne"]
];

function Property(node,name) {
	return node.properties.find(p=>p.name.toLowerCase()===name.toLowerCase())?.value;
}
function GeometryWithoutName(node) {
	return {
		type:node.type,
		properties:node.properties.map(p=>[p.name,p.value]),
		children:node.children.map(GeometryWithoutName)
	};
}
function CaseWithoutExperimentalFlag(node) {
	return {
		...GeometryWithoutName(node),
		properties:node.properties
			.filter(p=>p.name.toLowerCase()!=="position"
				&& p.name.toLowerCase()!=="size to content h"
				&& p.name.toLowerCase()!=="size to content v"
				&& p.name.toLowerCase()!=="size to text v"
				&& p.name.toLowerCase()!=="clipchildren")
			.map(p=>[p.name.toLowerCase(),p.value])
	};
}

test("matrix contains 14 class-controlled parents and 28 direct children, not a replacement for v2 fixture",()=>{
	assert.equal(roots.length,1);
	assert.equal(parent.name,"NIHPropertyParity");
	assert.equal(parent.children.length,14);
	assert.equal(cases.size,14);
	const names=new Set(["NIHPropertyParity"]);
	for(const [name,node] of cases) {
		assert.equal(node.children.length,2,name);
		assert.equal(node.children[0].name,name+"_Top");
		assert.equal(node.children[1].name,name+"_Bottom");
		names.add(name);
		for(const child of node.children) {
			assert.ok(!names.has(child.name),child.name+" duplicate");
			names.add(child.name);
		}
	}
	assert.equal(names.size,43);
	assert.deepEqual(families.map(group=>group.map(name=>cases.get(name)?.type)),[
		Array(7).fill("FrameWidgetClass"),
		Array(4).fill("PanelWidgetClass"),
		Array(3).fill("WrapSpacerWidgetClass")
	]);
});

test("within each widget family pairs differ only by one candidate property and screen position",()=>{
	for(const group of families) {
		const baseline=CaseWithoutExperimentalFlag(cases.get(group[0]));
		for(const name of group.slice(1))
			assert.deepEqual(CaseWithoutExperimentalFlag(cases.get(name)),baseline,name);
	}
	assert.equal(Property(cases.get("PFrameFlagZero"),"Size To Content V"),"0");
	assert.equal(Property(cases.get("PFrameFlagOne"),"Size To Content V"),"1");
	assert.equal(Property(cases.get("PFrameHorizontalOne"),"Size To Content H"),"1");
	assert.equal(Property(cases.get("PFrameBothOne"),"Size To Content V"),"1");
	assert.equal(Property(cases.get("PFrameBothOne"),"Size To Content H"),"1");
	assert.equal(Property(cases.get("PFrameTextOne"),"Size To Text V"),"1");
	assert.equal(Property(cases.get("PFrameClipped"),"clipchildren"),"1");
	assert.equal(Property(cases.get("PPanelFlagZero"),"Size To Content V"),"0");
	assert.equal(Property(cases.get("PPanelFlagOne"),"Size To Content V"),"1");
	assert.equal(Property(cases.get("PWrapFlagZero"),"Size To Content V"),"0");
	assert.equal(Property(cases.get("PWrapFlagOne"),"Size To Content V"),"1");
});

test("the passive shared decoder preserves presence and enabled-state differences without native policy assumptions",()=>{
	const measured=MeasureLayoutTree(roots);
	assert.equal(measured.nodeCount,43);
	const byName=new Map(measured.roots[0].children.map(n=>[n.node.name,n]));
	for(const name of ["PFrameNoFlag","PFrameFlagZero","PPanelNoFlag","PPanelFlagZero","PWrapNoFlag","PWrapFlagZero"]) {
		assert.equal(byName.get(name).contentSizing.vertical.mode,"none",name);
	}
	for(const name of ["PFrameFlagOne","PFrameBothOne","PPanelFlagOne","PWrapFlagOne"]) {
		assert.equal(byName.get(name).contentSizing.vertical.mode,"content",name);
	}
	assert.equal(byName.get("PFrameHorizontalOne").contentSizing.horizontal.mode,"content");
	assert.equal(byName.get("PFrameTextOne").contentSizing.vertical.mode,"text");
	assert.equal(byName.get("PFrameClipped").contentSizing.vertical.mode,"none");

	const baseline=ArrangeMeasuredGeometry(measured,{x:0,y:0,width:1120,height:720});
	const scaled=ArrangeMeasuredGeometry(measured,{x:0,y:0,width:1120,height:620});
	assert.equal(baseline.appliedStrategies.length,0);
	assert.equal(baseline.appliedParentContent.length,0);
	assert.equal(baseline.appliedWrapContent.length,0);
	for (const node of measured.roots[0].children) {
		const rect=baseline.byId.get(node.node.id).localRect;
		assert.equal(rect.width,190,node.node.name);
		assert.equal(rect.height,20,node.node.name);
		assert.equal(scaled.byId.get(node.node.id).localRect.height,20);
	}
	assert.equal(JSON.stringify(roots),JSON.stringify(new LayoutParser().Parse(source).roots));
});
