import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DecodeContentSizingRequests } from "../.geometry-engine-test-build/ContentSizingRequests.js";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const roots = new LayoutParser().Parse(readFileSync(new URL(
	"./fixtures/workbench-content/NIH_ContentSizing_Parity.layout", import.meta.url
), "utf8")).roots;
const rootSize = {x:0,y:0,width:1120,height:460};

function ByName(nodes, name) {
	for (const node of nodes) {
		if (node.node.name === name)
			return node;
		const nested = ByName(node.children,name);
		if (nested)
			return nested;
	}
	return null;
}

test("native sizing fixture preserves distinct text, content, image and container scenarios",()=>{
	const prepared=MeasureLayoutTree(roots);
	assert.equal(roots.length,1);
	assert.equal(roots[0].name,"NIHContentParity");
	assert.equal(prepared.nodeCount,18);
	const expected={
		TextFixed:["none","none"],
		TextToTextH:["text","none"],
		TextToTextV:["none","text"],
		TextToTextBoth:["text","text"],
		TextToContentBoth:["content","content"],
		TextLongNarrow:["none","text"],
		ImageFixed:["none","none"],
		ImageContentBoth:["content","content"],
		ImageContentWide:["content","content"],
		FrameContentHeight:["none","content"],
		PanelContentBoth:["content","content"],
		FrameContentHidden:["none","content"]
	};
	for (const [name,modes] of Object.entries(expected)) {
		const node=ByName(prepared.roots,name);
		assert.ok(node,"missing native fixture "+name);
		assert.deepEqual([
			node.contentSizing.horizontal.mode,
			node.contentSizing.vertical.mode
		],modes,name);
	}
});

test("size-to-text and size-to-content are separate authored requests, not interchangeable native size algorithms",()=>{
	const modes=DecodeContentSizingRequests([
		{name:"SIZE TO TEXT H",value:"1"},
		{name:"size to content v",value:"1"},
		{name:"size to text h",value:"0"}
	]);
	assert.deepEqual([modes.horizontal.mode,modes.vertical.mode],["text","content"]);
	assert.deepEqual([modes.horizontal.sizeToText,modes.horizontal.sizeToContent],[true,false]);
	assert.deepEqual([modes.vertical.sizeToText,modes.vertical.sizeToContent],[false,true]);
	assert.equal(modes.evidence,"authored-sizing-flags-only");
	assert.deepEqual(DecodeContentSizingRequests([]).horizontal.mode,"none");
	assert.equal(DecodeContentSizingRequests([
		{name:"size to text h",value:"1"},
		{name:"size to content h",value:"1"}
	]).horizontal.mode,"ambiguous");
	for (const invalid of ["yes","true","2","-1",""])
		assert.equal(DecodeContentSizingRequests([{name:"size to text v",value:invalid}]).vertical.mode,"invalid");
});

test("passive classification never infers native text metrics or resizes layout without evidence",()=>{
	const tree=MeasureLayoutTree(roots);
	const source=JSON.stringify(roots);
	const preview=ArrangeMeasuredGeometry(tree,rootSize);
	const label=ByName(tree.roots,"TextToTextBoth");
	const textContent=ByName(tree.roots,"TextToContentBoth");
	const imgContent=ByName(tree.roots,"ImageContentBoth");
	assert.equal(label.authored.sizeToContentWidth,false);
	assert.equal(label.authored.sizeToContentHeight,false);
	assert.equal(textContent.authored.sizeToContentWidth,true);
	assert.equal(imgContent.authored.sizeToContentHeight,true);
	assert.deepEqual(preview.byId.get(label.node.id).localRect,
		{x:20,y:185,width:220,height:36});
	assert.deepEqual(preview.byId.get(textContent.node.id).localRect,
		{x:20,y:240,width:220,height:36});
	assert.ok(preview.issues.some(issue=>issue.id===textContent.node.id &&
		issue.code==="unresolved-size-to-content"));
	assert.ok(preview.issues.some(issue=>issue.id===imgContent.node.id &&
		issue.code==="unresolved-size-to-content"));
	assert.equal(preview.appliedIntrinsics.length,0);
	assert.equal(preview.appliedParentContent.length,0);
	assert.equal(JSON.stringify(roots),source);
});

test("size-to-text alone does not invoke width-independent intrinsic providers or claim text parity",()=>{
	let calls=0;
	const node={
		id:"t",name:"t",type:"TextWidgetClass",
		properties:[
			{name:"size to text h",value:"1"},
			{name:"size to text v",value:"1"},
			{name:"size",value:"180 40"},
			{name:"hexactsize",value:"1"},
			{name:"vexactsize",value:"1"}
		],children:[]
	};
	const measured=MeasureLayoutTree([node],{intrinsics:{text:()=>{
		++calls;
		return {width:100,height:18,evidence:"font-metrics",widthIndependent:true,heightIndependent:true};
	}}});
	assert.equal(calls,0);
	assert.equal(measured.roots[0].contentSizing.horizontal.mode,"text");
	const snap=ArrangeMeasuredGeometry(measured,rootSize,1,{providedIntrinsicContent:true});
	assert.equal(snap.byId.get("t").localRect.width,180);
	assert.equal(snap.byId.get("t").localRect.height,40);
	assert.equal(snap.appliedIntrinsics.length,0);
});
