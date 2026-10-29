import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { BuildAuthoredGeometrySnapshot } from "../.geometry-engine-test-build/GeometrySnapshot.js";
import { ResolveTextStyle } from "../.geometry-engine-test-build/LayoutMath.js";

const fixture = readFileSync(new URL(
	"./fixtures/native-font-valign/NIH_NativeFontVAlign_Parity.layout", import.meta.url
), "utf8");
const roots = new LayoutParser().Parse(fixture).roots;
const columns = ["Default","Top","Center","Bottom"];
const rows = [
	["Text72Tall","TextWidgetClass","gui/fonts/sdf_MetronBook72",110],
	["Text72Short","TextWidgetClass","gui/fonts/sdf_MetronBook72",34],
	["Text24","TextWidgetClass","gui/fonts/sdf_MetronBook24",44],
	["Button72","ButtonWidgetClass","gui/fonts/sdf_MetronBook72",68],
	["Button24","ButtonWidgetClass","gui/fonts/sdf_MetronBook24",44]
];
function Property(node, name) {
	return node.properties.find(p => p.name.toLowerCase() === name)?.value;
}

test("vertical alignment fixture parses 20 named TextWidget/ButtonWidget controls", () => {
	assert.equal(roots.length, 1);
	assert.equal(roots[0].name, "NIHNativeFontVAlignParity");
	assert.equal(roots[0].children.length, 20);
	assert.deepEqual(roots[0].children.map(node => node.name),
		rows.flatMap(row => columns.map(column => row[0] + "_" + column)));
	for (let row = 0; row < rows.length; ++row) {
		for (let column = 0; column < columns.length; ++column) {
			const node = roots[0].children[row * 4 + column];
			const [_,type,font] = rows[row];
			assert.equal(node.type, type);
			assert.equal(Property(node,"font"),font);
			assert.equal(Property(node,"text"),"ABC");
			assert.equal(Property(node,"text valign"),
				column === 0 ? undefined : columns[column].toLowerCase());
		}
	}
});

test("all alignment variants keep geometry and font reference identical within each row", () => {
	const snapshot = BuildAuthoredGeometrySnapshot(roots, { x:0, y:0, width:1280, height:720 });
	assert.deepEqual(snapshot.issues, []);
	assert.equal(snapshot.entries.length, 21);
	const xs = [40,350,660,970], ys = [80,225,320,435,560];
	for(let r = 0; r < rows.length; ++r) {
		for(let c = 0; c < columns.length; ++c) {
			const node = roots[0].children[r*4+c];
			const rect = snapshot.byId.get(node.id)?.absoluteRect;
			assert.ok(rect);
			assert.deepEqual(rect, {x:xs[c],y:ys[r],width:270,height:rows[r][3]});
		}
	}
});

test("shared text style normalizes explicit top, center and bottom without claiming Workbench paint", () => {
	for (let r=0; r<rows.length; ++r) {
		for (let c=1; c<4; ++c) {
			const node=roots[0].children[r*4+c];
			const rect={x:0,y:0,width:270,height:rows[r][3]};
			const style=ResolveTextStyle(node,rect);
			assert.equal(style.vAlign,columns[c].toLowerCase());
		}
	}
	// ButtonWidget's default centered behavior is applied in Canvas, not ResolveTextStyle.
	// Its actual Workbench default must be observed rather than inferred from this test.
});

test("vertical alignment native/Studio capture remains pending until screenshot evidence", () => {
	const capture=JSON.parse(readFileSync(new URL(
		"./fixtures/native-font-valign/capture.template.json",import.meta.url
	),"utf8"));
	assert.equal(capture.captureKind,"native-font-vertical-alignment-pending");
	assert.equal(capture.cases.length,20);
	assert.deepEqual(capture.cases.map(c=>c.id),roots[0].children.map(c=>c.name));
	assert.ok(capture.cases.every(c=>c.nativeInkBounds===null &&
		c.studioInkBounds===null && c.nativeResult==="pending"));
	assert.equal(capture.nativeAlignmentVerified,false);
});
