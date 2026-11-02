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

## 2026-11-02 — Native standalone server-browser capture accepted as evidence

The independently captured DayZ 1.30 **client** log confirmed `HOOK OnInit`, GUI callback, and native capture. Exactly **70 observations per phase** were recorded across `after-create`, `post-update`, and `post-settle`. All screen and local rectangles, visibility, child counts, and types matched across phases; there were **61 distinct widget identities** once duplicate target/direct-child reporting was removed. The key rectangles are frozen in `tests/fixtures/workbench-grid/grid-server-browser-phase3n-native.json`; the source file is a local vanilla P: path, not checked into Git.

At native root 1920×1080:

| Hierarchy | Actual native geometry | Observable arithmetic |
| --- | --- | --- |
| `server_list_root` | x=80, y=0, 1209.6×800 | Content 760 plus navigation 40 |
| `server_list_content_root` | x=80, y=0, 1209.6×760 | Header 40 plus ScrollWidget 720 |
| `basic_infoserver_list_content_header` | 1209.6×40 | Visible child widths: 90 + 769.6 + 120 + 120 + 100 + 10 |
| `right_area_root` | x=1320.6, y=0, 518.4×490 | Header 40 plus filters 450 |
| `filters_root` | x=1320.6, y=40, 518.4×450 | Content 300 + spacer 10 + button wrapper 140 |
| `filters_content` | 518.4×300 | Ten visible managed rows, each 30 high |
| `filters_button_wrapper` | 518.4×140 | Four 30-high buttons plus two 10-high spacers |

The flexible server header host receives **769.6** width, the remaining width after fixed siblings; this is direct evidence for **ordinary relative-width siblings sharing a native GridSpacer allocation**, contrary to treating them as unsupported by default. The `server_list_scroller` participates as a **ScrollWidget** with 720 height. These are native observations, not sufficient proof of a universal negotiation algorithm.

`details_root` is **invisible**, and its native screen rectangle is zero. Its descendants cannot be validated geometrically in this capture. In particular, `details_description_label` reports screen 1920×160 despite a hidden zero-size ancestor: do not score this branch as parity or infer an allocation rule from that descendant.

### Independent native versus Studio comparison

After building the existing geometry-test exports, on the research branch:

```powershell
cd Z:\GitHub\NIH-Layout-Studio
npm run test:geometry-engine
$layoutPath = 'P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout'
node scripts\Compare-Phase3NNativeGeometry.mjs $layoutPath |
    Tee-Object -FilePath phase3n-native-vs-studio.txt
```

The report matches each captured native name, **parent name and direct-child ordinal** to the source parse (not optional widget IDs) and compares native `GetScreenPos/GetScreenSize` against Studio five-flag `absoluteRect`. It excludes native-hidden widgets, descendants of known hidden native ancestors and zero-area native rectangles from the parity denominator. Match tolerance is 0.025 unzoomed pixels. Missing/ambiguous source identities remain explicit diagnostics, not fabricated matches.

No solver modifications or sixth flag are authorized until mismatches are localized and a supported, general native rule has been corroborated. The additional fixture-comparison tests bring the expected geometry test count to **460** (454 locally verified + 3 native-probe contract tests + 3 native-evidence/comparison tests); this total still requires local execution.
