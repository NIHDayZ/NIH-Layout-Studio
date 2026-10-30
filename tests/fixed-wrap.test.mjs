import test from "node:test";
import assert from "node:assert/strict";
import { DecodeNativeWrapSettings, PlanFixedWrap, PlanFixedWrapPreview } from "../.geometry-engine-test-build/FixedWrap.js";
import { readFileSync } from "node:fs";
import { DecodeNativeSpacerSpacing } from "../.geometry-engine-test-build/SpacerSettings.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

function Node(id,type="ButtonWidgetClass",props=[],children=[]) {
 return {id,name:id,type,properties:props.map(([name,value])=>({name,value})),children};
}
const Rect=(width,height)=>({x:0,y:0,width,height});
const Fixed=(w,h)=>[["size",w+" "+h],["hexactsize","1"],["vexactsize","1"]];
const Members=()=>[Node("a","PanelWidgetClass",Fixed(40,10)),
 Node("b","TextWidgetClass",Fixed(40,20)), Node("c","ImageWidgetClass",Fixed(40,12))];
function Wrap(extra=[],children=Members()) {
 return Node("wrap","WrapSpacerWidgetClass",[...Fixed(100,90),...extra],children);
}
test("native shared spacer settings use first property and default padding/margin of two",()=>{
 assert.deepEqual(DecodeNativeSpacerSpacing([]),{padding:2,margin:2});
 assert.deepEqual(DecodeNativeWrapSettings([]),{
  padding:2,margin:2,horizontalAlign:0,verticalAlign:0
 });
 assert.deepEqual(DecodeNativeWrapSettings([
  {name:"Padding",value:"8"},{name:"padding",value:"20"},
  {name:"Margin",value:"3"},{name:"content_halign",value:"2"},
  {name:"content_valign",value:"0"}
 ]),{padding:8,margin:3,horizontalAlign:2,verticalAlign:0});
 assert.equal(DecodeNativeWrapSettings([{name:"content_halign",value:"someUnknownEnum"}]).horizontalAlign,null);
 assert.equal(DecodeNativeWrapSettings([{name:"content_valign",value:"3"}]).verticalAlign,null);
});

test("wrap planner packs fixed children using line maximum height and shared gap",()=>{
 const children=Members().map(c=>({width:40,height:Number(c.properties.find(p=>p.name==="size").value.split(" ")[1])}));
 const plan=PlanFixedWrap(children,Rect(100,90),DecodeNativeWrapSettings([]));
 assert.deepEqual(plan,{
  rects:[{x:2,y:2,width:40,height:10},
         {x:44,y:2,width:40,height:20},
         {x:2,y:24,width:40,height:12}],
  lineCount:2,usedHeight:34
 });
});

test("per-line start, end, and center horizontal alignment use remaining width",()=>{
 const dims=[{width:40,height:10},{width:40,height:20},{width:40,height:12}];
 const start=PlanFixedWrap(dims,Rect(100,90),DecodeNativeWrapSettings([]));
 const end=PlanFixedWrap(dims,Rect(100,90),DecodeNativeWrapSettings([{name:"content_halign",value:"1"}]));
 const center=PlanFixedWrap(dims,Rect(100,90),DecodeNativeWrapSettings([{name:"content_halign",value:"2"}]));
 assert.deepEqual(start.rects.map(x=>x.x),[2,44,2]);
 assert.deepEqual(end.rects.map(x=>x.x),[16,58,58]);
 assert.deepEqual(center.rects.map(x=>x.x),[9,51,30]);
 assert.deepEqual(center.rects.map(x=>x.y),[2,2,24]);
});

test("wrap skips no child, and rejects invalid width or overflowing container",()=>{
 const cfg=DecodeNativeWrapSettings([]);
 assert.equal(PlanFixedWrap([{width:120,height:10}],Rect(100,90),cfg),null);
 assert.equal(PlanFixedWrap([{width:40,height:10}],Rect(0,90),cfg),null);
 assert.equal(PlanFixedWrap([{width:40,height:0}],Rect(100,90),cfg),null);
 assert.equal(PlanFixedWrap([{width:40,height:100}],Rect(100,90),cfg),null);
 assert.equal(PlanFixedWrap([],Rect(100,90),cfg),null);
 assert.equal(PlanFixedWrap([{width:40,height:10}],Rect(100,90),
  DecodeNativeWrapSettings([{name:"content_valign",value:"2"}])),null);
});

test("default geometry snapshot does not apply Wrap native-derived behavior",()=>{
 const measured=MeasureLayoutTree([Wrap()]);
 const baseline=ArrangeMeasuredGeometry(measured,Rect(200,150));
 assert.deepEqual(baseline.appliedStrategies,[]);
 assert.deepEqual(baseline.issues.map(x=>x.code),["unresolved-layout-strategy"]);
 assert.equal(baseline.byId.get("b").localRect.x,0);
 const candidate=ArrangeMeasuredGeometry(measured,Rect(200,150),1,{fixedWrap:true});
 assert.deepEqual(candidate.appliedStrategies,[{
  id:"wrap",kind:"wrap",evidence:"native-disassembly",mode:"fixed-wrap-prototype"
 }]);
 assert.equal(candidate.issues.length,0);
 assert.deepEqual(["a","b","c"].map(id=>candidate.byId.get(id).localRect),
  [{x:2,y:2,width:40,height:10},{x:44,y:2,width:40,height:20},
   {x:2,y:24,width:40,height:12}]);
});

test("nested Frame and panel retain relative child coordinates within Wrap assigned rects",()=>{
 const nested=Node("inner","FrameWidgetClass",[["position","0.5 0.5"],["size","0.5 0.5"]]);
 const child=Node("a","ButtonWidgetClass",Fixed(40,20),[nested]);
 const parent=Node("parent","PanelWidgetClass",[
  ["position","50 30"],["hexactpos","1"],["vexactpos","1"],...Fixed(200,120)
 ],[Wrap([], [child])]);
 const snap=ArrangeMeasuredGeometry(MeasureLayoutTree([parent]),Rect(600,400),1,{fixedWrap:true});
 assert.deepEqual(snap.byId.get("a").absoluteRect,{x:52,y:32,width:40,height:20});
 assert.deepEqual(snap.byId.get("inner").absoluteRect,{x:72,y:42,width:20,height:10});
 assert.equal(snap.appliedStrategies[0].kind,"wrap");
});

test("fixed Wrap can contribute outer height to content-sized parent without applying child layout",()=>{
 const wrap=Node("wrap","WrapSpacerWidgetClass",[
  ["position","0 7"],["hexactpos","1"],["vexactpos","1"],...Fixed(100,90)
 ],Members());
 const parent=Node("frame","FrameWidgetClass",[
  ...Fixed(300,20),["Size To Content V","1"]
 ],[wrap]);
 const prepared=MeasureLayoutTree([parent]);
 const baseline=ArrangeMeasuredGeometry(prepared,Rect(500,500),1,{boundedParentContent:true});
 assert.equal(baseline.byId.get("frame").localRect.height,97);
 assert.equal(baseline.appliedStrategies.length,0);
 assert.deepEqual(baseline.issues.map(x=>x.code),["unresolved-layout-strategy"]);
 const applied=ArrangeMeasuredGeometry(prepared,Rect(500,500),1,{
  boundedParentContent:true,fixedWrap:true
 });
 assert.equal(applied.byId.get("frame").localRect.height,97);
 assert.deepEqual(applied.appliedStrategies.map(x=>x.kind),["wrap"]);
});

test("content-sized Wrap parent, unknown alignment, hidden and relative children remain unresolved",()=>{
 const cases=[
  Wrap([["Size To Content V","1"]]),
  Wrap([["content_valign","1"]]),
  Wrap([], [Node("hidden","ButtonWidgetClass",[...Fixed(20,20),["visible","0"]])]),
  Wrap([], [Node("relative","TextWidgetClass",[["size","0.5 20"],["vexactsize","1"]])]),
  Wrap([], [Node("content","ImageWidgetClass",[...Fixed(20,20),["Size To Content H","1"]])])
 ];
 for(const root of cases) {
  const result=ArrangeMeasuredGeometry(MeasureLayoutTree([root]),Rect(500,500),1,{fixedWrap:true});
  assert.deepEqual(result.appliedStrategies,[],root.type);
  assert.ok(result.issues.some(x=>x.code==="unresolved-layout-strategy"));
 }
});

test("Scroll, Grid, and ordinary containers never inherit the fixed Wrap strategy",()=>{
 const types=["ScrollWidgetClass","GridSpacerWidgetClass","PanelWidgetClass","FrameWidgetClass"];
 const roots=types.map((type,index)=>Node("parent"+index,type,Fixed(100,90),Members().map(c=>
  Node(index+"-"+c.id,c.type,c.properties.map(p=>[p.name,p.value])))));
 const result=ArrangeMeasuredGeometry(MeasureLayoutTree(roots),Rect(500,500),1,{fixedWrap:true});
 assert.deepEqual(result.appliedStrategies,[]);
 assert.deepEqual(result.issues.map(x=>x.type),types.slice(0,2));
});

test("native Wrap preview accepts named alignment from authored layouts", () => {
	const cfg = DecodeNativeWrapSettings([
		{name:"Padding",value:"0"}, {name:"Margin",value:"0"},
		{name:"content_halign",value:"right"}, {name:"content_valign",value:"center"}
	]);
	assert.deepEqual(cfg,{padding:0,margin:0,horizontalAlign:1,verticalAlign:2});
	assert.equal(DecodeNativeWrapSettings([{name:"content_valign",value:"unrecognized"}]).verticalAlign,null);
	assert.equal(PlanFixedWrap([{width:35,height:35}],Rect(90,79),cfg),null,
		"Existing fixed-wrap snapshot algorithm must retain start-only semantics");
});

test("nine actual vanilla BadgesPanel sizes form a right-aligned centered non-overlapping row", () => {
	const widths=[35,35,52,35,35,35,35,35,35];
	const children=widths.map(w=>({width:w,height:w===52?38:35}));
	const cfg=DecodeNativeWrapSettings([
		{name:"Padding",value:"0"}, {name:"Margin",value:"0"},
		{name:"content_halign",value:"right"}, {name:"content_valign",value:"center"}
	]);
	const plan=PlanFixedWrapPreview(children,{width:364.349,height:79},cfg);
	assert.ok(plan);
	assert.equal(plan.lineCount,1);
	assert.equal(plan.usedHeight,38);
	// Right-aligned native placement starts at the right edge with child 0,
	// then positions subsequent authored siblings to the left.
	assert.ok(Math.abs(plan.rects[0].x+35-364.349)<1e-9);
	assert.ok(Math.abs(plan.rects.at(-1).x-(364.349-332))<1e-9);
	assert.ok(plan.rects.every(x=>x.y===20.5));
	for(let i=1;i<plan.rects.length;++i)
		assert.ok(Math.abs(plan.rects[i].x+plan.rects[i].width-plan.rects[i-1].x)<1e-9);
});

test("opt-in Wrap preview refuses unsupported vertical alignment and overflow", () => {
	const child=[{width:40,height:20}];
	const base=DecodeNativeWrapSettings([]);
	assert.equal(PlanFixedWrapPreview(child,{width:100,height:90},{...base,verticalAlign:1}),null);
	assert.equal(PlanFixedWrapPreview(child,{width:100,height:19},{...base,verticalAlign:2}),null);
	assert.deepEqual(PlanFixedWrapPreview(child,{width:100,height:90},base),PlanFixedWrap(child,{width:100,height:90},base));
});

test("live Canvas delegates opt-in fixed Wrap planning to the shared engine adapter", () => {
	const canvas=readFileSync(new URL("../src/components/Canvas.tsx",import.meta.url),"utf8");
	const adapter=readFileSync(new URL("../src/renderer/engine/LiveManagedGeometry.ts",import.meta.url),"utf8");
	assert.ok(canvas.includes('get("experimentalNativeWrapLayout") === "1"'));
	assert.ok(canvas.includes("PlanLiveManagedChildren(node, childParent, {"));
	assert.ok(canvas.includes("nativeWrapLayout: experimentalNativeWrapLayout"));
	assert.equal(canvas.includes("PlanFixedWrapPreview("),false,"Canvas must not independently arrange Wrap children");
	assert.ok(adapter.includes("const eligibleWrap = options.nativeWrapLayout && isWrapSpacer"));
	assert.ok(adapter.includes('!GetFlag(node, "Size To Content H")'));
	assert.ok(adapter.includes('GetFlag(child, "hexactsize") && GetFlag(child, "vexactsize")'));
	assert.ok(adapter.includes('PlanNativeManagedPreview(node.type, node.properties, wrapNaturalRects, childParent, "fixed-wrap")'));
	const shared=readFileSync(new URL("../src/renderer/engine/LayoutArrangers.ts",import.meta.url),"utf8");
	assert.ok(shared.includes("PlanFixedWrapPreview(children, container, settings)"));
	assert.ok(adapter.includes("else if (wrapPlan)"));
});

test("right-aligned Wrap preview positions siblings right-to-left within each wrapped row", () => {
	const settings = DecodeNativeWrapSettings([
		{name:"Padding",value:"0"}, {name:"Margin",value:"3"},
		{name:"content_halign",value:"right"}, {name:"content_valign",value:"top"}
	]);
	const children = [
		{width:50,height:13}, {width:30,height:20},
		{width:40,height:16}, {width:50,height:10}
	];
	const plan = PlanFixedWrapPreview(children, {width:100,height:100}, settings);
	assert.ok(plan);
	assert.equal(plan.lineCount,2);
	assert.deepEqual(plan.rects, [
		{x:50,y:0,width:50,height:13},
		{x:17,y:0,width:30,height:20},
		{x:60,y:23,width:40,height:16},
		{x:7,y:23,width:50,height:10}
	]);
	// A right-aligned line is reversed visually, but child indices stay intact.
	assert.deepEqual(plan.rects.map(r=>r.width), children.map(r=>r.width));
});

test("native Wrap preview retains original start and center ordering and numeric right mode", () => {
	const children = [{width:14,height:10},{width:27,height:12},{width:19,height:10}];
	const base = DecodeNativeWrapSettings([{name:"Padding",value:"2"},{name:"Margin",value:"3"}]);
	const box={width:100,height:40};
	for(const horizontalAlign of [0,2]) {
		const settings={...base,horizontalAlign};
		assert.deepEqual(PlanFixedWrapPreview(children,box,settings),PlanFixedWrap(children,box,settings));
	}
	const numeric=DecodeNativeWrapSettings([{name:"content_halign",value:"1"}]);
	const named=DecodeNativeWrapSettings([{name:"content_halign",value:"right"}]);
	assert.deepEqual(PlanFixedWrapPreview(children,box,numeric),PlanFixedWrapPreview(children,box,named));
	const plan=PlanFixedWrapPreview(children,box,numeric);
	assert.ok(plan);
	assert.equal(plan.rects[0].x+14, box.width-numeric.padding);
	assert.ok(plan.rects[1].x < plan.rects[0].x);
});

test("the shared Wrap arrangement engine keeps its previous right-aligned plan", () => {
	const children=[{width:35,height:35},{width:52,height:38},{width:35,height:35}];
	const settings=DecodeNativeWrapSettings([{name:"Padding",value:"0"},{name:"Margin",value:"0"},{name:"content_halign",value:"right"}]);
	const common=PlanFixedWrap(children,{width:150,height:90},settings);
	const preview=PlanFixedWrapPreview(children,{width:150,height:90},settings);
	assert.ok(common && preview);
	assert.equal(common.rects[0].x,28);
	assert.equal(preview.rects[0].x,115);
	assert.deepEqual(common.rects.map(r=>r.x),[28,63,115]);
	assert.deepEqual(preview.rects.map(r=>r.x),[115,63,28]);
});
