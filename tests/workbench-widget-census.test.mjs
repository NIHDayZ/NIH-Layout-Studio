import test from "node:test";
import assert from "node:assert/strict";
import { CensusPboWidgets, CandidateWidgetRttiNames } from "../scripts/audit-workbench-widgets.mjs";

function Entry(name, bytes) {
	const data = Buffer.from(bytes);
	const header = Buffer.alloc(20);
	header.writeUInt32LE(data.length, 16);
	return { header: Buffer.concat([Buffer.from(name + "\0"), header]), data };
}
function ExamplePbo() {
	const ext = Buffer.concat([Buffer.from("\0"), Buffer.from("sreV"), Buffer.alloc(16), Buffer.from("prefix\0gui\0\0")]);
	const records = [
		Entry("layouts\\example.layout", `FrameWidgetClass Root {
			{
				GridSpacerWidgetClass Grid {
					{ ButtonWidgetClass Button1 {} ButtonWidgetClass Button2 {} }
				}
			}
		}`),
		Entry("layouts\\other.layout", `FrameWidgetClass Other {
			{ ButtonWidgetClass Button3 {} ImageWidgetClass Icon {} }
		}`),
		Entry("fonts\\unrelated.txt", "ButtonWidgetClass Ignored {}")
	];
	const end = Buffer.alloc(21); // Empty filename and 20 zero bytes.
	return Buffer.concat([ext, ...records.map((r) => r.header), end, ...records.map((r) => r.data)]);
}

test("PBO census identifies declarations, distinct classes and per-layout usage", () => {
	const report = CensusPboWidgets(ExamplePbo());
	assert.equal(report.layoutFiles, 2);
	assert.equal(report.widgetDeclarations, 7);
	assert.equal(report.distinctClasses, 4);
	const byName = new Map(report.classes.map((item) => [item.name, item]));
	assert.equal(byName.get("FrameWidgetClass").count, 2);
	assert.equal(byName.get("FrameWidgetClass").layoutCount, 2);
	assert.equal(byName.get("ButtonWidgetClass").count, 3);
	assert.equal(byName.get("ButtonWidgetClass").layoutCount, 2);
	assert.equal(byName.get("GridSpacerWidgetClass").layoutCount, 1);
	assert.equal(report.skippedCompressedLayouts, 0);
});

test("PBO census rejects truncated payloads", () => {
	assert.throws(() => CensusPboWidgets(ExamplePbo().subarray(0, -3)), /PBO payload extends beyond file/);
});

test("RTTI strings are only candidate names, with no inferred vtable addresses", () => {
	const rtti = Buffer.from("xx.?AVGridSpacerWidget@enf@@\0.?AVTextWidget@enf@@\0.?AVOtherClass@@\0");
	assert.deepEqual(CandidateWidgetRttiNames(rtti), ["GridSpacerWidget@enf", "TextWidget@enf"]);
});
