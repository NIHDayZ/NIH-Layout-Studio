import test from "node:test";
import assert from "node:assert/strict";
import {
  ProjectNativeScrollChildContext,
  MeasureNativeScrollNormalizedPosition
} from "../.geometry-engine-test-build/ScrollOffset.js";

test("explicit native offsets shift child context without moving the viewport", () => {
  const viewport = Object.freeze({ x: 10, y: 0, width: 90, height: 50 });
  const offsets = Object.freeze({ horizontal: 17, vertical: 23 });
  const result = ProjectNativeScrollChildContext(viewport, offsets);
  assert.deepEqual(result.childContext, { x: -7, y: -23, width: 90, height: 50 });
  assert.deepEqual(result.viewport, viewport);
  assert.deepEqual(result.offsets, offsets);
  assert.equal(result.evidence, "native-derived-scroll-child-origin");
  assert.deepEqual(viewport, { x: 10, y: 0, width: 90, height: 50 });
  assert.deepEqual(offsets, { horizontal: 17, vertical: 23 });
});

test("zero offsets retain left-scrollbar-origin shift", () => {
  const result = ProjectNativeScrollChildContext(
    { x: 10, y: 0, width: 90, height: 50 },
    { horizontal: 0, vertical: 0 }
  );
  assert.deepEqual(result.childContext, { x: 10, y: 0, width: 90, height: 50 });
});

test("malformed or overflowed offset inputs are rejected", () => {
  const viewport = { x: 0, y: 0, width: 100, height: 60 };
  assert.equal(ProjectNativeScrollChildContext(viewport, { horizontal: NaN, vertical: 0 }), null);
  assert.equal(ProjectNativeScrollChildContext(viewport, { horizontal: 0, vertical: Infinity }), null);
  assert.equal(ProjectNativeScrollChildContext({ ...viewport, width: 0 }, { horizontal: 0, vertical: 0 }), null);
  assert.equal(ProjectNativeScrollChildContext({ ...viewport, x: -Number.MAX_VALUE },
    { horizontal: Number.MAX_VALUE, vertical: 0 }), null);
});

test("native normalized H/V positions use the opposite scrollbar's reservation", () => {
  const result = MeasureNativeScrollNormalizedPosition({
    contentWidth: 250, contentHeight: 180,
    widgetWidth: 100, widgetHeight: 60,
    verticalScrollbar: true, horizontalScrollbar: true, scrollbarThickness: 10,
    offsets: { horizontal: 80, vertical: 65 }
  });
  assert.equal(result.horizontalRange, 160);
  assert.equal(result.verticalRange, 130);
  assert.equal(result.horizontal, 0.5);
  assert.equal(result.vertical, 0.5);
  assert.equal(result.evidence, "native-derived-scroll-position-ratios");
});

test("zero scrolling range returns zero; negative or nonfinite range is refused", () => {
  const base = {
    contentWidth: 100, contentHeight: 60, widgetWidth: 100, widgetHeight: 60,
    verticalScrollbar: false, horizontalScrollbar: false, scrollbarThickness: 10,
    offsets: { horizontal: 0, vertical: 0 }
  };
  const zero = MeasureNativeScrollNormalizedPosition(base);
  assert.deepEqual([zero.horizontal, zero.vertical, zero.horizontalRange, zero.verticalRange], [0,0,0,0]);
  assert.equal(MeasureNativeScrollNormalizedPosition({ ...base, contentWidth: 80 }), null);
  assert.equal(MeasureNativeScrollNormalizedPosition({ ...base, scrollbarThickness: Infinity }), null);
});

test("snapshot only projects Scroll offsets with explicit samples and enabled unscaled viewport diagnostic", async () => {
  const { MeasureLayoutTree } = await import("../.geometry-engine-test-build/LayoutMeasurement.js");
  const { ArrangeMeasuredGeometry } = await import("../.geometry-engine-test-build/GeometrySnapshot.js");
  const properties = [
    ["size","100 60"],["hexactsize","1"],["vexactsize","1"],
    ["Scrollbar V","1"],["Scrollbar V Left","1"]
  ].map(([name,value])=>({name,value}));
  const scroll = {id:"scroll",name:"scroll",type:"ScrollWidgetClass",properties,children:[]};
  const prepared = MeasureLayoutTree([scroll]);
  const root={x:0,y:0,width:400,height:300};
  const samples=new Map([["scroll",{horizontal:17,vertical:23}]]);
  const baseline=ArrangeMeasuredGeometry(prepared,root);
  const disabled=ArrangeMeasuredGeometry(prepared,root,1,{scrollOffsetSamples:samples});
  assert.equal(baseline.scrollChildContextCandidates.size,0);
  assert.equal(disabled.scrollChildContextCandidates.size,0);
  const enabled=ArrangeMeasuredGeometry(prepared,root,1,{
    scrollScrollbarViewportDiagnostics:true, scrollOffsetSamples:samples
  });
  const candidate=enabled.scrollChildContextCandidates.get("scroll");
  assert.deepEqual(candidate.childContext,{x:-7,y:-23,width:90,height:60});
  assert.deepEqual(candidate.viewport,{x:10,y:0,width:90,height:60});
  assert.deepEqual(enabled.entries,baseline.entries);
  assert.deepEqual(enabled.issues,baseline.issues);
  assert.deepEqual(enabled.appliedStrategies,baseline.appliedStrategies);

  const missing=ArrangeMeasuredGeometry(prepared,root,1,{
    scrollScrollbarViewportDiagnostics:true
  });
  assert.equal(missing.scrollChildContextCandidates.size,0);
  const scaled=ArrangeMeasuredGeometry(prepared,root,2,{
    scrollScrollbarViewportDiagnostics:true, scrollOffsetSamples:samples
  });
  assert.equal(scaled.scrollChildContextCandidates.size,0);
  const invalid=ArrangeMeasuredGeometry(prepared,root,1,{
    scrollScrollbarViewportDiagnostics:true,
    scrollOffsetSamples:new Map([["scroll",{horizontal:NaN,vertical:0}]])
  });
  assert.equal(invalid.scrollChildContextCandidates.size,0);
});

test("non-Scroll widgets cannot inherit Scroll child-context projection", async () => {
  const { MeasureLayoutTree } = await import("../.geometry-engine-test-build/LayoutMeasurement.js");
  const { ArrangeMeasuredGeometry } = await import("../.geometry-engine-test-build/GeometrySnapshot.js");
  const panel={id:"panel",name:"panel",type:"PanelWidgetClass",
    properties:[{name:"size",value:"100 60"},{name:"hexactsize",value:"1"},
      {name:"vexactsize",value:"1"}],children:[]};
  const snapshot=ArrangeMeasuredGeometry(MeasureLayoutTree([panel]),
    {x:0,y:0,width:400,height:300},1,{
      scrollScrollbarViewportDiagnostics:true,
      scrollOffsetSamples:new Map([["panel",{horizontal:2,vertical:3}]])
    });
  assert.equal(snapshot.scrollChildContextCandidates.size,0);
});
