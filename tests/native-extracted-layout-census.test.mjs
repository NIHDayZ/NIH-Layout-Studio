import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CensusExtractedLayouts } from "../scripts/Census-ExtractedNativeLayouts.mjs";
import { BuildNativeCompatibilityBaseline } from "../scripts/Generate-NativeCompatibilityBaseline.mjs";

function WithLayouts(files, callback) {
	const root = mkdtempSync(join(tmpdir(), "nih-native-layout-census-"));
	try {
		for (const [relative, content] of Object.entries(files)) {
			const parts = relative.split("/");
			const filename = parts.pop();
			const folder = join(root, ...parts);
			mkdirSync(folder, { recursive: true });
			writeFileSync(join(folder, filename), content, "utf8");
		}
		return callback(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

const s_NamedAndIdless = [
	'FrameWidgetClass {',
	'	Name "Vanilla HUD"',
	'	{',
	'		PanelWidgetClass {',
	'			Name "Health"',
	'		}',
	'		ButtonWidgetClass NamedButton',
	'		{',
	'			text "Close"',
	'		}',
	'		ImageWidgetClass {',
	'		}',
	'	}',
	'}'
].join("\n");

const s_LegacyNamed = [
	'FrameWidgetClass LegacyRoot {',
	'	{',
	'		PanelWidgetClass LegacyPanel {',
	'		}',
	'	}',
	'}'
].join("\n");

test("native layout census handles ID-less, named and next-line declaration braces with real parser", () => {
	WithLayouts({
		"gui/layouts/Hud.layout": s_NamedAndIdless,
		"gui/layouts/Legacy.LAYOUT": s_LegacyNamed
	}, root => {
		const result = CensusExtractedLayouts(root);
		assert.equal(result.layoutFiles, 2);
		assert.equal(result.parsedLayoutFiles, 2);
		assert.equal(result.parseFailures, 0);
		assert.equal(result.widgetDeclarations, 6);
		assert.equal(result.idlessWidgetDeclarations, 3);
		assert.equal(result.distinctClasses, 4);
		const byType = new Map(result.classes.map(item => [item.name, item]));
		assert.equal(byType.get("FrameWidgetClass").count, 2);
		assert.equal(byType.get("PanelWidgetClass").count, 2);
		assert.equal(byType.get("ButtonWidgetClass").count, 1);
		assert.equal(byType.get("ImageWidgetClass").count, 1);
		assert.equal(byType.get("PanelWidgetClass").layoutCount, 2);
		assert.deepEqual(byType.get("ButtonWidgetClass").examples, ["gui/layouts/Hud.layout"]);
		assert.equal(result.skippedCompressedLayouts, 0);
		assert.equal(result.source, "local-extracted-layouts");
	});
});

test("native census source metadata and duplicate source IDs are never counted as child widgets", () => {
	const layout = [
		"FrameWidgetClass Root {",
		"	ScriptParamsClass {",
		"		text \"PanelWidgetClass Fake {\"",
		"	}",
		"	{",
		"		PanelWidgetClass Duplicate {",
		"		}",
		"		PanelWidgetClass Duplicate {",
		"		}",
		"	}",
		"}"
	].join("\n");
	WithLayouts({ "widgets/test.layout": layout }, root => {
		const result = CensusExtractedLayouts(root);
		assert.equal(result.widgetDeclarations, 3);
		assert.equal(result.idlessWidgetDeclarations, 0);
		assert.equal(result.distinctClasses, 2);
		assert.equal(result.parseFailures, 0);
	});
});

test("unparseable native files are reported as failures, not quietly treated as valid fixtures", () => {
	WithLayouts({
		"readable.layout": s_LegacyNamed,
		"broken.layout": "this is not a DayZ widget declaration"
	}, root => {
		const result = CensusExtractedLayouts(root);
		assert.equal(result.layoutFiles, 2);
		assert.equal(result.parsedLayoutFiles, 1);
		assert.equal(result.parseFailures, 1);
		assert.equal(result.failures[0].file, "broken.layout");
		assert.equal(result.widgetDeclarations, 2);
	});
});

test("extracted census preserves no authored source content, only types, counts and relative paths", () => {
	WithLayouts({ "PRIVATE/layout.layout": [
		'FrameWidgetClass {',
		'	Name "PersonalHUDSecretNeverEmit"',
		'	{',
		'		PanelWidgetClass {',
		'			text "SensitiveVisibleStringNeverEmit"',
		'		}',
		'	}',
		'}'
	].join("\n") }, root => {
		const census = CensusExtractedLayouts(root);
		const output = JSON.stringify(census);
		assert.ok(!output.includes("PersonalHUDSecretNeverEmit"));
		assert.ok(!output.includes("SensitiveVisibleStringNeverEmit"));
		assert.ok(!output.includes(root));
		assert.equal(census.idlessWidgetDeclarations, 2);
	});
});

test("extracted layout census plugs directly into broad Workbench baseline with no invented parity", () => {
	WithLayouts({ "gui/layouts/Hud.layout": s_NamedAndIdless }, root => {
		const census = CensusExtractedLayouts(root);
		const report = BuildNativeCompatibilityBaseline({ census });
		const frame = report.classes.find(item => item.name === "FrameWidgetClass");
		const panel = report.classes.find(item => item.name === "PanelWidgetClass");
		assert.equal(report.summary.nativeCensusProvided, true);
		assert.equal(report.summary.nativeLayoutFiles, 1);
		assert.equal(frame.nativeCensusDeclarations, 1);
		assert.equal(panel.nativeCensusDeclarations, 1);
		assert.equal(report.summary.overallParityPercentage, null);
	});
});

test("missing and empty extraction directories are rejected instead of returning fabricated zero totals", () => {
	assert.throws(() => CensusExtractedLayouts(join(tmpdir(), "NO_SUCH_NIH_LAYOUT_DIRECTORY")),
		/Expected a directory/);
	const root = mkdtempSync(join(tmpdir(), "nih-native-layout-census-empty-"));
	try {
		assert.throws(() => CensusExtractedLayouts(root), /No .layout files found/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
