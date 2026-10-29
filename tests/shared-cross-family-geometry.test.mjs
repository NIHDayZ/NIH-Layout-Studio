import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { LegacyResolveRect } from "./reference/legacy-widget-geometry.mjs";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const source = readFileSync(new URL(
	"./fixtures/workbench-common/NIH_Common_Geometry_Parity.layout", import.meta.url
), "utf8");
const roots = new LayoutParser().Parse(source).roots;
const viewportSizes = [
	{ x: 0, y: 0, width: 1120, height: 460 },
	{ x: 41, y: -17, width: 1440, height: 900 },
	{ x: -30, y: 56, width: 1920, height: 1080 },
	{ x: 5.5, y: 12.25, width: 780.5, height: 520.25 }
];

function ReadFirst(node, key) {
	return node.properties.find(property => property.name.toLowerCase() === key)?.value;
}

// Frozen pre-refactor geometry oracle + independent hierarchy traversal.
// This is a Studio compatibility baseline, NOT a Workbench-native oracle.
function LegacyWalk(nodes, parent, inheritedClip, parentVisible, parentId, entries) {
	for (const node of nodes) {
		const local = LegacyResolveRect(node, parent);
		const absolute = {
			x: parent.x + local.x, y: parent.y + local.y,
			width: local.width, height: local.height
		};
		const visible = parentVisible && ReadFirst(node, "visible") !== "0";
		entries.push({
			id: node.id, parentId,
			localRect: local, absoluteRect: absolute,
			clipRect: inheritedClip ? { ...inheritedClip } : null,
			visible,
			sortOrder: Number(ReadFirst(node, "priority") ?? 0)
		});
		let clip = inheritedClip;
		if (ReadFirst(node, "clipchildren") === "1") {
			if (!clip) {
				clip = { ...absolute };
			} else {
				const left = Math.max(clip.x, absolute.x);
				const top = Math.max(clip.y, absolute.y);
				const right = Math.min(clip.x + clip.width, absolute.x + Math.max(0, absolute.width));
				const bottom = Math.min(clip.y + clip.height, absolute.y + Math.max(0, absolute.height));
				clip = {
					x: left, y: top,
					width: Math.max(0, right - left),
					height: Math.max(0, bottom - top)
				};
			}
		}
		LegacyWalk(node.children, absolute, clip, visible, node.id, entries);
	}
}

test("source fixture spans five common widget families and mixed authored geometry", () => {
	assert.equal(roots.length, 1);
	assert.equal(roots[0].name, "NIHCommonParity");
	const classes = new Set();
	const names = new Set();
	const walk = nodes => {
		for (const node of nodes) {
			classes.add(node.type);
			names.add(node.name);
			walk(node.children);
		}
	};
	walk(roots);
	assert.deepEqual([...classes].sort(), [
		"ButtonWidgetClass", "FrameWidgetClass", "ImageWidgetClass",
		"PanelWidgetClass", "TextWidgetClass"
	]);
	for (const name of ["Panel_Relative", "Image_RightRef", "Button_CenterRef",
		"Panel_RightBottom", "Text_BottomRef", "Button_PlainRight",
		"Panel_Hidden", "Text_HiddenDescendant", "Frame_Overhang"]) {
		assert.ok(names.has(name), "Missing fixture scenario " + name);
	}
	assert.equal(names.size, 17);
});

test("shared measured geometry equals frozen pre-refactor hierarchy arithmetic at four independent viewports", () => {
	const prepared = MeasureLayoutTree(roots);
	assert.equal(prepared.managedContainerCount, 0);
	assert.equal(prepared.unresolvedContentSizeCount, 0);
	const sourceBefore = JSON.stringify(roots);
	for (const viewport of viewportSizes) {
		const expected = [];
		LegacyWalk(roots, viewport, viewport, true, null, expected);
		const snapshot = ArrangeMeasuredGeometry(prepared, viewport);
		assert.deepEqual(snapshot.entries, expected, JSON.stringify(viewport));
		assert.equal(snapshot.entries.length, prepared.nodeCount);
		assert.deepEqual(snapshot.issues, []);
		assert.deepEqual(snapshot.appliedStrategies, []);
		assert.equal(snapshot.byId.size, snapshot.entries.length);
		assert.deepEqual(snapshot.rootRect, viewport);
	}
	assert.equal(JSON.stringify(roots), sourceBefore);
});

test("the same prepared tree preserves relative child sizing and alignment across viewport sizes", () => {
	const prepared = MeasureLayoutTree(roots);
	const a = ArrangeMeasuredGeometry(prepared, viewportSizes[0]);
	const b = ArrangeMeasuredGeometry(prepared, viewportSizes[1]);
	const byName = (snap, name) => {
		const node = [...snap.entries].find(entry => {
			const Find = nodes => {
				for (const n of nodes) {
					if (n.id === entry.id)
						return n.name === name;
					if (Find(n.children))
						return true;
				}
				return false;
			};
			return Find(roots);
		});
		assert.ok(node, name);
		return node;
	};
	const rightA = byName(a, "Panel_RightBottom").absoluteRect;
	const rightB = byName(b, "Panel_RightBottom").absoluteRect;
	assert.deepEqual(rightA, { x: 856, y: 310, width: 240, height: 120 });
	assert.deepEqual(rightB, { x: 1217, y: 733, width: 240, height: 120 });
	const nestedA = byName(a, "Panel_Relative").localRect;
	const nestedB = byName(b, "Panel_Relative").localRect;
	assert.deepEqual(nestedA, { x: 33, y: 31.5, width: 198, height: 105 });
	assert.deepEqual(nestedB, nestedA, "exact outer frame keeps relative descendants stable");
	const rootA = byName(a, "NIHCommonParity").absoluteRect;
	const rootB = byName(b, "NIHCommonParity").absoluteRect;
	assert.deepEqual(rootA, viewportSizes[0]);
	assert.deepEqual(rootB, viewportSizes[1]);
});

test("hidden subtree and nested clipping are inherited consistently without changing native layout claims", () => {
	const prepared = MeasureLayoutTree(roots);
	const snapshot = ArrangeMeasuredGeometry(prepared, viewportSizes[0]);
	const byName = (name) => {
		const Walk = nodes => {
			for (const node of nodes) {
				if (node.name === name)
					return snapshot.byId.get(node.id);
				const found = Walk(node.children);
				if (found)
					return found;
			}
			return null;
		};
		return Walk(roots);
	};
	assert.equal(byName("Panel_Hidden").visible, false);
	assert.equal(byName("Text_HiddenDescendant").visible, false);
	assert.equal(byName("Text_Exact").visible, true);
	assert.deepEqual(byName("Frame_Overhang").clipRect,
		{ x: 20, y: 20, width: 330, height: 210 });
	assert.deepEqual(byName("Button_Overhang").clipRect,
		{ x: 310, y: 185, width: 40, height: 45 });
});
