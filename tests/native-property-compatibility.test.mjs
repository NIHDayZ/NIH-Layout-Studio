import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import {
	ClassifyNativePropertyEvidence,
	InspectNativePropertyCompatibility,
	InspectNativePropertySourceOrder
} from "../.geometry-engine-test-build/NativePropertyCompatibility.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const dir="./fixtures/workbench-content/syntax-matrix/";
const dataset=JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-content/capture.property-syntax.native.2026-10-28.json",import.meta.url
),"utf8"));
const source=name=>readFileSync(new URL(dir+name+".layout",import.meta.url),"utf8");
const parse=name=>new LayoutParser().Parse(source(name));
const cases=[
	["FrameBase",null,null],
	["FrameContentBefore0","observed-native-child-loss-risk",0],
	["FrameContentAfter0","serialization-order-risk",2],
	["FrameUnknownBefore0","observed-native-child-loss-risk",0],
	["FrameUnknownAfter0","serialization-order-risk",2],
	["FrameClipBefore1",null,2],
	["FrameClipAfter1",null,2],
	["PanelBase",null,2],
	["PanelContentBefore0","observed-native-child-loss-risk",0],
	["PanelContentAfter0","serialization-order-risk",2],
	["PanelUnknownBefore0","observed-native-child-loss-risk",0],
	["PanelUnknownAfter0","serialization-order-risk",2]
];

test("all 12 class/property/order classifications track actual native hierarchy outcomes without erasing authored children",()=>{
	for(const [name,expectedCode,expectedChildren] of cases) {
		const doc=parse(name);
		const original=JSON.stringify(doc.roots);
		const parent=doc.roots[0].children[0];
		const native=dataset.cases[name]["after-create"];
		assert.equal(parent.children.length,2,name+" authored subtree preserved");
		assert.equal(native.parentPresent,true,name);
		if(expectedChildren!==null)
			assert.equal(native.childCount,expectedChildren,name+" native data");
		const findings=InspectNativePropertyCompatibility(doc.roots);
		if(expectedCode) {
			assert.equal(findings.length,1,name);
			assert.equal(findings[0].code,expectedCode,name);
			assert.equal(findings[0].severity,"warning");
			assert.equal(findings[0].id,parent.id);
			assert.equal(findings[0].basis,"dayz-2026-10-28-property-syntax-probe");
			assert.equal(findings[0].evidence,"observed-child-loss-before-block");
			assert.ok(findings[0].propertyLine>0,name+" line metadata");
		} else {
			assert.equal(findings.length,0,name);
		}
		assert.equal(JSON.stringify(doc.roots),original,name+" document not mutated");
	}
});

test("Studio serialization moves after-child unsupported property before children; read-only warning detects the native regression risk",()=>{
	for(const name of ["FrameContentAfter0","FrameUnknownAfter0","PanelContentAfter0","PanelUnknownAfter0"]) {
		const sourceDocument=parse(name);
		const originalSource=source(name);
		const originalTree=JSON.stringify(sourceDocument.roots);
		const before=InspectNativePropertyCompatibility(sourceDocument.roots);
		assert.equal(before.length,1);
		assert.equal(before[0].code,"serialization-order-risk");
		assert.equal(before[0].sourceOrder,"after-all-children");
		const exported=new LayoutParser().Serialize(sourceDocument);
		assert.notEqual(exported,originalSource,name+" source order reflow");
		const reparsed=new LayoutParser().Parse(exported);
		const after=InspectNativePropertyCompatibility(reparsed.roots);
		assert.equal(after.length,1);
		assert.equal(after[0].code,"observed-native-child-loss-risk");
		assert.equal(after[0].sourceOrder,"before-all-children");
		assert.equal(reparsed.roots[0].children[0].children.length,2);
		assert.equal(JSON.stringify(sourceDocument.roots),originalTree);
	}
});

test("disabled zero property values are NOT treated as safe, and recognized clipchildren stays outside the warning set",()=>{
	for(const widgetType of ["FrameWidgetClass","PanelWidgetClass"]) {
		assert.equal(ClassifyNativePropertyEvidence(widgetType," SIZE TO CONTENT V "),
			"observed-child-loss-before-block");
		assert.equal(ClassifyNativePropertyEvidence(widgetType,"size to content h"),
			"observed-child-loss-before-block");
		assert.equal(ClassifyNativePropertyEvidence(widgetType,"NIH_ProbeUnknown"),
			"observed-child-loss-before-block");
	}
	assert.equal(ClassifyNativePropertyEvidence("FrameWidgetClass","size to text v"),
		"observed-child-loss-before-block");
	assert.equal(ClassifyNativePropertyEvidence("PanelWidgetClass","size to text v"),
		"unverified");
	assert.equal(ClassifyNativePropertyEvidence("FrameWidgetClass","clipchildren"),
		"observed-accepted-with-children");
	assert.equal(ClassifyNativePropertyEvidence("PanelWidgetClass","clipchildren"),
		"unverified");
	assert.equal(ClassifyNativePropertyEvidence("WrapSpacerWidgetClass","size to content v"),
		"observed-accepted-with-children");
	assert.equal(ClassifyNativePropertyEvidence("TextWidgetClass","size to content v"),
		"unverified");
	assert.equal(ClassifyNativePropertyEvidence("OtherWidgetClass","NIH_ProbeUnknown"),
		"unverified");
	assert.equal(ClassifyNativePropertyEvidence("FrameWidgetClass","a never probed property"),
		"unverified");
});

test("missing source line provenance cannot turn a native loader observation into a confident before/after claim",()=>{
	const roots=[{
		id:"root",type:"FrameWidgetClass",name:"root",
		properties:[{name:"Size To Content V",value:"0"}],
		children:[{id:"child",name:"child",type:"PanelWidgetClass",properties:[],children:[]}]
	}];
	const source=JSON.stringify(roots);
	const warnings=InspectNativePropertyCompatibility(roots);
	assert.equal(warnings.length,1);
	assert.equal(warnings[0].code,"mixed-native-property-order");
	assert.equal(warnings[0].severity,"info");
	assert.equal(warnings[0].sourceOrder,"mixed-or-unavailable");
	assert.equal(warnings[0].propertyLine,null);
	assert.equal(JSON.stringify(roots),source);
	assert.equal(InspectNativePropertySourceOrder({line:9},[{line:10},{line:8}]),
		"mixed-or-unavailable");
	assert.equal(InspectNativePropertySourceOrder({line:9},[]),"no-children");
	assert.equal(InspectNativePropertySourceOrder({line:5},[{line:10},{line:12}]),
		"before-all-children");
	assert.equal(InspectNativePropertySourceOrder({line:15},[{line:10},{line:12}]),
		"after-all-children");
});

test("unknown widget families and properties are explicitly unverified and only listed on request",()=>{
	const tree=[{
		id:"x",name:"x",type:"CustomWidgetClass",line:1,
		properties:[{name:"AlienFlag",value:"1",line:2}],
		children:[{id:"y",name:"y",type:"PanelWidgetClass",line:3,properties:[],children:[]}]
	}];
	assert.equal(InspectNativePropertyCompatibility(tree).length,0);
	const verbose=InspectNativePropertyCompatibility(tree,{includeUnverified:true});
	assert.equal(verbose.length,1);
	assert.equal(verbose[0].code,"unverified-native-property");
	assert.equal(verbose[0].severity,"info");
	assert.equal(verbose[0].evidence,"unverified");
	assert.equal(verbose[0].basis,"no-native-observation");
	assert.equal(verbose[0].sourceOrder,"before-all-children");
});

test("source diagnostics are strictly opt-in in measurement, cost no extra Canvas traversal by default, and do not affect geometry",()=>{
	const doc=parse("FrameContentBefore0");
	const source=JSON.stringify(doc.roots);
	const baseline=MeasureLayoutTree(doc.roots);
	const observed=MeasureLayoutTree(doc.roots,{nativePropertyDiagnostics:true});
	assert.equal(baseline.nativePropertyDiagnostics.length,0);
	assert.equal(observed.nativePropertyDiagnostics.length,1);
	assert.equal(observed.nativePropertyDiagnostics[0].code,"observed-native-child-loss-risk");
	assert.equal(observed.nodeCount,baseline.nodeCount);
	assert.equal(observed.unresolvedContentSizeCount,baseline.unresolvedContentSizeCount);
	assert.equal(observed.managedContainerCount,baseline.managedContainerCount);
	const viewport={x:0,y:0,width:1120,height:720};
	const a=ArrangeMeasuredGeometry(baseline,viewport);
	const b=ArrangeMeasuredGeometry(observed,viewport);
	assert.deepEqual(a.entries,b.entries);
	assert.deepEqual(a.issues,b.issues);
	assert.deepEqual(a.byId,b.byId);
	assert.deepEqual(a.appliedStrategies,b.appliedStrategies);
	assert.equal(JSON.stringify(doc.roots),source);
});
