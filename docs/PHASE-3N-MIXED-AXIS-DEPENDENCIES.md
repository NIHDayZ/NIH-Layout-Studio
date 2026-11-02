# Phase 3N — Mixed-axis and nested GridSpacer dependency inventory

## Status

Diagnostic-only research, based on the validated Phase 3M baseline (451/451 local geometry tests, `npm run typecheck` and `npm run build` passed on 2026-11-02). **No production or experimental layout algorithm changes.** The server-browser screenshot is not accepted as native Workbench parity.

The user-supplied vanilla `server_browser_tab_pages.layout` Phase 3M audit reported 25 applied grid strategies: 21 single-axis, 2 allocated-parent-relative, and 2 nested. The fifth flag changed only three widget rectangles:

| Widget | Four flags | Five flags | Observation |
| --- | --- | --- | --- |
| `details_description_content` | height 207.36 | height 160 | Local height decreased by 47.36 |
| `details_description_panel` | local Y 23.68 | local Y 0 | Local Y decreased by 23.68 |
| `details_description_label` | unchanged local rectangle | inherited absolute translation | No local-size change |

The native screenshot for this standalone vanilla layout is still needed. An engine-versus-engine comparison is **not** an independent native measurement.

## Diagnostic capability

`Analyze-Phase3NDependencies.mjs` is a read-only, independently named inspection tool. It parses a layout, reuses existing measured nodes and the unchanged five-flag analyzer, and emits:

- All GridSpacer parent axes (authored size, exact/relative, content-sized intent).
- Which direct children are native-managed based on `Ignore invisible`; unknown selection remains `null` and is never guessed.
- Each direct child's strategy, dimensions, exact/relative flags, and content-sized axes.
- Source-level hints for the Phase 3M nested probe's guards, separately from the older exact-parent-relative eligibility diagnostics.
- **Actually applied** Phase 3M strategies as reported by the snapshot; direct descendants may be applied from a cached parent plan even when they cannot independently initiate a new probe.
- The full four-flag-versus-five-flag geometry differences already available from `AnalyzeVanillaGeometry`.

Guard hints identify **possible source-level rejection paths**, not a trace of the actual runtime return branch. Even `structural-candidate` means only that the explicit topology checks pass: allocated parent dimensions, provisional native planner, ancestor context and native parity remain unverified.

## Local usage

After pulling the research branch, run `npm run test:geometry-engine` once to compile `.geometry-engine-test-build`. Then:

```powershell
cd Z:\GitHub\NIH-Layout-Studio
$layoutPath = 'P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout'
node scripts\Analyze-Phase3NDependencies.mjs $layoutPath
```

To capture a machine-readable report for review (the script does not write files itself):

```powershell
node scripts\Analyze-Phase3NDependencies.mjs $layoutPath --json | Set-Content -Encoding UTF8 phase3n-server-browser.json
```

The default focus is `server_list_root`, `server_list_content_root`, `basic_infoserver_list_content_header`, `filters_root`, `filters_content`, `details_description_container`, `details_description_content`, and `details_description_panel`. Override with `--focus=server_list_root,filters_root`.

## Native evidence next

1. Open the *same* `server_browser_tab_pages.layout` in Workbench, standalone, at 1920×1080 and 46% zoom. Keep Workbench and Studio screenshot origins separate; compare relative to a common parent.
2. For any unresolved topology, build a disposable DayZ client probe recording `GetScreenPos` and `GetScreenSize` after `Update()` and after settle at 1920×1080 and 1440×810. Log managed selection and source dimensions separately. **Do not copy inferred values into native fixture files.**
3. Separate unsupported managed children, mixed content axes, relative ordinary siblings, and inherited sizing from text/font/localization, clipping and missing resources.
4. Only after independent native measurements, determine whether the generalized measure/arrange contract needs an extension. Do not add another preview flag or widget-name-specific fix based on this report.

## Test gate

Run `npm run test:geometry-engine`, `npm run typecheck`, and `npm run build`. The three new diagnostic tests should increase the geometry-test count from 451 to **454**, assuming the baseline remains unchanged. Do not report this count as passed before the user runs it.
