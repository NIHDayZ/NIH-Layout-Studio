import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { InspectNativePropertyCompatibility } from "../.geometry-engine-test-build/NativePropertyCompatibility.js";

const names=[
	"FrameBase","FrameContentBefore0","FrameContentAfter0",
	"FrameUnknownBefore0","FrameUnknownAfter0",
	"FrameClipBefore1","FrameClipAfter1","PanelBase",
	"PanelContentBefore0","PanelContentAfter0",
	"PanelUnknownBefore0","PanelUnknownAfter0"
];
const native=JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-content/capture.property-syntax.native.2026-10-28.json",import.meta.url
),"utf8"));
const source=name=>readFileSync(new URL(
	"./fixtures/workbench-content/syntax-matrix/"+name+".layout",import.meta.url
),"utf8");
const p=new LayoutParser();

function Shape(node) {
	return {
		type:node.type,name:node.name,
		properties:node.properties.map(x=>[x.name,x.value,x.rawName,x.rawValue]),
		children:node.children.map(Shape)
	};
}
function ShapeDocument(doc) {
	return doc.roots.map(Shape);
}

test("canonical parse/serialize preserves native-tested property/group ordering for all twelve Frame/Panel syntax controls",()=>{
	for(const name of names) {
		const original=p.Parse(source(name));
		const before=InspectNativePropertyCompatibility(original.roots);
		const serialized=p.Serialize(original);
		const roundTrip=p.Parse(serialized);
		const after=InspectNativePropertyCompatibility(roundTrip.roots);
		assert.deepEqual(ShapeDocument(roundTrip),ShapeDocument(original),name);
		assert.deepEqual(before.map(x=>[x.code,x.severity,x.sourceOrder]),
			after.map(x=>[x.code,x.severity,x.sourceOrder]),name);
		const actual=native.cases[name]["after-create"].childCount;
		assert.ok(actual===0||actual===2,name+" native child count");
		const group=roundTrip.roots[0].children[0].children;
		assert.equal(group.length,2,name+" authored children remain intact");
		assert.ok(group.every(child=>child.sourceGroupParentId===roundTrip.roots[0].children[0].id),
			name+" group owner is retained on reparse");
		// Canonical serialization must become stable after one formatting pass.
		assert.equal(p.Serialize(roundTrip),serialized,name+" idempotent");
	}
});

test("unsupported properties after children remain AFTER the native child-group close, not just after child declarations",()=>{
	for(const name of ["FrameContentAfter0","FrameUnknownAfter0","PanelContentAfter0","PanelUnknownAfter0"]) {
		const serialized=p.Serialize(p.Parse(source(name)));
		const post=serialized.indexOf("Size To Content V")>=0
			? serialized.indexOf('"Size To Content V" 0')
			: serialized.indexOf('"NIH_ProbeUnknown" 0');
		const childEnd=serialized.lastIndexOf("\n\t\t\t}");
		assert.ok(post>childEnd,name+" trailing unknown property retained");
		const finding=InspectNativePropertyCompatibility(p.Parse(serialized).roots);
		assert.equal(finding.length,1);
		assert.equal(finding[0].code,"observed-native-safe-after-children");
		assert.equal(finding[0].severity,"info");
	}
});

test("canonical output preserves multiple child groups and an unsupported attribute BETWEEN them",()=>{
	const sample=[
		"FrameWidgetClass Root {",
		"    position 0 0",
		"    {",
		"        PanelWidgetClass First {",
		"            size 60 24",
		"        }",
		"    }",
		'    "NIH_ProbeUnknown" 0',
		"    {",
		"        PanelWidgetClass Second {",
		"            size 90 28",
		"        }",
		"    }",
		"    clipchildren 1",
		"}"
	].join("\r\n");
	const doc=p.Parse(sample);
	assert.equal(doc.roots.length,1);
	assert.equal(doc.roots[0].children.length,2);
	assert.notEqual(doc.roots[0].children[0].sourceGroupLine,
		doc.roots[0].children[1].sourceGroupLine);
	const originalShape=ShapeDocument(doc);
	const serialized=p.Serialize(doc);
	const first=serialized.indexOf("PanelWidgetClass First");
	const middle=serialized.indexOf('"NIH_ProbeUnknown" 0');
	const second=serialized.indexOf("PanelWidgetClass Second");
	const last=serialized.indexOf("clipchildren 1");
	assert.ok(first>=0&&first<middle&&middle<second&&second<last,serialized);
	const round=p.Parse(serialized);
	assert.deepEqual(ShapeDocument(round),originalShape);
	assert.notEqual(round.roots[0].children[0].sourceGroupLine,
		round.roots[0].children[1].sourceGroupLine);
	assert.equal(p.Serialize(round),serialized);
	// Canonical formatting is intentionally not a byte-identical source writer.
	assert.notEqual(serialized,sample);
	assert.equal(doc.source,sample,"original CRLF source remains available untouched");
});

test("new child joins its existing known parent group ahead of an authored unsafe trailing property",()=>{
	const doc=p.Parse(source("FrameUnknownAfter0"));
	const parent=doc.roots[0].children[0];
	parent.children.push({
		id:"new-child",type:"PanelWidgetClass",name:"Added",line:0,
		properties:[{name:"size",value:"40 12",rawName:"size",rawValue:"40 12",line:0}],
		children:[]
	});
	const result=p.Serialize(doc);
	const added=result.indexOf("PanelWidgetClass Added");
	const property=result.indexOf('"NIH_ProbeUnknown" 0');
	assert.ok(added>=0&&added<property,result);
	const reparse=p.Parse(result);
	assert.equal(reparse.roots[0].children[0].children.length,3);
	assert.equal(InspectNativePropertyCompatibility(reparse.roots)[0].code,
		"observed-native-safe-after-children");
});

test("moved child does not reuse the group line from its original parent",()=>{
	const doc=p.Parse([
		"FrameWidgetClass Root {",
		"  {",
		"    PanelWidgetClass One {",
		"      {",
		"        TextWidgetClass Moving {",
		"          text \"hello\"",
		"        }",
		"      }",
		"    }",
		"    PanelWidgetClass Two {",
		"      {",
		"        TextWidgetClass Existing {",
		"          text \"existing\"",
		"        }",
		"      }",
		'      "NIH_ProbeUnknown" 0',
		"    }",
		"  }",
		"}"
	].join("\n"));
	const first=doc.roots[0].children[0];
	const second=doc.roots[0].children[1];
	const moving=first.children.shift();
	assert.ok(moving);
	assert.notEqual(moving.sourceGroupParentId,second.id);
	second.children.push(moving);
	const serialized=p.Serialize(doc);
	const secondStart=serialized.indexOf("PanelWidgetClass Two");
	const existing=serialized.indexOf("TextWidgetClass Existing",secondStart);
	const moved=serialized.indexOf("TextWidgetClass Moving",secondStart);
	const trailing=serialized.indexOf('"NIH_ProbeUnknown" 0',secondStart);
	assert.ok(secondStart>=0&&existing>secondStart&&moved>existing&&moved<trailing,serialized);
	assert.equal(p.Parse(serialized).roots[0].children[1].children.length,2);
});

test("synthesized nodes without source provenance retain canonical property-before-child fallback",()=>{
	const node={
		id:"root",type:"FrameWidgetClass",name:"Root",line:0,
		properties:[{name:"visible",value:"1",rawName:"visible",rawValue:"1",line:0}],
		children:[{id:"child",type:"PanelWidgetClass",name:"Child",line:0,
			properties:[],children:[]}]
	};
	const result=p.Serialize({roots:[node],source:""});
	assert.ok(result.indexOf("visible 1")<result.indexOf("PanelWidgetClass Child"),result);
	assert.equal(p.Parse(result).roots[0].children.length,1);
});
