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

## 2026-11-02 — Actual five-flag native comparison and read-only generalized candidate

The user independently confirmed **460/460 geometry tests**, `npm run typecheck`, and `npm run build`. The native comparator reported **34 visible comparisons, 9 within 0.025 px and 25 mismatches**. The hierarchy errors are correlated:

| Native widget | Native (W×H) | Five-flag Studio (W×H) | Structural observation |
| --- | --- | --- | --- |
| `server_list_root` | 1209.6×800 | 1209.6×1080 | Height still authored rather than child-derived |
| `server_list_content_root` | 1209.6×760 | 1209.6×354.24 | Height derived in native from 40+720 |
| `server_list_scroller` | 1209.6×720 at Y=40 | 1209.6×720 at Y=0 | Missing managed stacking |
| `right_area_root` | 518.4×490 | 518.4×1080 | Height derived in native from 40+450 |
| `filters_root` | 518.4×450 at X=1320.6 | 129.6×1080 at X=1515 | Parent-managed cell allocation absent |
| `filters_content` | 518.4×300 | 129.6×300 | Its own content *height* already correct; parent width is wrong |
| `filters_button_wrapper` | 518.4×140 | 25.5312×140 | Its own content *height* correct; parent width is wrong |

The six measured server-list header widths were already exact in Studio: 90, 769.6, 120, 120, 100, 10. This is strong evidence that neither basic leaf Grid arithmetic nor the text system should be modified to resolve the dominant hierarchy failures.

The earlier native comparison falsely labeled `details_description_content` as `source-missing` because it required native sibling ordinal to equal document order. **Native order is not guaranteed to match authored order.** The comparator now recovers unique name+parent matches without requiring optional IDs, and reports ordinal differences explicitly. It continues excluding hidden native ancestors.

A new **read-only** `ProbeMixedAxisGrid` research candidate was added in `src/renderer/engine/NativeMixedGrid.ts` without changing `GeometrySnapshot`, `Canvas`, any layout flag or production rendering. It reuses the already native-derived `PlanNativeRelativeGrid`, adds bounded recursive nested allocation, allows ordinary relative siblings on the independently observed single-column case, and admits a non-content-sized ScrollWidget only with a concrete height on the parent content-height axis. Unsupported mixed manager dimensions and multi-column relative ordinary siblings still reject conservatively. This is a hypothesis to test, **not** accepted native behavior.

`scripts/Analyze-Phase3NMixedCandidate.mjs` runs that independent prediction against the user-provided *local vanilla source*, only then compares the resulting rectangles to frozen native DayZ evidence. The fixture is never used as an input to the candidate planner.

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
$layoutPath = 'P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout'
node scripts\Compare-Phase3NNativeGeometry.mjs $layoutPath |
    Tee-Object -FilePath phase3n-native-vs-studio-refined.txt
node scripts\Analyze-Phase3NMixedCandidate.mjs $layoutPath |
    Tee-Object -FilePath phase3n-mixed-candidate.txt
```

The updated native comparator groups inherited mismatch ancestry and reports local geometry deltas. The new mixed-axis candidate tests cover a synthetic structural reproduction of both observed hierarchies, all six previously validated Phase 3M nested controls, and rejection of an unmeasured Scroll height. These tests are evidence-based regression checks, **not new independent native captures**.

Expected geometry-test total: **466** (previously 460 + two comparator regression cases + four candidate cases), pending local confirmation. Do not claim acceptance until the local suite and vanilla `phase3n-mixed-candidate.txt` both pass scrutiny. Native source capture is at 1920×1080 and does not validate arbitrary viewport sizes.

## 2026-11-02 — Five-flag experimental snapshot integration

Local test results independently reported **466/466**, TypeScript and Vite build PASS. The local vanilla source produced:

- Original five-flag snapshot: 34 native visible rectangles comparable; 9 matched and 25 mismatched. First-mismatch ancestors: `right_area_root` (21 affected), `server_list_root` (4 affected).
- The separately implemented, read-only `ProbeMixedAxisGrid` candidate: **33 comparable native rectangles, 33 matched, 0 mismatches**. It did not use the frozen native rectangles to calculate its predictions. The standalone native root is excluded from this second count.

The bounded mixed-axis planner is now wired as a **fallback inside the existing five-flag, opt-in nested Grid path** in `GeometrySnapshot.ts`. No sixth browser option, no default enablement, and no changes to default authored geometry. The previously validated, narrower Phase 3M `ProbeNestedAllocatedGrid` always takes precedence if it accepts the node. Phase 3N only attempts additional ordinary relative siblings and exact-height, non-content ScrollWidgets in observed one-column measured-content stacks; unsupported dependencies continue to reject.

A new `grid-mixed-allocation-prototype` applied-strategy **report label** distinguishes mixed plans from Phase 3M's `grid-nested-allocation-prototype`. It is a diagnostic label, not a new user-facing flag.

A synthetic widget-tree regression captures native *structural* patterns for the server list and filter panel, without committing game layouts or using native pixels to drive the solver. The integration tests check all **34 visible static native reference rectangles** (including the standalone root), require the mixed strategy on the two top-level roots, and assert earlier four-flag and default behavior remain unchanged. Existing six controlled Phase 3M native tests remain required. The synthetic test does not substitute for actual parity on the locally extracted vanilla source or at other viewports.

Local validation needed:

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build

$layoutPath = 'P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout'
node scripts\Compare-Phase3NNativeGeometry.mjs $layoutPath |
    Tee-Object -FilePath phase3n-integrated-native-comparison.txt

node scripts\Analyze-NativeLayoutGeometry.mjs $layoutPath --json |
    ConvertFrom-Json |
    Select-Object -ExpandProperty nestedSnapshotAppliedStrategies |
    Group-Object mode |
    Select-Object Name,Count
```

Expected tests: **468** (466 before integration + 2 new snapshot tests), pending verification. Expected compared static native rectangles: 34, with a hoped-for 34/34, but only actual local output establishes that. The standalone `details_root` is invisible and deliberately excluded. Only when native-vs-Studio comparison confirms the output should the five-flag browser preview be visually checked against the standalone native client capture. The local DayZ build may require localized text/font and image resources separately; geometric parity alone does not certify appearance or live menu behavior.

## 2026-11-02 — Accepted scoped Phase 3N native rectangle comparison

The user ran `npm run test:geometry-engine` on the integrated five-flag branch and confirmed **468/468 passing**, `npm run typecheck` PASS and `npm run build` PASS (91 transformed modules).

The unmodified local vanilla `server_browser_tab_pages.layout` produced this **actual integrated Studio-vs-independent-DayZ-native** result at 1920×1080:

- `Compared=34 matched=34 mismatched=0`, tolerance 0.025 unzoomed px.
- `Native lifecycle differences=0` (after-create / post-update / post-settle).
- `First mismatched ancestors`: none.
- `Native/source sibling-order differences=1` in the hidden details subtree; the unique name+parent match recovers it.
- `snapshot issues=69` across the whole standalone source; these are **not** 69 mismatches in the 34 verified visible rectangles. They require separate classification before claims of broad parity.
- `details_root` is invisible; its description descendants are excluded from visual parity scoring.
- Comparison previously said `Five-flag nested strategies=0` because it counted only the *older Phase 3M mode*. The comparator now reports `Phase 3M nested` and `Phase 3N mixed` separately. This is **reporting-only**, no solver change.

**Scoped acceptance:** the Phase 3N mixed one-column nested allocation extension reproduces all measured visible, static rectangles for the standalone vanilla server browser at 1920×1080. This is not acceptance for the full live server-browser application, non-visible states, resource styling/fonts, or other resolutions.

**Next evidence recommended before broad enablement:** capture or validate an independent 1440×810 standalone native measurement of this same layout and run a second unrelated vanilla layout through the same measured-comparison process. Then inspect the Studio browser preview with the five existing flags, at identical viewport, and classify residual `snapshot issues` by code and whether they affect visible widgets. Retain the Phase 3M controlled fixtures and default/four-flag regression gates. Do not infer all native layout behavior from this one success.

One new comparator-reporting regression test has been registered. Expected geometry tests **469** after pulling the reporting-only commit; local validation is still required.
