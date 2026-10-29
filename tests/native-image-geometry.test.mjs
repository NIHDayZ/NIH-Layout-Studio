import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DecodeAuthoredGeometry, ResolveAuthoredRect } from "../.geometry-engine-test-build/WidgetGeometry.js";

function Widget(type, mode, exact = false) {
	return {
		id: "fixture", name: "fixture", type, children: [],
		properties: [
			{ name: "size", value: exact ? "200 0.2" : "0.4 0.2" },
			{ name: "fixaspect", value: String(mode) },
			{ name: "hexactsize", value: exact ? "1" : "0" },
			{ name: "halign", value: "right_ref" }
		]
	};
}

const parent = { width: 1000, height: 400 };
const expected = [
	{ x: 600, y: 0, width: 400, height: 80 },
	{ x: 840, y: 0, width: 160, height: 80 },
	{ x: 200, y: 0, width: 800, height: 400 },
	{ x: 0, y: 0, width: 1000, height: 500 }
];

test("ImageWidget uses the same native fixaspect behavior as other widget families", () => {
	for (const mode of [0, 1, 2, 3]) {
		for (const type of ["ImageWidgetClass", "PanelWidgetClass", "TextWidgetClass", "ButtonWidgetClass"]) {
			const geometry = DecodeAuthoredGeometry(Widget(type, mode));
			assert.equal(geometry.fixAspectMode, mode);
			assert.deepEqual(ResolveAuthoredRect(geometry, parent), expected[mode],
				`${type} native aspect mode ${mode}`);
		}
	}
});

test("either exact-size flag bypasses shared native aspect adjustment", () => {
	for (const mode of [0, 1, 2, 3]) {
		const geometry = DecodeAuthoredGeometry(Widget("ImageWidgetClass", mode, true));
		assert.deepEqual(ResolveAuthoredRect(geometry, parent),
			{ x: 800, y: 0, width: 200, height: 80 });
	}
});

test("Canvas no longer implements competing ImageWidget-only fixaspect modes", () => {
	const source = readFileSync(new URL("../src/components/Canvas.tsx", import.meta.url), "utf8");
	assert.doesNotMatch(source, /function GetImageDestination\s*\(/);
	assert.doesNotMatch(source, /fixAspect\.includes\("(inside|fixwidth|fixheight)"\)/);
	assert.match(source, /const destination: CSSProperties = \{ position: "absolute", inset: 0 \};/);
});
