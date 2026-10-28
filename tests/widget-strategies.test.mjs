import test from "node:test";
import assert from "node:assert/strict";
import { ResolveChildLayoutStrategy } from "../.geometry-engine-test-build/WidgetStrategies.js";
import { DecodeAuthoredGeometry, MeasureAuthoredSize } from "../.geometry-engine-test-build/WidgetGeometry.js";

function Widget(properties) {
 return { properties: properties.map(([name,value])=>({name,value})) };
}

test("managed child layout is selected by exact widget class, not substring matching", () => {
 const cases=[
  ["GridSpacerWidgetClass","grid","native-disassembly"],
  ["WrapSpacerWidgetClass","wrap","native-disassembly"],
  ["SpacerWidgetClass","spacer","script-api"],
  ["ScrollWidgetClass","scroll","script-api"],
  ["ContentWidgetClass","content","layout-observation"],
  ["EmbededWidgetClass","embedded","layout-observation"],
  ["SmartPanelWidgetClass","smart-panel","layout-observation"]
 ];
 for(const [type,kind,evidence] of cases) {
  const strategy=ResolveChildLayoutStrategy(type);
  assert.deepEqual([strategy.kind,strategy.evidence,strategy.requiresArrangement],[kind,evidence,true]);
  assert.strictEqual(ResolveChildLayoutStrategy(type.toUpperCase()),strategy);
 }
 for(const type of ["FrameWidgetClass","PanelWidgetClass","ImageWidgetClass","TextWidgetClass",
  "ButtonWidgetClass","RichTextWidgetClass","MyGridSpacerWidgetClass","NonWidget"]) {
  const strategy=ResolveChildLayoutStrategy(type);
  assert.equal(strategy.kind,"authored",type);
  assert.equal(strategy.requiresArrangement,false,type);
 }
});

test("relative size is parent-dependent, never measured as intrinsic content", () => {
 const node=Widget([["size","0.65 0.8"]]);
 const measurement=MeasureAuthoredSize(DecodeAuthoredGeometry(node));
 assert.deepEqual(measurement,{
  minWidth:0,minHeight:0,preferredWidth:0,preferredHeight:0,
  dependsOnParentWidth:true,dependsOnParentHeight:true
 });
});

test("exact and relative size axes contribute preferred size independently", () => {
 const node=Widget([["size","160 0.85"],["hexactsize","1"],["vexactsize","0"]]);
 const measurement=MeasureAuthoredSize(DecodeAuthoredGeometry(node));
 assert.deepEqual(measurement,{
  minWidth:0,minHeight:0,preferredWidth:160,preferredHeight:0,
  dependsOnParentWidth:false,dependsOnParentHeight:true
 });
});

test("negative exact authored sizes do not create negative preferred measurements", () => {
 const node=Widget([["size","-24 40"],["hexactsize","1"],["vexactsize","1"]]);
 const measurement=MeasureAuthoredSize(DecodeAuthoredGeometry(node));
 assert.equal(measurement.preferredWidth,0);
 assert.equal(measurement.preferredHeight,40);
 assert.equal(measurement.dependsOnParentWidth,false);
});
