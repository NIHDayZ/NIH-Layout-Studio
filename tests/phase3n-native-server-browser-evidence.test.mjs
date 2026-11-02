import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ComparePhase3NNative, FormatPhase3NNative } from "../scripts/Compare-Phase3NNativeGeometry.mjs";

const s_Fixture = JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-grid/grid-server-browser-phase3n-native.json", import.meta.url), "utf8"));
const s_NestedSource = readFileSync(new URL(
	"./fixtures/workbench-grid/NIH_Grid_Nested_Dependency_Matrix.layout", import.meta.url), "utf8");

function Screen(name, parent) {
	const row = s_Fixture.keyRects.find(entry => entry[0] === name && entry[1] === parent);
	assert.ok(row, "missing native evidence " + name);
	return row[3];
}

test("Phase 3N freezes three stable independent DayZ phases and native source provenance", () => {
	assert.equal(s_Fixture.kind, "INDEPENDENT_DAYZ_CLIENT_STANDALONE_SERVER_BROWSER_SCREEN_RECTS");
	assert.deepEqual(s_Fixture.root, [1920, 1080]);
	assert.deepEqual(s_Fixture.phases, ["after-create", "post-update", "post-settle"]);
	assert.equal(s_Fixture.observationsPerPhase, 70);
	assert.equal(s_Fixture.uniqueWidgetIdentities, 61);
	assert.equal(s_Fixture.observationDifferencesAcrossPhases, 0);
	assert.ok(s_Fixture.keyRects.length >= 35);
});

test("Phase 3N native arithmetic captures mixed relative siblings, visible filters and ScrollWidget allocation", () => {
	const root = Screen("server_list_root", "server_browser_tab_root");
	const content = Screen("server_list_content_root", "server_list_root");
	const header = Screen("basic_infoserver_list_content_header", "server_list_content_root");
	const scroller = Screen("server_list_scroller", "server_list_content_root");
	const nav = Screen("servers_navigation_panel", "server_list_root");
	assert.equal(root[3], content[3] + nav[3]);
	assert.equal(content[3], header[3] + scroller[3]);
	const headerNames = [
		"server_list_content_header_spacer", "server_list_content_header_host",
		"server_list_content_header_map", "server_list_content_header_population",
		"server_list_content_header_ping", "server_list_content_header_spacer_end"
	];
	const headerWidth = headerNames.reduce((sum, name) =>
		sum + Screen(name, "basic_infoserver_list_content_header")[2], 0);
	assert.ok(Math.abs(headerWidth - header[2]) < 0.001);
	const filters = Screen("filters_root", "right_area_root");
	const filterContent = Screen("filters_content", "filters_root");
	const spacer = Screen("spacer", "filters_root");
	const buttons = Screen("filters_button_wrapper", "filters_root");
	const right = Screen("right_area_root", "server_browser_tab_root");
	assert.equal(filterContent[3], 300);
	assert.equal(buttons[3], 140);
	assert.equal(filters[3], filterContent[3] + spacer[3] + buttons[3]);
	assert.equal(right[3], 40 + filters[3]);
	assert.equal(Screen("details_root", "right_area_root")[2], 0,
		"hidden details hierarchy cannot support visual parity");
});

test("Phase 3N comparison identifies named source geometry without persisting widget IDs", () => {
	const reference = {
		root: [1920, 1080], phases: ["post-update"],
		kind: "CONTROLLED_NATIVE_NESTED_FIXTURE", observationDifferencesAcrossPhases: 0,
		keyRects: [
			["NIH_NestedGridDependencyMatrix", "", -1, [0,0,1920,1080], true],
			["OuterHeightOuter", "SlotHeightOuter", 2, [52,102,399,110], true],
			["InnerHeightOuter", "OuterHeightOuter", 0, [57,107,190.5,100], true]
		]
	};
	const report = ComparePhase3NNative(s_NestedSource, reference);
	assert.equal(report.compared, 3);
	assert.equal(report.mismatches, 0);
	assert.equal(report.withinTolerance, 3);
	assert.match(FormatPhase3NNative(report), /matched=3 mismatched=0/);
});

test("Phase 3N reports native sibling-order differences without false missing-source results", () => {
	const reference = {
		root: [1920, 1080], phases: ["post-update"],
		kind: "CONTROLLED_NATIVE_NESTED_FIXTURE", observationDifferencesAcrossPhases: 0,
		keyRects: [
			["NIH_NestedGridDependencyMatrix", "", -1, [0,0,1920,1080], true],
			["OuterHeightOuter", "SlotHeightOuter", 2, [52,102,399,110], true],
			["InnerHeightOuter", "OuterHeightOuter", 7, [57,107,190.5,100], true]
		]
	};
	const report = ComparePhase3NNative(s_NestedSource, reference);
	assert.equal(report.mismatches, 0);
	assert.equal(report.withinTolerance, 3);
	assert.deepEqual(report.sourceOrderDifferences, [
		{ name: "InnerHeightOuter", parent: "OuterHeightOuter", nativeOrdinal: 7, sourceOrdinal: 0 }
	]);
});

test("Phase 3N groups inherited mismatch chains and reports native local deltas", () => {
	const reference = {
		root: [1920, 1080], phases: ["post-update"],
		kind: "CONTROLLED_NATIVE_NESTED_FIXTURE", observationDifferencesAcrossPhases: 0,
		keyRects: [
			["NIH_NestedGridDependencyMatrix", "", -1, [0,0,1920,1080], true],
			["OuterHeightOuter", "SlotHeightOuter", 2, [52,102,400,110], true],
			["InnerHeightOuter", "OuterHeightOuter", 0, [58,107,190.5,100], true]
		]
	};
	const report = ComparePhase3NNative(s_NestedSource, reference);
	assert.equal(report.mismatches, 2);
	assert.deepEqual(report.mismatchRoots, [{ name: "OuterHeightOuter", affected: 2 }]);
	assert.deepEqual(report.rows.find(row => row.name === "InnerHeightOuter").localDelta,
		[-1, 0, 0, 0]);
});
