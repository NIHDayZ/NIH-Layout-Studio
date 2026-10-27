import assert from "node:assert/strict";
import test from "node:test";
import { LayoutParser } from "../.layout-parser-test-build/parser/LayoutParser.js";
import { MakeCopiedWidgetNameFromNames } from "../.layout-parser-test-build/model/WidgetCopyName.js";

const source = [
	'FrameWidgetClass Root {',
	'  visible 1',
	'  {',
	'    RichTextWidgetClass "{00000000E4E67D3A}" {',
	'      Name "DefaultActionWidget"',
	'      visible 1',
	'    }',
	'    TextWidgetClass OldWidget {',
	'      text "Legacy"',
	'    }',
	'  }',
	'}'
].join("\n");

test("parses Workbench ID declarations alongside legacy widget names", () => {
	const document = new LayoutParser().Parse(source);
	assert.equal(document.roots.length, 1);
	assert.equal(document.roots[0].children.length, 2);
	assert.equal(document.roots[0].children[0].name, '"{00000000E4E67D3A}"');
	assert.equal(document.roots[0].children[0].properties.find(property => property.name === "Name")?.value, "DefaultActionWidget");
	assert.equal(document.roots[0].children[1].name, "OldWidget");
});

test("serialization preserves quoted widget ID and friendly Name separately", () => {
	const parser = new LayoutParser();
	const serialized = parser.Serialize(parser.Parse(source));
	assert.ok(serialized.includes('RichTextWidgetClass "{00000000E4E67D3A}" {'));
	assert.match(serialized, /Name "DefaultActionWidget"/);
	const roundTrip = parser.Parse(serialized);
	assert.equal(roundTrip.roots[0].children.length, 2);
	assert.equal(roundTrip.roots[0].children[0].name, '"{00000000E4E67D3A}"');
});

test("accepts declaration brace on following line for ID-backed widgets", () => {
	const document = new LayoutParser().Parse('TextWidgetClass "{00000000000000AA}"\n{\n Name "Label"\n visible 1\n}');
	assert.equal(document.roots[0].properties.length, 2);
});

test("duplicate/paste generate valid unique IDs that survive a parse and save", () => {
	const parser = new LayoutParser();
	const original = '"{00000000E4E67D3A}"';
	const existing = new Set([original, '"{00000000E4E67D3B}"']);
	const copied = MakeCopiedWidgetNameFromNames(existing, original);
	assert.equal(copied, '"{00000000E4E67D3C}"');
	const editedSource = source.replace('RichTextWidgetClass "{00000000E4E67D3A}" {', `RichTextWidgetClass ${copied} {`);
	const edited = parser.Parse(editedSource);
	assert.equal(edited.roots[0].children[0].name, copied);
	assert.equal(parser.Parse(parser.Serialize(edited)).roots[0].children[0].name, copied);
	assert.equal(MakeCopiedWidgetNameFromNames(new Set(["Label_Copy"]), "Label"), "Label_Copy2");
});
