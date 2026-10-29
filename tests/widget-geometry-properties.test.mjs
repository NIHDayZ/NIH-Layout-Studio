import test from "node:test";
import assert from "node:assert/strict";
import { DecodeAuthoredGeometry, ResolveAuthoredRect, EncodeAuthoredRect } from "../.geometry-engine-test-build/WidgetGeometry.js";
import { ResolveRect, RectToLayoutGeometry } from "../.geometry-engine-test-build/LayoutMath.js";
import { LegacyResolveRect, LegacyEncodeRect } from "./reference/legacy-widget-geometry.mjs";

function Widget(properties) {
 return { id:"one", type:"PanelWidgetClass", name:"one", properties:properties.map(([name,value])=>({name,value})), children:[] };
}
function Within(a,b,epsilon=0.000002) {
 assert.ok(Math.abs(a-b) < epsilon, `expected ${a} ~= ${b}`);
}

test("authored decoder preserves defaults, flag semantics, and first property wins", () => {
 const empty=DecodeAuthoredGeometry(Widget([]));
 assert.deepEqual([empty.positionX,empty.positionY,empty.sizeX,empty.sizeY],[0,0,1,1]);
 assert.deepEqual([empty.hAlign,empty.vAlign,empty.visible,empty.clipChildren,empty.sortOrder],
  ["left_ref","top_ref",true,false,0]);
 const props=DecodeAuthoredGeometry(Widget([
  ["POSITION","0.25 0.75"], ["position","1 1"], ["SIZE","400 0.5"],
  ["HEXACTPOS","1"], ["vexactpos","true"], ["hexactsize","1"],
  ["Visible","0"], ["CLIPCHILDREN","1"], ["Priority","-6"]
 ]));
 assert.deepEqual([props.positionX,props.positionY,props.sizeX,props.sizeY],[0.25,0.75,400,0.5]);
 assert.equal(props.exactPositionX,true);
 assert.equal(props.exactPositionY,false);
 assert.equal(props.exactSizeX,true);
 assert.equal(props.visible,false);
 assert.equal(props.clipChildren,true);
 assert.equal(props.sortOrder,-6);
});

test("geometry engine matches legacy ResolveRect for exact/relative/plain/reference alignments across roots", () => {
 const horiz=["left_ref","right_ref","center_ref","left","right","center"];
 const vert=["top_ref","bottom_ref","center_ref","top","bottom","center"];
 let compared=0;
 for(const width of [1920,1280,456.75,0]) {
  for(const height of [1080,720,311.5,0]) {
   for(const xAlign of horiz) for(const yAlign of vert) {
    for(const exactPos of [false,true]) for(const exactSize of [false,true]) {
     const props=[
      ["position","0.27 -0.135"],["size","0.38 0.42"],
      ["halign",xAlign],["valign",yAlign],
      ["hexactpos",exactPos?"1":"0"],["vexactpos",exactPos?"1":"0"],
      ["hexactsize",exactSize?"1":"0"],["vexactsize",exactSize?"1":"0"]
     ];
     const node=Widget(props), parent={x:117,y:-15,width,height};
     const baseline=LegacyResolveRect(node,parent);
     assert.deepEqual(ResolveAuthoredRect(DecodeAuthoredGeometry(node),parent),baseline);
     assert.deepEqual(ResolveRect(node,parent),baseline);
     ++compared;
    }
   }
  }
 }
 assert.equal(compared,2304);
});

test("geometry engine round-trips legacy widget editor geometry across anchor and sizing modes", () => {
 const positions=["-40 100","0.25 0.8","1 0","0 0"];
 const aligns=[["right_ref","bottom_ref"],["center_ref","center_ref"],["right","bottom"],["center","center"],["left_ref","top_ref"]];
 let tested=0;
 for (const position of positions) for(const [h,v] of aligns)
 for(const xExact of [true,false]) for(const sizeExact of [true,false]) {
  const props=[["position",position],["size","120 0.3"],["halign",h],["valign",v],
   ["hexactpos",xExact?"1":"0"],["vexactpos",xExact?"1":"0"],
   ["hexactsize",sizeExact?"1":"0"],["vexactsize",sizeExact?"1":"0"]];
  const node=Widget(props);
  const parent={x:0,y:0,width:1000,height:700};
  const geometry=DecodeAuthoredGeometry(node);
  const rectangle=ResolveAuthoredRect(geometry,parent);
  const encoded=EncodeAuthoredRect(geometry,parent,rectangle);
  const baseline=LegacyEncodeRect(node,parent,rectangle);
  assert.deepEqual(encoded,baseline);
  assert.deepEqual(RectToLayoutGeometry(node,parent,rectangle),baseline);
  const roundTrip=ResolveAuthoredRect(DecodeAuthoredGeometry(Widget([
   ...props.filter(([name])=>name!=="position"&&name!=="size"),
   ["position",encoded.position],["size",encoded.size]
  ])),parent);
  Within(roundTrip.x,rectangle.x,0.001);
  Within(roundTrip.y,rectangle.y,0.001);
  Within(roundTrip.width,rectangle.width,0.001);
  Within(roundTrip.height,rectangle.height,0.001);
  ++tested;
 }
 assert.equal(tested,80);
});

test("fractional geometry preserves exact position but parent-relative size and vice versa", () => {
 const parent={width:800,height:400};
 const n=Widget([["position","15 -40"],["size","0.5 60"],
  ["hexactpos","1"],["vexactpos","1"],["vexactsize","1"]]);
 assert.deepEqual(ResolveAuthoredRect(DecodeAuthoredGeometry(n),parent),
  {x:15,y:-40,width:400,height:60});
});
