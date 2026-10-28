import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CompareWorkbenchScrollFixtures } from "../scripts/compare-workbench-scroll.mjs";

const template=JSON.parse(readFileSync(
 new URL("./fixtures/workbench-scroll/capture.template.json",import.meta.url),"utf8"
));
function Copy(data) { return JSON.parse(JSON.stringify(data)); }

test("all four Workbench capture cases are PENDING, never invented passing golden fixtures",()=>{
 const report=CompareWorkbenchScrollFixtures(template);
 assert.deepEqual(report.summary,{pass:0,fail:0,pending:4,synthetic:0});
 assert.deepEqual(report.results.map(x=>x.id),[
  "ScrollNone","ScrollVertical","ScrollBoth","ScrollLeft"
 ]);
 assert.deepEqual(report.results.map(x=>x.predicted.childViewport),[
  {x:0,y:0,width:240,height:180},
  {x:0,y:0,width:230,height:180},
  {x:0,y:0,width:230,height:170},
  {x:10,y:0,width:230,height:170}
 ]);
});

test("mock observations demonstrate comparator pass/fail math, not native validation",()=>{
 const item=Copy(template.cases[3]);
 item.provenance={
  captureMethod:"unit-test-double",workbenchBuild:"mock-only",evidenceFile:"not-a-real-capture"
 };
 item.observed={
  childViewport:{x:10,y:0,width:230,height:170},
  childContext:{x:10,y:0,width:230,height:170}
 };
 let check=CompareWorkbenchScrollFixtures({schemaVersion:1,cases:[item]});
 assert.deepEqual(check.summary,{pass:1,fail:0,pending:0,synthetic:0});
 item.observed.childContext.x=11;
 check=CompareWorkbenchScrollFixtures({schemaVersion:1,cases:[item]});
 assert.equal(check.summary.fail,1);
 assert.match(check.results[0].errors[0],/childContext|x: expected/);
});

test("out-of-tolerance errors fail; within-tolerance differences pass",()=>{
 const item=Copy(template.cases[1]);
 item.provenance={captureMethod:"test-double",workbenchBuild:"mock-only",evidenceFile:"not-a-real-capture"};
 item.observed={
  childViewport:{x:0.2,y:0,width:229.7,height:180},
  childContext:{x:0,y:0.3,width:230,height:180}
 };
 const good=CompareWorkbenchScrollFixtures({schemaVersion:1,cases:[item]});
 assert.equal(good.summary.pass,1);
 item.tolerance=0.1;
 const bad=CompareWorkbenchScrollFixtures({schemaVersion:1,cases:[item]});
 assert.equal(bad.summary.fail,1);
 assert.ok(bad.results[0].errors.length>=1);
});

test("observed measurements require an independent provenance record",()=>{
 const item=Copy(template.cases[0]);
 item.observed={childViewport:{x:0,y:0,width:240,height:180}};
 assert.throws(()=>CompareWorkbenchScrollFixtures({schemaVersion:1,cases:[item]}),
  /independently documented Workbench provenance/);
});

test("duplicate IDs, unsupported native context and invalid observations are rejected",()=>{
 assert.throws(()=>CompareWorkbenchScrollFixtures({schemaVersion:2,cases:[]}),/schemaVersion/);
 assert.throws(()=>CompareWorkbenchScrollFixtures({schemaVersion:1,cases:[]}),/No ScrollWidget/);
 assert.throws(()=>CompareWorkbenchScrollFixtures({
  schemaVersion:1,cases:[template.cases[0],template.cases[0]]
 }),/duplicate fixture id/);
 const item=Copy(template.cases[0]);
 item.settings.vertical="1";
 assert.throws(()=>CompareWorkbenchScrollFixtures({schemaVersion:1,cases:[item]}),
  /Invalid vertical flag/);
 const broken=Copy(template.cases[0]);
 broken.container.width=-1;
 assert.throws(()=>CompareWorkbenchScrollFixtures({schemaVersion:1,cases:[broken]}),
  /Unusable diagnostic inputs/);
});

test("synthetic placeholder observations are never counted as native passes",()=>{
 const item=Copy(template.cases[0]);
 item.observed={
  childViewport:{x:0,y:0,width:240,height:180},
  childContext:{x:0,y:0,width:240,height:180}
 };
 item.provenance={
  captureMethod:"synthetic",workbenchBuild:"mock-only",evidenceFile:"test-data"
 };
 const report=CompareWorkbenchScrollFixtures({schemaVersion:1,cases:[item]});
 assert.deepEqual(report.summary,{pass:0,fail:0,pending:0,synthetic:1});
});
