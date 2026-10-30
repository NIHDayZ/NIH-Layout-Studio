import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
const source=readFileSync(new URL("./fixtures/workbench-grid/NIH_Grid_Measurement_Matrix.layout",import.meta.url),"utf8");
const root=new LayoutParser().Parse(source).roots[0];
const expected=["GridFixed","GridContentH","GridContentV","GridContentBoth","GridRelativeChild","GridHiddenDefault","GridHiddenIncluded","GridExplicitCounts"];
test("native Grid measurement input contains eight isolated, parseable variants",()=>{
	assert.equal(root.type,"FrameWidgetClass");
	assert.deepEqual(root.children.map(x=>x.name),expected);
	for(const grid of root.children) {
		assert.equal(grid.type,"GridSpacerWidgetClass");
		assert.equal(grid.children.length,3);
		assert.equal(grid.children.every(child=>child.type==="PanelWidgetClass"),true);
	}
});
test("native sizing flags vary independently without changing fixed control child sizes",()=>{
	const byName=new Map(root.children.map(x=>[x.name,x]));
	const flags=(name)=>byName.get(name).properties.filter(x=>/size to content/i.test(x.name)).map(x=>x.value);
	assert.deepEqual(flags("GridFixed"),["0","0"]);
	assert.deepEqual(flags("GridContentH"),["1","0"]);
	assert.deepEqual(flags("GridContentV"),["0","1"]);
	assert.deepEqual(flags("GridContentBoth"),["1","1"]);
	const sizes=(name)=>byName.get(name).children.map(c=>c.properties.find(p=>p.name==="size")?.value);
	assert.deepEqual(sizes("GridFixed"),sizes("GridContentH"));
	assert.deepEqual(sizes("GridFixed"),sizes("GridContentV"));
	assert.deepEqual(sizes("GridFixed"),sizes("GridContentBoth"));
});
test("relative and invisible child probes isolate the intended differences",()=>{
	const byName=new Map(root.children.map(x=>[x.name,x]));
	const relative=byName.get("GridRelativeChild").children[1];
	assert.equal(relative.properties.find(x=>x.name==="hexactsize").value,"0");
	assert.equal(relative.properties.find(x=>x.name==="vexactsize").value,"0");
	assert.equal(byName.get("GridHiddenDefault").children[1].properties.find(x=>x.name==="visible").value,"0");
	assert.equal(byName.get("GridHiddenIncluded").properties.find(x=>x.name==="Ignore invisible").value,"0");
});
