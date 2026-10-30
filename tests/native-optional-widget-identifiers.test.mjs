import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { ResolveRect } from "../.geometry-engine-test-build/LayoutMath.js";

const p = new LayoutParser();
const hud = [
	"FrameWidgetClass {",
	'\tName "HudFrameWidget"',
	"\tclipchildren 0",
	"\tposition 0 0",
	"\tsize 0.9 0.9",
	"\thalign center_ref",
	"\tvalign center_ref",
	"\thexactsize 0",
	"\tvexactsize 0",
	"\t{",
	'\t\tRichTextWidgetClass "{00000000E4E67D3A}" {',
	'\t\t\tName "DefaultActionWidget"',
	"\t\t\tvisible 1",
	"\t\t}",
	"\t\tPanelWidgetClass {",
	'\t\t\tName "StatusPanel"',
	"\t\t\tposition 0 0",
	"\t\t\tsize 0.5 0.1",
	"\t\t}",
	"\t}",
	"}"
].join("\r\n");

test("vanilla DayZ HUD root without a declaration ID is parsed as one parent rather than eight detached roots", () => {
	const doc = p.Parse(hud);
	assert.equal(doc.roots.length, 1);
	const root = doc.roots[0];
	assert.equal(root.type, "FrameWidgetClass");
	assert.equal(root.sourceHasNoIdentifier, true);
	assert.equal(root.name, "HudFrameWidget");
	assert.equal(root.children.length, 2);
	assert.equal(root.children[0].name, '"{00000000E4E67D3A}"');
	assert.equal(root.children[1].name, "StatusPanel");
	assert.ok(root.children.every(child => child.sourceGroupParentId === root.id));
});

test("HUD root center_ref applies its 90% dimensions before resolving children", () => {
	const [root] = p.Parse(hud).roots;
	const rect = ResolveRect(root, {x:0,y:0,width:1920,height:1080});
	assert.deepEqual(rect,{x:96,y:54,width:1728,height:972});
	const nested = ResolveRect(root.children[1],{x:0,y:0,width:rect.width,height:rect.height});
	assert.deepEqual(nested,{x:0,y:0,width:864,height:97.2});
});

test("canonical serialization retains ID-less declaration and friendly Name without fabricating an identifier", () => {
	const doc = p.Parse(hud);
	const serialized = p.Serialize(doc);
	assert.ok(serialized.startsWith("FrameWidgetClass {\n"));
	assert.ok(serialized.includes('Name "HudFrameWidget"'));
	assert.ok(serialized.includes('RichTextWidgetClass "{00000000E4E67D3A}" {'));
	assert.ok(serialized.includes("PanelWidgetClass {"));
	assert.equal(serialized.includes("FrameWidgetClass HudFrameWidget"), false);
	const round = p.Parse(serialized);
	assert.equal(round.roots.length,1);
	assert.equal(round.roots[0].children.length,2);
	assert.equal(round.roots[0].name,"HudFrameWidget");
	assert.equal(round.roots[0].sourceHasNoIdentifier,true);
	assert.equal(p.Serialize(round),serialized);
	assert.equal(doc.source,hud,"unchanged source remains byte-preserved with CRLF");
});

test("all widget families support mixed ID-backed and ID-less children with braces on next line", () => {
	const source=[
		"FrameWidgetClass OldNamedRoot {",
		"  {",
		"    ImageWidgetClass",
		"    {",
		'      Name "NoIdImage"',
		"      size 0.25 0.25",
		"    }",
		'    ButtonWidgetClass "{0000000000000001}" {',
		'      Name "NewIdButton"',
		"    }",
		"    TextWidgetClass LegacyText {",
		'      text "Old"',
		"    }",
		"  }",
		"}"
	].join("\n");
	const doc = p.Parse(source);
	assert.equal(doc.roots.length,1);
	assert.equal(doc.roots[0].name,"OldNamedRoot");
	assert.deepEqual(doc.roots[0].children.map(child => child.name),["NoIdImage",'"{0000000000000001}"',"LegacyText"]);
	assert.equal(doc.roots[0].children[0].sourceHasNoIdentifier,true);
	assert.equal(doc.roots[0].children[1].sourceHasNoIdentifier,undefined);
	assert.equal(doc.roots[0].children[2].sourceHasNoIdentifier,undefined);
	assert.ok(p.Serialize(doc).includes("ImageWidgetClass {"));
	assert.ok(p.Serialize(doc).includes("TextWidgetClass LegacyText {"));
	assert.equal(p.Parse(p.Serialize(doc)).roots[0].children.length,3);
});

test("ID-less widgets with no Name property receive a UI-only lookup label", () => {
	const source="FrameWidgetClass {\n {\n  TextWidgetClass {\n   text \"unnamed\"\n  }\n }\n}";
	const [root]=p.Parse(source).roots;
	assert.equal(root.name,"FrameWidgetClass@1");
	assert.equal(root.children[0].name,"TextWidgetClass@3");
	assert.equal(root.sourceHasNoIdentifier,true);
	assert.equal(root.children[0].sourceHasNoIdentifier,true);
	const canonical=p.Serialize(p.Parse(source));
	assert.equal(canonical.includes("@1"),false);
	assert.equal(canonical.includes("@3"),false);
	assert.equal(p.Parse(canonical).roots[0].children.length,1);
});

test("a bare class token must not be confused with an unrelated property declaration", () => {
	const doc=p.Parse("FrameWidgetClass Root {\n  FrameWidgetClassValue 123\n  {\n    PanelWidgetClass {\n      Name \"Child\"\n    }\n  }\n}");
	assert.equal(doc.roots.length,1);
	assert.equal(doc.roots[0].children.length,1);
	assert.equal(doc.roots[0].children[0].name,"Child");
});

test("App source edits preserve ID-less declarations in rename, paste and duplicate operations", () => {
	const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
	assert.ok(app.includes("if (node.sourceHasNoIdentifier) {"));
	assert.ok(app.includes('name: "Name", rawValue: JSON.stringify(name)'));
	assert.ok(app.includes("if (root?.type === type && root.sourceHasNoIdentifier)"));
	assert.ok(app.includes("return PatchNodeName(localSource, root, newName).split"));
	assert.ok(app.includes("const block = RenameSourceBlockRoot(lines.slice(range.start, range.end + 1), node.type, node.name, newName);"));
});
