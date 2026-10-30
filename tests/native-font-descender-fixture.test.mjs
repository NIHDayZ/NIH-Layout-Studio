import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const src=readFileSync(new URL(
	"./fixtures/native-font-descender/NIH_NativeFontDescenderBoundary.layout",import.meta.url
),"utf8");
const roots=new LayoutParser().Parse(src).roots;
const controls=JSON.parse(readFileSync(new URL(
	"./fixtures/native-font-descender/capture.template.json",import.meta.url
),"utf8")).cases;
function Prop(node,name) {
	return node.properties.find(p=>p.name.toLowerCase()===name)?.value;
}
function Attributes(node,except) {
	return node.properties.filter(p=>!except.includes(p.name.toLowerCase()))
		.map(p=>[p.name.toLowerCase(),p.value]);
}

test("native descender fixture consists of 32 independent controlled pairs", () => {
	assert.equal(roots.length,1);
	assert.equal(roots[0].name,"NIHNativeFontDescenderBoundary");
	assert.equal(roots[0].children.length,32);
	assert.equal(controls.length,32);
	assert.deepEqual(roots[0].children.map(n=>n.name),controls.map(c=>c.id));
	assert.ok(!src.includes('"text valign"'));
	assert.ok(!src.includes('"text halign"'));
	assert.ok(!src.includes("experimentalFnt5"));
});

test("paired clipped/unclipped parent widgets differ only in clipchildren and position", () => {
	for(let i=0;i<roots[0].children.length;i+=2) {
		const a=roots[0].children[i],b=roots[0].children[i+1];
		assert.equal(a.type,"FrameWidgetClass");
		assert.equal(b.type,"FrameWidgetClass");
		assert.equal(Prop(a,"clipchildren"),"0");
		assert.equal(Prop(b,"clipchildren"),"1");
		assert.deepEqual(Attributes(a,["position","clipchildren"]),
			Attributes(b,["position","clipchildren"]));
		assert.equal(a.children.length,1);
		assert.equal(b.children.length,1);
		assert.equal(a.children[0].type,b.children[0].type);
		assert.deepEqual(Attributes(a.children[0],[]),Attributes(b.children[0],[]));
	}
});

test("authored parent boundaries are 2px or 24px above child bottom without resizing text widgets", () => {
	const snap=BuildAuthoredGeometrySnapshot(roots,{x:0,y:0,width:1280,height:720});
	assert.deepEqual(snap.issues,[]);
	assert.equal(snap.entries.length,65);
	for(let i=0;i<controls.length;++i) {
		const c=controls[i];
		const p=roots[0].children[i],child=p.children[0];
		assert.equal(child.name,c.glyphName);
		assert.equal(child.type,c.widgetType);
		assert.equal(Prop(child,"font"),c.font);
		assert.equal(Prop(child,"text"),c.sourceText);
		const prect=snap.byId.get(p.id)?.absoluteRect;
		const rect=snap.byId.get(child.id)?.absoluteRect;
		assert.deepEqual(prect,{x:c.parentRect[0],y:c.parentRect[1],
			width:c.parentRect[2],height:c.parentRect[3]});
		assert.deepEqual(rect,{x:c.parentRect[0],y:c.parentRect[1],width:265,height:68});
		assert.ok([2,24].includes(rect.height-prect.height));
		assert.ok(c.parentRect[1]+68<=720);
	}
});

test("native descender clipping and subpixel edge outcomes remain pending independent screenshots", () => {
	const capture=JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-descender/capture.template.json",import.meta.url
	),"utf8"));
	assert.equal(capture.captureKind,"native-text-descender-parent-clipping-pending");
	assert.equal(capture.nativePaintVerified,false);
	assert.equal(capture.sourceObservationsAvailable,false);
	assert.equal(capture.cases.length,32);
	assert.ok(capture.cases.every(c=>c.workbenchInkOutsideParent===null &&
		c.studioInkOutsideParent===null && c.result==="pending"));
});
