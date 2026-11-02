import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s_Dir = new URL("./fixtures/workbench-grid/runtime-server-browser/", import.meta.url);
const s_Runtime = readFileSync(new URL("NIH_ServerBrowserGeometryRuntime.c", s_Dir), "utf8");
const s_Stager = readFileSync(new URL("Prepare-ServerBrowserProbe.ps1", s_Dir), "utf8");
const s_Config = readFileSync(new URL("config.cpp", s_Dir), "utf8");

test("Phase 3N native client probe records only native widget rectangles and identity", () => {
	for (const method of ["GetPos(", "GetSize(", "GetScreenPos(", "GetScreenSize(", "GetParent(", "GetChildren(", "GetSibling("])
		assert.ok(s_Runtime.includes(method), "missing native method " + method);
	for (const target of ["server_list_root", "server_list_content_root",
		"basic_infoserver_list_content_header", "server_list_scroller", "filters_root",
		"filters_content", "details_description_container", "details_description_panel"])
		assert.ok(s_Runtime.includes('CaptureTarget("' + target + '"'), "missing " + target);
	assert.ok(!s_Runtime.includes("GetID("), "optional native IDs must not be required");
	assert.ok(!s_Runtime.includes("SetScreenSize("), "do not substitute root resize for actual viewport");
});

test("Phase 3N captures after-create, post-update and post-settle separately", () => {
	for (const marker of ['CapturePhase("after-create")', 'CapturePhase("post-update")',
		'CapturePhase("post-settle")', "m_Root.Update()",
		"[NIH_LayoutStudio][ServerBrowserProbe] BEGIN "])
		assert.ok(s_Runtime.includes(marker), "missing " + marker);
	assert.ok(s_Runtime.includes("g_Game.IsDedicatedServer()"));
	assert.ok(s_Runtime.includes("override void OnInit()"));
	assert.ok(s_Runtime.includes("missingLine += phase;"));
	assert.ok(s_Runtime.includes("Print(missingLine);"));
});

test("Phase 3N stages vanilla layout from local user path only", () => {
	assert.ok(s_Stager.includes("server_browser_tab_pages.layout"));
	assert.ok(s_Stager.includes("$SourceLayout"));
	assert.ok(s_Stager.includes("Copy-Item -LiteralPath $entry.Source"));
	assert.ok(s_Stager.includes("Test-Path -LiteralPath $SourceLayout"));
	assert.ok(s_Config.includes("NIH_ServerBrowserGeometryProbe/Scripts/5_Mission"));
	assert.ok(s_Runtime.includes("NIH_ServerBrowserGeometryProbe/gui/layouts/server_browser_tab_pages.layout"));
});
