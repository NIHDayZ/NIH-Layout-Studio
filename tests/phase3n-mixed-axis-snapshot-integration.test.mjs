import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";

const s_Native = JSON.parse(readFileSync(new URL(
	"./fixtures/workbench-grid/grid-server-browser-phase3n-native.json", import.meta.url), "utf8"));
const s_Root = { x: 0, y: 0, width: 1920, height: 1080 };
const s_FourFlags = {
	constrainedGrid: true, gridRelativeContentPrototype: true,
	gridAllocatedParentRelativePrototype: true,
	gridAllocatedParentSingleAxisPrototype: true
};
const s_FiveFlags = { ...s_FourFlags, gridNestedAllocationPrototype: true };

/**
 * Minimal structural reproduction of the observed vanilla dependencies.
 * Authored values and native expected rectangles are independent inputs;
 * no vanilla layout file is copied into source control.
 */
function Widget(name, type, geometry = {}, children = [], grid = {}) {
	const g = {
		x: 0, y: 0, width: 1, height: 1, exactPosX: false, exactPosY: false,
		exactWidth: false, exactHeight: false, contentWidth: false, contentHeight: false,
		visible: true, hAlign: "left_ref", ...geometry
	};
	const properties = [
		{ name: "position", value: g.x + " " + g.y },
		{ name: "size", value: g.width + " " + g.height },
		{ name: "hexactpos", value: g.exactPosX ? "1" : "0" },
		{ name: "vexactpos", value: g.exactPosY ? "1" : "0" },
		{ name: "hexactsize", value: g.exactWidth ? "1" : "0" },
		{ name: "vexactsize", value: g.exactHeight ? "1" : "0" },
		{ name: "size to content h", value: g.contentWidth ? "1" : "0" },
		{ name: "size to content v", value: g.contentHeight ? "1" : "0" },
		{ name: "halign", value: g.hAlign },
		{ name: "visible", value: g.visible ? "1" : "0" }
	];
	if (type === "GridSpacer") {
		properties.push(
			{ name: "columns", value: String(grid.columns ?? 1) },
			{ name: "rows", value: String(grid.rows ?? children.length) },
			{ name: "padding", value: "0" },
			{ name: "margin", value: "0" },
			{ name: "Ignore invisible", value: "1" }
		);
	}
	return { id: name, name, type: type + "WidgetClass", properties, children };
}

function BuildStructure() {
	const headerWidths = [
		["server_list_content_header_spacer", 90, true],
		["server_list_content_header_host", 1, false],
		["server_list_content_header_map", 120, true],
		["server_list_content_header_time", 120, true, false],
		["server_list_content_header_population", 120, true],
		["server_list_content_header_slots", 120, true, false],
		["server_list_content_header_ping", 100, true],
		["server_list_content_header_spacer_end", 10, true]
	];
	const header = Widget("basic_infoserver_list_content_header", "GridSpacer",
		{ width: 1, height: 40, exactHeight: true, contentWidth: true },
		headerWidths.map(([name, width, exactWidth, visible = true]) =>
			Widget(name, "Frame", { width, height: 1, exactWidth, visible })),
		{ columns: 6, rows: 1 });
	const scroller = Widget("server_list_scroller", "Scroll",
		{ width: 1, height: 720, exactHeight: true });
	const listContent = Widget("server_list_content_root", "GridSpacer",
		{ width: 1, height: 0.328, contentWidth: true, contentHeight: true },
		[header, Widget("separator", "Image", { visible: false }),
			scroller]);
	const list = Widget("server_list_root", "GridSpacer",
		{ x: 80, exactPosX: true, width: 0.63, height: 1080,
			exactHeight: true, contentWidth: true, contentHeight: true },
		[Widget("server_list_header", "Panel", { visible: false }),
			Widget("list_separator", "Panel", { visible: false }),
			listContent, Widget("servers_navigation_panel", "Panel",
				{ width: 1, height: 40, exactHeight: true }),
			Widget("separator0", "Panel", { visible: false })]);
	const rowNames = [
		"search_name_setting_container", "search_ip_setting_container",
		"restrict_char_setting_container", "region_setting_container",
		"map_setting_container", "ping_setting_container",
		"favorites_setting_container", "dlc_setting_container",
		"friends_setting_container", "battleye_setting_container",
		"password_setting_container", "whitelist_setting_container",
		"prev_played_setting_container", "ver_match_setting_container",
		"full_server_setting_container", "tps_setting_container",
		"public_setting_container", "accelerated_time_setting_container"
	];
	const visibleIndices = new Set([0, 1, 4, 5, 8, 10, 11, 12, 14, 15]);
	const filtersContent = Widget("filters_content", "GridSpacer",
		{ width: 1, height: 0.6, contentWidth: true, contentHeight: true },
		rowNames.map((name, i) =>
			Widget(name, "Frame", { width: 1, height: 30, exactHeight: true,
				visible: visibleIndices.has(i) })),
		{ columns: 1, rows: 18 });
	const buttons = [
		["apply_filter_button", "Button", 30],
		["reset_filter_button", "Button", 30],
		["refresh_list_button", "Button", 30],
		["spacer5", "Frame", 10],
		["show_details_button", "Button", 30],
		["spacer0", "Frame", 10]
	];
	const wrapper = Widget("filters_button_wrapper", "GridSpacer",
		{ x: 0.02, y: 0.024, width: 0.197, height: 0.102, contentHeight: true },
		buttons.map(([name, type, height]) =>
			Widget(name, type, { width: 1, height, exactHeight: true })));
	const filters = Widget("filters_root", "GridSpacer",
		{ width: 0.25, height: 1, contentHeight: true },
		[filtersContent, Widget("spacer", "Frame",
			{ width: 1, height: 10, exactHeight: true }), wrapper,
			Widget("unapplied_filters_notify", "Text", { visible: false })]);
	const right = Widget("right_area_root", "GridSpacer",
		{ x: 81, exactPosX: true, hAlign: "right_ref",
			width: 0.27, height: 1, contentHeight: true },
		[Widget("right_area_header", "Panel",
			{ width: 1, height: 40, exactHeight: true }),
			Widget("right_area_buttons", "GridSpacer", { visible: false }),
			Widget("details_root", "GridSpacer", { visible: false }),
			filters]);
	return Widget("server_browser_tab_root", "Window", {}, [list, right]);
}

function Rect(snapshot, name) {
	const rect = snapshot.byId.get(name)?.absoluteRect;
	assert.ok(rect, "missing geometry " + name);
	return [rect.x, rect.y, rect.width, rect.height];
}

test("Phase 3N five-flag snapshot matches independent native visible structural rectangles", () => {
	const measured = MeasureLayoutTree([BuildStructure()]);
	const snapshot = ArrangeMeasuredGeometry(measured, s_Root, 1, s_FiveFlags);
	let compared = 0;
	for (const [name, parent, ordinal, native, visible] of s_Native.keyRects) {
		if (!visible || native[2] <= 0 || native[3] <= 0 || name.startsWith("details_"))
			continue;
		const actual = Rect(snapshot, name);
		for (let i = 0; i < 4; ++i)
			assert.ok(Math.abs(actual[i] - native[i]) <= 0.025,
				name + " axis " + i + " predicted=" + actual[i] + " native=" + native[i]);
		++compared;
	}
	assert.equal(compared, 34);
	const mixed = snapshot.appliedStrategies.filter(item =>
		item.mode === "grid-mixed-allocation-prototype");
	assert.ok(mixed.some(item => item.id === "server_list_root"));
	assert.ok(mixed.some(item => item.id === "right_area_root"));
	assert.ok(mixed.some(item => item.id === "filters_root"));
});

test("Phase 3N integration preserves old four-gate behavior and untouched default geometry", () => {
	const measured = MeasureLayoutTree([BuildStructure()]);
	const defaultBefore = ArrangeMeasuredGeometry(measured, s_Root);
	const defaultAfter = ArrangeMeasuredGeometry(measured, s_Root, 1, {});
	assert.deepEqual(defaultAfter.entries, defaultBefore.entries);
	const fourFlags = ArrangeMeasuredGeometry(measured, s_Root, 1, s_FourFlags);
	const disabled = ArrangeMeasuredGeometry(measured, s_Root, 1,
		{ ...s_FiveFlags, gridNestedAllocationPrototype: false });
	assert.deepEqual(disabled.entries, fourFlags.entries);
	assert.deepEqual(disabled.appliedStrategies, fourFlags.appliedStrategies);
	assert.ok(!fourFlags.appliedStrategies.some(item =>
		item.mode === "grid-mixed-allocation-prototype"));
	assert.equal(Rect(fourFlags, "server_list_root")[3], 1080);
	assert.equal(Rect(fourFlags, "right_area_root")[3], 1080);
});
