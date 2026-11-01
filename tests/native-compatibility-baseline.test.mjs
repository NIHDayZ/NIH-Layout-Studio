import test from "node:test";
import assert from "node:assert/strict";
import {
	BuildNativeCompatibilityBaseline,
	FormatNativeCompatibilityMarkdown
} from "../scripts/Generate-NativeCompatibilityBaseline.mjs";

function Find(report, name) {
	const item = report.classes.find(entry => entry.name === name);
	assert.ok(item, "class not inventoried: " + name);
	return item;
}

test("compatibility baseline enumerates all 49 Workbench schema classes without declaring parity", () => {
	const report = BuildNativeCompatibilityBaseline();
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.summary.cataloguedClasses, 49);
	assert.equal(report.classes.length, 49);
	assert.equal(new Set(report.classes.map(item => item.name)).size, 49);
	assert.equal(report.summary.nativeCensusProvided, false);
	assert.equal(report.summary.overallParityPercentage, null);
	assert.match(report.summary.overallParityReason, /not exhaustive/);
	assert.ok(report.summary.repositoryLayoutFixtures >= 10);
	assert.ok(report.summary.classesExercisedByFixtures >= 3);
	for (const entry of report.classes) {
		assert.ok(entry.family);
		assert.ok(entry.parser);
		assert.ok(["scoped-native-measurement", "automated-evidence-only",
			"native-comparison-pending", "not-demonstrated"].includes(entry.geometry));
		assert.ok(["scoped-native-measurement", "automated-evidence-only",
			"native-comparison-pending", "not-demonstrated"].includes(entry.render));
	}
});

test("compatibility evidence stays scoped to geometry, panel color, and pending scroll comparisons", () => {
	const report = BuildNativeCompatibilityBaseline();
	assert.equal(Find(report, "GridSpacerWidgetClass").geometry, "scoped-native-measurement");
	assert.equal(Find(report, "PanelWidgetClass").render, "scoped-native-measurement");
	assert.equal(Find(report, "FrameWidgetClass").roundtrip, "scoped-native-measurement");
	assert.equal(Find(report, "ScrollWidgetClass").geometry, "native-comparison-pending");
	assert.equal(Find(report, "ScrollWidgetClass").render, "not-demonstrated");
	assert.equal(Find(report, "TextWidgetClass").render, "automated-evidence-only");
	assert.equal(Find(report, "ImageWidgetClass").render, "automated-evidence-only");
	assert.equal(Find(report, "VideoWidgetClass").render, "not-demonstrated");
	assert.equal(Find(report, "MapWidgetClass").roundtrip, "not-demonstrated");
	assert.ok(Find(report, "GridSpacerWidgetClass").fixtureFiles > 0);
	assert.ok(Find(report, "PanelWidgetClass").fixtureFiles > 0);
	assert.ok(Find(report, "FrameWidgetClass").fixtureFiles > 0);
});

test("native usage weighting is optional and unknown native widget classes are not silently counted as supported", () => {
	const census = {
		layoutFiles: 3, widgetDeclarations: 100, skippedCompressedLayouts: 1,
		classes: [
			{ name: "PanelWidgetClass", count: 88, layoutCount: 3, examples: [] },
			{ name: "GridSpacerWidgetClass", count: 11, layoutCount: 2, examples: [] },
			{ name: "NovelWidgetClass", count: 1, layoutCount: 1, examples: [] }
		]
	};
	const report = BuildNativeCompatibilityBaseline({ census });
	assert.equal(report.summary.nativeCensusProvided, true);
	assert.equal(report.summary.nativeLayoutFiles, 3);
	assert.equal(report.summary.skippedCompressedNativeLayouts, 1);
	assert.equal(Find(report, "PanelWidgetClass").nativeCensusDeclarations, 88);
	assert.equal(Find(report, "GridSpacerWidgetClass").nativeCensusLayouts, 2);
	assert.equal(Find(report, "TextWidgetClass").nativeCensusDeclarations, null);
	assert.deepEqual(report.additionalNative.map(item => item.name), ["NovelWidgetClass"]);
	assert.equal(report.summary.overallParityPercentage, null);
});

test("malformed native census cannot produce spurious compatibility coverage", () => {
	assert.throws(() => BuildNativeCompatibilityBaseline({ census: { classes: [] } }),
		/Expected JSON/);
	assert.throws(() => BuildNativeCompatibilityBaseline({ census: {
		layoutFiles: 2, classes: [
			{ name: "PanelWidgetClass", count: 3, layoutCount: 1 },
			{ name: "PanelWidgetClass", count: 4, layoutCount: 1 }
		]
	} }), /invalid or duplicate/);
});

test("Markdown baseline identifies native proof boundaries and cannot synthesize a completion score", () => {
	const report = BuildNativeCompatibilityBaseline();
	const markdown = FormatNativeCompatibilityMarkdown(report);
	assert.match(markdown, /49/);
	assert.match(markdown, /Overall parity percentage: NOT MEASURABLE/);
	assert.match(markdown, /GridSpacerWidgetClass/);
	assert.match(markdown, /PanelWidgetClass/);
	assert.match(markdown, /native-comparison-pending/);
	assert.match(markdown, /No/);
	assert.ok(!markdown.includes("100% compatible"));
	assert.equal(markdown.split("\n").filter(line => line.startsWith("| ") && line.includes("WidgetClass")).length, 49);
});
