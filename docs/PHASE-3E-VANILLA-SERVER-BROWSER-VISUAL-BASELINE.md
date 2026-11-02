# Phase 3E — First real vanilla PC layout visual baseline

## Provenance and scope

**Date:** 2026-11-01 (local).

**Native source:** `P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout`.

**User-provided evidence:** Two separate full-application screenshots: Studio `image(20261102-071014).png` (1919x1025 pixels) and DayZ Workbench `image(20261102-071019).png` (1919x1079 pixels). The images are not checked into this repository; they contain DayZ native GUI artwork and should remain conversation/local validation evidence.

Both applications show 1920x1080 authored root and 46% zoom. Studio URL is exactly `http://localhost:5173`, without experiment flags. Workbench native resource browser has the GUI tree; Studio's green `VANILLA P:\gui` toolbar badge indicates that the vanilla resource dependency is loaded. **The empty Studio Project pane indicates no separate editable project folder, not missing vanilla resources.**

The original file already passed Phase 3D parse -> canonical serialize -> reparse: 269 widgets, 3,077 parser-visible properties, `SOURCE_ROUNDTRIP_PASS`. That pass does not prove visual or native Workbench load parity.

## What the first screenshots establish

| Area | Studio default screenshot | Native Workbench screenshot | Assessment |
|---|---|---|---|
| Root/container canvas | Full gray root roughly same relative dimensions | Full gray root, darker container areas | Basic root appears, nested drawing differs |
| Hierarchy | `WindowWidgetClass server_browser_tab_root`, nested `GridSpacerWidgetClass server_list_root` visible | Same named root and grid visible | Source tree exists in both; not proof all 269 descendants are visibly laid out |
| Server list | Small text and one horizontal bar at an upper-middle location, much content absent/overlapping | Larger dark server list with top column/title content and a bottom navigation bar | Major layout/paint divergence; cannot attribute to font or geometry alone yet |
| Filter region | Header visible at upper-right; most nested controls not visible | Header and many filter controls visible in a distinct gray panel | Strong divergence; inspect nested child rectangles, visibility and styling |
| Text/localization | Tiny labels with unresolved identifiers | Tiny overlapping native text and localization warnings in Workbench console | Localization cannot be used as a clean text-parity reference yet |
| Assets | Vanilla dependency indicator loaded, but no separate editable project | Native resource variants available | Do not claim missing Studio project causes mismatch; check per-asset resolution only if logs indicate failure |

Important limitations: screenshots have different overall heights, IDE/window chrome and preview origins. **Screen-space x/y coordinates across full screenshots are not directly comparable**. Align by the authored root/painted container; measure nested rects in unzoomed layout units for hard geometric claims. This initial evidence is a visual FAIL/PENDING baseline, not a numeric golden capture.

## The code-level distinction confirmed before making fixes

In `src/components/Canvas.tsx`, the default `http://localhost:5173` route does not set any of the following:

- `experimentalGridLayout=1` (lineage of live GridSpacer child planner),
- `experimentalNativeConstrainedGrid=1` (opt-in native fixed-cell handling),
- `experimentalGeometrySnapshot=1` (shared measured whole-tree geometry path),
- `experimentalGridRelativeContent=1` (bounded native relative-grid preview; requires snapshot path),
- `experimentalNativeWrapLayout=1` / `experimentalSnapshotManaged=1` (research-only fixed Wrap behavior).

Therefore the current screenshot is **not testing the best native GridSpacer candidate by default**. The observed problems may combine unenabled managed geometry with text, styling and image differences. Do not claim enabling Grid will fix everything.

## Next controlled diagnostic (without changing production)

1. Retain the existing original Workbench screenshot and Studio default screenshot as baseline.
2. Reload the exact same original source in Studio at the same authored resolution/zoom and with unchanged `VANILLA P:\gui` dependency.
3. Visit **only** `http://localhost:5173/?experimentalGridLayout=1&experimentalNativeConstrainedGrid=1`. A URL navigation may reset browser-only layout and vanilla resource state. If it does, use **File -> Vanilla GUI (Source)** to reload the read-only `P:\\gui` directory, then **File -> Layout (Upload)** to reopen the same original `server_browser_tab_pages.layout`; do not save the original file. Verify the green `VANILLA P:\\gui` badge is restored. Take one full Studio screenshot. This enables the current live native Grid candidate without changing fonts, panel alpha, geometry snapshot or resource lookup.
4. Compare placement and visibility of the named subtrees `server_list_root`, `server_list_content_root`, and filter controls. Focus on whether the server-list bottom navigation and right filter controls move toward the Workbench baseline.
5. If the grid experiment improves nested placement, separately evaluate the shared snapshot candidate `?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1` in a later test, not simultaneously. Avoid altering multiple independent flags in one capture.
6. If the right-hand controls remain invisible, inspect computed rects and widget style/chrome resolution for one specific nested filter child. Native evidence and a confirmed source identifier are prerequisites for any fix.

The existing `debugSpacerLayout=1` flag can report the GridSpacer parent/child assignments through Studio's console if geometry remains suspicious; it is a diagnostic only. Workbench unresolved `$STR_...`/`STR_...` localization is a separate confounder, not an automatic native typography PASS.

## Acceptance status

- **Parser/serialization:** Source-level PASS from Phase 3D; no native re-open pass for the exported file yet.
- **Basic root display:** Observed in both, but numeric position parity PENDING.
- **Managed Grid geometry:** Visual discrepancy on default; research candidate A/B PENDING.
- **Panel/style/image fidelity:** Differences visible but source-independent root cause PENDING.
- **Typography:** Native localization warnings; comparison PENDING.
- **Scroll/clipping:** Not demonstrated by this screenshot.
- **Edit -> export -> Workbench reopen:** PENDING.

Do not change the production GridSpacer algorithm, default font renderer, panel alpha model or sources until the isolated A/B resolves at least one root cause. Treat this as the first whole-layout visual acceptance checkpoint, with confirmed failures and explicitly unresolved causes.
