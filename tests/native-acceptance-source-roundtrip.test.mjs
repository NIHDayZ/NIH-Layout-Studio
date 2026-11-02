import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	CheckSourceRoundTrip,
	PreflightNativeAcceptanceCorpus,
	FormatSourcePreflight
} from "../scripts/Preflight-NativeAcceptanceCorpus.mjs";

function WithLayouts(files, callback) {
	const root = mkdtempSync(join(tmpdir(), "nih-native-roundtrip-"));
	try {
		for (const [relativeName, text] of Object.entries(files)) {
			const parts = relativeName.split("/");
			const filename = parts.pop();
			const folder = join(root, ...parts);
			mkdirSync(folder, { recursive: true });
			writeFileSync(join(folder, filename), text, "utf8");
		}
		return callback(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

const s_Complex = [
	'FrameWidgetClass Root {',
	'	position 0 0',
	'	visible 1',
	'	{',
	'		PanelWidgetClass {',
	'			Name "Anonymous panel"',
	'			color 0.1 0.2 0.3 1',
	'			{',
	'				TextWidgetClass "{00000000E4E67D3A}" {',
	'					text "Hello native"',
	'				}',
	'			}',
	'			"NIH_Unknown" 0',
	'		}',
	'		FrameWidgetClass Another {',
	'			ScriptParamsClass {',
	'				"arg" "value"',
	'			}',
	'			{',
	'				ImageWidgetClass Icon {',
	'					image0 "set:image"',
	'				}',
	'			}',
	'		}',
	'	}',
	'}'
].join("\n");

const s_MultipleGroups = [
	'FrameWidgetClass Root {',
	'	{',
	'		PanelWidgetClass First {',
	'			size 32 32',
	'		}',
	'	}',
	'	"UnsupportedThing" 0',
	'	{',
	'		PanelWidgetClass Second {',
	'			size 48 48',
	'		}',
	'	}',
	'	clipchildren 1',
	'}'
].join("\n");

test("selected source preflight checks named, ID-less, ID-backed and auxiliary blocks", () => {
	const result = CheckSourceRoundTrip(s_Complex);
	assert.equal(result.status, "SOURCE_ROUNDTRIP_PASS");
	assert.equal(result.semanticStructureEqual, true);
	assert.equal(result.serializationIdempotent, true);
	assert.equal(result.nativeWorkbenchLoadValidated, false);
	assert.equal(result.widgets, 5);
	assert.equal(result.auxiliary, 1);
	assert.equal(result.idless, 1);
	assert.equal(result.originalRootCount, 1);
	assert.equal(result.reparsedRootCount, 1);
	assert.equal(result.sourceByteIdentical, false);
	assert.equal(result.firstDifferencePath, undefined);
});

test("native-safe property and multiple child group ordering survives canonical round-trip", () => {
	const result = CheckSourceRoundTrip(s_MultipleGroups);
	assert.equal(result.status, "SOURCE_ROUNDTRIP_PASS");
	assert.equal(result.widgets, 3);
	assert.equal(result.semanticStructureEqual, true);
	assert.equal(result.serializationIdempotent, true);
});

test("candidates are selected from local vanilla sources, without rewriting source files", () => {
	WithLayouts({
		"gui/A.layout": s_Complex,
		"gui/B.layout": s_MultipleGroups
	}, root => {
		const candidates = { selected: [
			{ role: "images-styles", path: "gui/A.layout" },
			{ role: "managed-layout", path: "gui/B.layout" }
		] };
		const report = PreflightNativeAcceptanceCorpus(root, candidates);
		assert.equal(report.status, "SOURCE_PREFLIGHT_PASS");
		assert.equal(report.sourceRoundTripsPassed, 2);
		assert.equal(report.sourceRoundTripsFailed, 0);
		assert.equal(report.nativeWorkbenchLoadValidated, false);
		assert.deepEqual(report.files.map(x => x.path), ["gui/A.layout", "gui/B.layout"]);
		assert.ok(report.files.every(x => x.status === "SOURCE_ROUNDTRIP_PASS"));
		assert.ok(report.files.every(x => x.properties > 0));
		assert.match(FormatSourcePreflight(report), /source-level check only/);
	});
});

test("source preflight flags invalid parse and rejects duplicate or escaping relative paths", () => {
	assert.deepEqual(CheckSourceRoundTrip("not a DayZ layout"), {
		status: "PARSE_FAILURE", reason: "no-root-declarations"
	});
	WithLayouts({ "gui/A.layout": s_Complex }, root => {
		const selected = paths => ({ selected: paths.map(path => ({
			role: "images-styles", path
		})) });
		assert.throws(() => PreflightNativeAcceptanceCorpus(root, selected(["../outside.layout"])),
			/Invalid candidate relative layout path/);
		assert.throws(() => PreflightNativeAcceptanceCorpus(root, selected(["gui/A.layout", "gui/A.layout"])),
			/Duplicate candidate layout path/);
		assert.throws(() => PreflightNativeAcceptanceCorpus(root, selected(["missing.layout"])),
			/Candidate layout file not found/);
		assert.throws(() => PreflightNativeAcceptanceCorpus(root, { selected: [] }),
			/nonempty selected array/);
	});
});

test("private property values and original widget IDs never leak into report", () => {
	const unique = "UniqueSensitiveLiteralNeverReportThis";
	const special = s_Complex.replace("Hello native", unique);
	WithLayouts({ "private.layout": special }, root => {
		const report = PreflightNativeAcceptanceCorpus(root,
			{ selected: [{ role: "test", path: "private.layout" }] });
		const json = JSON.stringify(report);
		assert.ok(!json.includes(unique));
		assert.ok(!json.includes("{00000000E4E67D3A}"));
		assert.ok(!json.includes("set:image"));
		assert.ok(!json.includes(root));
		assert.equal(report.files[0].status, "SOURCE_ROUNDTRIP_PASS");
	});
});

test("PowerShell BOM candidate JSON is accepted by the native source preflight CLI", () => {
	WithLayouts({ "gui/A.layout": s_Complex }, root => {
		const candidatesFile = join(root, "candidates.json");
		writeFileSync(candidatesFile, "\uFEFF" + JSON.stringify({
			selected: [{ role: "images-styles", path: "gui/A.layout" }]
		}));
		const script = fileURLToPath(new URL(
			"../scripts/Preflight-NativeAcceptanceCorpus.mjs", import.meta.url));
		const output = execFileSync(process.execPath,
			[script, root, "--candidates=" + candidatesFile, "--json"], {
				encoding: "utf8"
			});
		const report = JSON.parse(output);
		assert.equal(report.status, "SOURCE_PREFLIGHT_PASS");
		assert.equal(report.selectedFiles, 1);
		assert.equal(report.files[0].nativeWorkbenchLoadValidated, false);
	});
});
