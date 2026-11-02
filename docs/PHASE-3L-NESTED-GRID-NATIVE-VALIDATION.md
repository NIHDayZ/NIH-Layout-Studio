# Phase 3L — Native nested GridSpacer dependency validation

## Measured baseline (Phase 3K / actual vanilla server browser)

User local validation completed: **434/434 tests passed**, `npm run typecheck` passed, and `npm run build` passed (Vite v7.3.7). A browser screenshot of the eight-case single-axis fixture with four research flags shows the expected two-column arrangement across width-only and height-only modes. The actual `server_browser_tab_pages.layout` audit at root 1920×1080 measured:

| Comparison | Result |
|---|---:|
| GridSpacers present | 43 |
| Legacy shared native relative Grid strategies | 0 |
| Phase 3I allocated-parent both-axis Grid strategies | 2 |
| Additional Phase 3K allocated-parent single-axis Grid strategies | 22 |
| Unsupported under the combined four-flag strategy | 19 |
| Rectangle changes from Phase 3I to four-flag preview | 89 |

**These are Studio model activations, not 24 independently verified native Workbench rectangles.** The calculated 89 rectangle changes are not a native acceptance score.

The key remaining native dependencies are:

1. `server_list_root` (content-sized both axes) → `server_list_content_root` (both axes) → `basic_infoserver_list_content_header` (width-only). The leaf header now activates, but its two ancestors remain unsupported because their direct children include nested content-sized GridSpacers.
2. `right_area_root` (height-only) → `filters_root` (height-only) → `filters_content` (both axes). The filters content now activates, but neither outer GridSpacer does.

Other subtrees may have additional constraints; this experiment targets those two general *nested manager* patterns rather than attempting isolated coordinate fixes.

## Six controlled Workbench native cases

File: `tests/fixtures/workbench-grid/NIH_Grid_Nested_Dependency_Matrix.layout`.

| Case family | First three columns | Second three columns |
|---|---|---|
| Outer parent content axis | Height-only, width-only, both | Height-only, width-only, both |
| Nested depth | Outer Grid → Inner Grid → colored children | Outer Grid → Inner Grid → width-only Leaf Grid → colored children |
| Outer size | relative 0.7×0.72 | relative 0.7×0.72 |
| Inner size | relative 0.65×0.55; content BOTH | same |
| Leaf size | no extra leaf | relative 0.55×0.65; content WIDTH only |
| Other children | exact-size colorable marker panels | same |

All six use the same fixed 570×465 outer slot, identical grid cell settings (2 columns, 2 rows, size-independent padding and margin), the same blue/orange/green swatch definitions, and individually labeled neutral-color backgrounds. The fixed slot is only the measurement frame; the nested Grids remain authored parent-relative and content sized. The test is designed to expose possible parent/child allocation dependencies rather than force a known outcome.

The yellow and magenta marker panels provide visibility into outer and inner cell allocation even when the deeper colored swatches collapse or are displaced. A missing/collapsed swatch is an observation to record, **not** a reason to manually fix fixture positions.

### Why no experimental algorithm change yet

The existing `ProbeAllocatedParentRelativeGrid` and `ProbeAllocatedParentSingleAxisGrid` must reject nested content-sized Grid children because the child's resolved content dimensions are not necessarily known when the parent requests its own content size. Using a guessed fraction of the source-authored parent rectangle would risk circular sizing errors.

An eligible *descendant* GridSpacer may arrange its direct children while the enclosing GridSpacers remain unresolved. Thus apparent improvement of a leaf header or filter row does not certify the width or height of the containing panel. We need native Workbench observations for the parent-chain allocation order before implementing a nested pass.

## Validation and native capture

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
```

**Expected total 438** (434 locally verified plus four new source/guard tests), pending local execution. Staging only copies the fixture into the disposable `P:\NIH_GridMeasurementProbe` tree. It does not edit any vanilla `P:\gui` file or require packing a PBO to open layouts in Workbench.

Open in Workbench:

```text
P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Grid_Nested_Dependency_Matrix.layout
```

Open the corresponding repository layout in Studio with the four previously validated *research-only* flags:

```text
http://localhost:5173/?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1&experimentalAllocatedParentRelativeGrid=1&experimentalAllocatedParentSingleAxisGrid=1
```

Use a 1920×1080 authored root and 46% zoom in both. One complete **Workbench screenshot first** is the immediate native-evidence requirement; Studio comparison can follow. The native screenshot must be checked for consistent backgrounds, visible swatches, marker panels, clipping and overlap. Preserve the source values and record pixel bounds relative to each colored background before changing any model.

**Do not infer an invisible GridSpacer's final rectangle solely from the visible swatches.** If native rendered children don't uniquely determine the parent bounds, use the existing DayZ runtime widget snapshot probe to capture actual parent and child rectangles. Only after the native reference has been recorded should we implement the smallest bounded, opt-in nested measurement/arrangement candidate and validate it on both these controls and the vanilla server-browser subtree.

## Acceptance remaining

Even successful nested GridSpacer sizing would not finish NIH Layout Studio: scroll clipping, text and localization, images/styles, alpha and color, dynamic widget effects, source editing and native Workbench reopen need independent acceptance. This phase explicitly preserves the production/default renderer and the source round-trip baseline.
