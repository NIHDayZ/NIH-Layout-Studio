import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	SelectNativeAcceptanceCorpus,
	FormatAcceptanceCorpus
} from "../scripts/Select-NativeAcceptanceCorpus.mjs";

function WithLayouts(files, callback) {
	const folder = mkdtempSync(join(tmpdir(), "nih-native-acceptance-"));
	try {
		for (const [relative, body] of Object.entries(files)) {
			const pieces = relative.split("/");
			const name = pieces.pop();
			const path = join(folder, ...pieces);
			mkdirSync(path, { recursive: true });
			writeFileSync(join(path, name), body);
		}
		return callback(folder);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}
function Layout(children, rootName = "Root") {
	return [
		"FrameWidgetClass " + rootName + " {",
		"\t{",
		...children.flatMap((type, i) => ["\t\t" + type + " Widget" + i + " {", "\t\t}"]),
		"\t}",
		"}"
	].join("\n");
}
const s_Representative = {
	"vanilla/A-Images.layout": Layout(["ImageWidgetClass", "ImageWidgetClass", "ImageWidgetClass", "PanelWidgetClass"]),
	"vanilla/B-Text.layout": Layout(["TextWidgetClass", "TextWidgetClass", "RichTextWidgetClass", "MultilineTextWidgetClass"]),
	"vanilla/C-Grid.layout": Layout(["GridSpacerWidgetClass", "GridSpacerWidgetClass", "WrapSpacerWidgetClass"]),
	"vanilla/D-Controls.layout": Layout(["ButtonWidgetClass", "ButtonWidgetClass", "EditBoxWidgetClass", "SliderWidgetClass"]),
	"vanilla/E-Scroll.layout": Layout(["ScrollWidgetClass", "ScrollWidgetClass", "WrapSpacerWidgetClass"])
};

test("native acceptance selector deterministically chooses five distinct representative roles", () => {
	WithLayouts(s_Representative, root => {
		const result = SelectNativeAcceptanceCorpus(root);
		assert.equal(result.status, "CANDIDATES_ONLY");
		assert.equal(result.corpus.layoutFiles, 5);
		assert.equal(result.corpus.parseFailures, 0);
		assert.equal(result.corpus.parsedLayoutFiles, 5);
		assert.equal(result.selected.length, 5);
		assert.deepEqual(result.selected.map(item => item.role), [
			"images-styles", "typography", "managed-layout", "controls", "scroll-clipping"
		]);
		assert.deepEqual(result.selected.map(item => item.path), [
			"vanilla/A-Images.layout",
			"vanilla/B-Text.layout",
			"vanilla/C-Grid.layout",
			"vanilla/D-Controls.layout",
			"vanilla/E-Scroll.layout"
		]);
		assert.equal(result.unfilledRoles.length, 0);
		assert.equal(new Set(result.selected.map(item => item.path)).size, 5);
		assert.equal(result.corpus.topSixDeclarations.ImageWidgetClass, 3);
		assert.equal(result.corpus.topSixDeclarations.GridSpacerWidgetClass, 2);
		assert.equal(result.corpus.topSixDeclarations.ButtonWidgetClass, 2);
	});
});

test("native acceptance selector never picks a single giant layout for several roles", () => {
	WithLayouts({
		"A-everything.layout": Layout([
			...Array.from({ length: 30 }, () => "ImageWidgetClass"),
			...Array.from({ length: 30 }, () => "TextWidgetClass"),
			...Array.from({ length: 30 }, () => "GridSpacerWidgetClass"),
			...Array.from({ length: 30 }, () => "ButtonWidgetClass"),
			...Array.from({ length: 30 }, () => "ScrollWidgetClass")
		]),
		"B-images.layout": Layout(["ImageWidgetClass"]),
		"C-text.layout": Layout(["TextWidgetClass"])
	}, root => {
		const result = SelectNativeAcceptanceCorpus(root);
		assert.equal(result.selected[0].path, "A-everything.layout");
		assert.ok(result.selected.every(item => item.path));
		assert.equal(new Set(result.selected.map(item => item.path)).size,
			result.selected.length);
		assert.ok(result.unfilledRoles.length > 0, "unfilled roles must not duplicate the same layout");
	});
});

test("native acceptance selector marks unavailable roles instead of picking irrelevant layout types", () => {
	WithLayouts({
		"only-images.layout": Layout(["ImageWidgetClass", "ImageWidgetClass"])
	}, root => {
		const report = SelectNativeAcceptanceCorpus(root);
		assert.deepEqual(report.selected.map(item => item.role), ["images-styles"]);
		assert.deepEqual(report.unfilledRoles, [
			"typography", "managed-layout", "controls", "scroll-clipping"
		]);
		assert.equal(report.corpus.distinctClasses, 2);
	});
});

test("native acceptance selection is read only and does not emit widget text or authored source IDs", () => {
	WithLayouts({
		"vanilla/Sample.layout": [
			"FrameWidgetClass {",
			'\tName "RootPrivateStringShouldNeverAppear"',
			"\t{",
			"    ImageWidgetClass {",
			'\t\tName "SecretImageWidgetShouldNotAppear"',
			"    }",
			"    PanelWidgetClass SecretIdentifierShouldNotAppear {",
			"    }",
			"\t}",
			"}"
		].join("\n")
	}, root => {
		const report = SelectNativeAcceptanceCorpus(root);
		const data = JSON.stringify(report);
		assert.ok(!data.includes("RootPrivateStringShouldNeverAppear"));
		assert.ok(!data.includes("SecretImageWidgetShouldNotAppear"));
		assert.ok(!data.includes("SecretIdentifierShouldNotAppear"));
		assert.ok(!data.includes(root));
		assert.equal(report.corpus.idlessDeclarations, 2);
		assert.equal(report.selected[0].path, "vanilla/Sample.layout");
	});
});

test("native acceptance selection reports failed input and enforces requested role limit", () => {
	WithLayouts({
		"good.layout": Layout(["ImageWidgetClass"]),
		"broken.layout": "definitely not a widget class"
	}, root => {
		const report = SelectNativeAcceptanceCorpus(root, { limit: 1 });
		assert.equal(report.status, "PARTIAL_EXTRACTION");
		assert.equal(report.corpus.parseFailures, 1);
		assert.equal(report.corpus.parsedLayoutFiles, 1);
		assert.equal(report.selected.length, 1);
		assert.equal(report.requestedRoles.length, 1);
		assert.equal(report.corpus.otherParseFailures[0].file, "broken.layout");
		assert.throws(() => SelectNativeAcceptanceCorpus(root, { limit: 0 }), /integer from 1 to 5/);
		assert.throws(() => SelectNativeAcceptanceCorpus(root, { limit: 6 }), /integer from 1 to 5/);
	});
});

test("native acceptance CLI returns machine readable JSON and a non-certifying Markdown table", () => {
	WithLayouts(s_Representative, root => {
		const path = fileURLToPath(new URL(
			"../scripts/Select-NativeAcceptanceCorpus.mjs", import.meta.url));
		const json = execFileSync(process.execPath,
			[path, root, "--json"], { encoding: "utf8" });
		const report = JSON.parse(json);
		assert.equal(report.selected.length, 5);
		assert.ok(report.selectedDistinctClasses > 5);
		assert.equal(report.status, "CANDIDATES_ONLY");
		const markdown = FormatAcceptanceCorpus(report);
		assert.match(markdown, /native acceptance candidates/);
		assert.match(markdown, /no compatibility PASS claims/);
		assert.match(markdown, /Load the original source in Studio/);
		assert.ok(!markdown.includes("100% parity"));
	});
});
