import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
const source=readFileSync(new URL("./fixtures/workbench-grid/NIH_Grid_Variation_Matrix.layout",import.meta.url),"utf8");
const root=new LayoutParser().Parse(source).roots[0];
const cases=[{"name":"VBaseline","count":3,"padding":3,"margin":4,"columns":2,"rows":2,"relative":false},{"name":"VPaddingZero","count":3,"padding":0,"margin":4,"columns":2,"rows":2,"relative":false},{"name":"VPaddingSeven","count":3,"padding":7,"margin":4,"columns":2,"rows":2,"relative":false},{"name":"VMarginZero","count":3,"padding":3,"margin":0,"columns":2,"rows":2,"relative":false},{"name":"VMarginSeven","count":3,"padding":3,"margin":7,"columns":2,"rows":2,"relative":false},{"name":"VOneChild","count":1,"padding":3,"margin":4,"columns":2,"rows":2,"relative":false},{"name":"VTwoChildren","count":2,"padding":3,"margin":4,"columns":2,"rows":2,"relative":false},{"name":"VFourChildren","count":4,"padding":3,"margin":4,"columns":2,"rows":2,"relative":false},{"name":"VThreeByTwo","count":3,"padding":3,"margin":4,"columns":3,"rows":2,"relative":false},{"name":"VTwoByThree","count":3,"padding":3,"margin":4,"columns":2,"rows":3,"relative":false},{"name":"VOneByFour","count":3,"padding":3,"margin":4,"columns":1,"rows":4,"relative":false},{"name":"VRelativeChild","count":3,"padding":3,"margin":4,"columns":2,"rows":2,"relative":true}];
test("Phase 2G input preserves all twelve isolated Grid measurement variations",()=>{
	assert.equal(root.type,"FrameWidgetClass");
	assert.deepEqual(root.children.map(x=>x.name),cases.map(x=>x.name));
	for(let i=0;i<cases.length;i++){
		const grid=root.children[i];
		const expected=cases[i];
		const prop=name=>grid.properties.find(x=>x.name===name)?.value;
		assert.equal(grid.type,"GridSpacerWidgetClass");
		assert.equal(grid.children.length,expected.count);
		assert.equal(prop("Padding"),String(expected.padding));
		assert.equal(prop("Margin"),String(expected.margin));
		assert.equal(prop("Columns"),String(expected.columns));
		assert.equal(prop("Rows"),String(expected.rows));
		assert.equal(prop("Size To Content H"),"1");
		assert.equal(prop("Size To Content V"),"1");
		assert.equal(grid.children.every(x=>x.type==="PanelWidgetClass"),true);
		if(expected.relative){
			assert.equal(grid.children[1].properties.find(x=>x.name==="hexactsize").value,"0");
			assert.equal(grid.children[1].properties.find(x=>x.name==="vexactsize").value,"0");
		}
	}
});
test("variation matrix includes a matched baseline for cross-capture validation",()=>{
	assert.equal(root.children[0].name,"VBaseline");
	assert.deepEqual(root.children[0].children.map(x=>x.properties.find(p=>p.name==="size").value),["40 10","20 15","30 25"]);
});
