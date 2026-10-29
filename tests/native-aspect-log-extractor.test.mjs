import test from "node:test";
import assert from "node:assert/strict";
import { ExtractNativeAspectLog } from "../scripts/extract-native-aspect-log.mjs";

const names = [
	"NIHNativeAspectParity", "Parent_Mode0", "Fill_Mode0", "ExactWidthBypass",
	"Parent_Mode1", "Text_Mode1", "Parent_Mode2", "Image_Mode2",
	"Parent_Mode3", "Button_Mode3"
];
function Capture(phase, offset = 0) {
	const lines = ["SCRIPT : [NIH_LayoutStudio][AspectProbe] BEGIN " + phase];
	for (const name of names) {
		lines.push("SCRIPT : [NIH_LayoutStudio][AspectProbe] phase=" + phase +
			" name=" + name + " type=Widget screenRect=" + offset + ",0,100,50");
	}
	lines.push("SCRIPT : [NIH_LayoutStudio][AspectProbe] END " + phase);
	return lines.join("\n");
}
function CompleteLog() {
	return Capture("root-960x500-origin") + "\n" + Capture("root-1280x720-offset", 31);
}

test("extractor uses only recorded native getters, preserving nonzero root offset", () => {
	const result = ExtractNativeAspectLog(CompleteLog(), "1.28.999999", "script_original.log");
	assert.equal(result.cases.length, 2);
	assert.deepEqual(result.cases[1].viewport, { x: 31, y: 0, width: 100, height: 50 });
	assert.equal(Object.keys(result.cases[0].observed).length, 9);
	assert.equal(result.cases[0].observed.Fill_Mode0.width, 100);
	assert.equal(result.cases[0].provenance.evidenceFile, "script_original.log");
});

test("extractor rejects incomplete phases and missing or duplicate observed widgets", () => {
	const log = CompleteLog();
	assert.throws(() => ExtractNativeAspectLog(Capture("root-960x500-origin"), "1.28", "test.log"), /both completed/);
	assert.throws(() => ExtractNativeAspectLog(log.replace(" END root-1280x720-offset", " END wrong"), "1.28", "test.log"), /Unmatched/);
	assert.throws(() => ExtractNativeAspectLog(log.replace(/.*name=Button_Mode3.*\n?/g, ""), "1.28", "test.log"), /Missing independently/);
	const duplicate = log.replace("SCRIPT : [NIH_LayoutStudio][AspectProbe] END root-960x500-origin",
		"SCRIPT : [NIH_LayoutStudio][AspectProbe] phase=root-960x500-origin name=Fill_Mode0 type=Widget screenRect=0,0,100,50\n" +
		"SCRIPT : [NIH_LayoutStudio][AspectProbe] END root-960x500-origin");
	assert.throws(() => ExtractNativeAspectLog(duplicate, "1.28", "test.log"), /Duplicate/);
});

test("extractor rejects invalid rectangles, unexpected widgets and probe errors", () => {
	const log = CompleteLog();
	assert.throws(() => ExtractNativeAspectLog(log.replace("0,0,100,50", "0,0,0,50"), "1.28", "test.log"), /Invalid native rectangle/);
	assert.throws(() => ExtractNativeAspectLog(log.replace("name=Fill_Mode0", "name=UnknownChild"), "1.28", "test.log"), /Missing independently/);
	assert.throws(() => ExtractNativeAspectLog(log + "\n[NIH_LayoutStudio][AspectProbe] ERROR: layout resource unavailable", "1.28", "test.log"), /probe error/);
});

test("extractor cannot silently manufacture version provenance", () => {
	const log = CompleteLog();
	for (const build of ["", "pending", "unknown", "???"]) {
		assert.throws(() => ExtractNativeAspectLog(log, build, "test.log"), /build\/version/);
	}
	assert.throws(() => ExtractNativeAspectLog(log, "1.28", ""), /filename/);
});
