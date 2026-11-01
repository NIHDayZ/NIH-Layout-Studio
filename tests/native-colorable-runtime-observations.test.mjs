import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";

const evidence = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/panel-color-phase2s-runtime-observations.json", import.meta.url),
	"utf8"
));
const layout = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Panel_Background_Calibration.layout", import.meta.url),
	"utf8"
);
const root = new LayoutParser().Parse(layout).roots[0];

function FindNode(node, name) {
	if (node.name === name)
		return node;
	for (const child of node.children) {
		const candidate = FindNode(child, name);
		if (candidate)
			return candidate;
	}
	return null;
}

test("Phase 2S native getter ARGB exactly preserves authored 8-bit rgba at all sampled widgets", () => {
	assert.equal(evidence.captureCycles, 2);
	assert.deepEqual(evidence.capturePhases, ["after-create", "post-update"]);
	assert.equal(evidence.recordsPerPhase, 10);
	assert.equal(evidence.totalWidgetRecords, 40);
	assert.equal(evidence.allFourGroupsIdentical, true);
	assert.equal(evidence.records.length, 10);
	assert.equal(new Set(evidence.records.map(row => row.name)).size, 10);
	for (const record of evidence.records) {
		const node = FindNode(root, record.name);
		assert.ok(node, record.name + " missing native layout");
		assert.equal(node.type, "PanelWidgetClass");
		const attrs = new Map(node.properties.map(property => [property.name.toLowerCase(), property.value]));
		assert.equal(attrs.get("style"), record.style);
		assert.equal(record.type, "PanelWidget");
		const authored = attrs.get("color").trim().split(/\s+/).map(Number);
		assert.equal(authored.length, 4);
		const bytes = authored.map(channel => Math.round(channel * 255));
		const unsigned = (((bytes[3] << 24) | (bytes[0] << 16)
			| (bytes[1] << 8) | bytes[2]) >>> 0);
		assert.equal(record.colorARGBSigned >>> 0, unsigned, record.name + " channel encoding");
		assert.equal(record.colorARGBHex, "0x" + unsigned.toString(16).padStart(8, "0").toUpperCase());
		assert.ok(Math.abs(record.alpha - bytes[3] / 255) <= 0.000001, record.name + " alpha quantization");
		assert.equal(record.visible, true);
	}
});

test("Phase 2S identical raw flags do not independently establish GPU blend state", () => {
	assert.equal(evidence.rawWidgetFlags, 536870975);
	assert.equal(evidence.rawWidgetFlagsHex, "0x2000003F");
	assert.equal(evidence.enumMaskValuesCaptured, true);
	assert.equal(evidence.enumMaskCapture.captureCount, 2);
	assert.deepEqual(evidence.enumMaskCapture.values, {
		SOURCEALPHA: 4194304,
		BLEND: 1048576,
		ADDITIVE: 2097152,
		NOFILTER: 16777216
	});
	for (const [name, mask] of Object.entries(evidence.enumMaskCapture.values)) {
		assert.equal(evidence.rawWidgetFlags & mask, 0, name + " must be absent from native widget flags");
		assert.equal(evidence.enumMaskCapture.hex[name],
			"0x" + mask.toString(16).padStart(8, "0").toUpperCase());
	}
	assert.equal(evidence.enumMaskCapture.flagsAndMasksOverlap, 0);
	for (const record of evidence.records) {
		assert.equal(record.flags, evidence.rawWidgetFlags);
		for (const name of ["sourceAlpha", "blend", "additive", "noFilter"])
			assert.equal(record[name], false, record.name + " " + name);
	}
	for (let i = 1; i <= 4; ++i) {
		assert.equal(evidence.records[i].colorARGBHex, evidence.records[i + 5].colorARGBHex,
			"same authored colors over two backdrops");
		assert.equal(evidence.records[i].alpha, evidence.records[i + 5].alpha);
	}
});
