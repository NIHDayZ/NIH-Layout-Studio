# Static investigation: Workbench native spacer layout

**Status: partial binary analysis; not original source recovery.**

The findings below come from static inspection of the user-supplied `DayZ Tools.zip` (no executable launched). No original binary, debugging symbols, or proprietary decompiled code are committed.

## Provenance

- Binary: `DayZ Tools/Bin/Workbench/WorkbenchApp.exe` (Windows x86-64 PE).
- PE linker timestamp: 2026-10-13 08:48:44 UTC.
- SHA-256: `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`.
- Embedded CodeView RSDS points to `WorkbenchApp.pdb` in an internal build workspace, but the PDB itself is not present in the supplied archive.
- The executable has MSVC RTTI entries and class metadata for `enf::SpacerWidget`, `enf::GridSpacerWidget`, `enf::WrapSpacerWidget` and their reflection classes.

## Evidence from compiled routines

**RTTI-verified virtual-table starts** (the earlier values were nearby class-name strings, not virtual tables):

| Class (verified via MSVC RTTI TypeDescriptor) | Vtable start | Slot 13 | Slot 14 |
|---|---|---|---|
| `enf::GridSpacerWidget` | `0x142062A80` | `0x1408DFAE0` | `0x1408E0960` |
| `enf::WrapSpacerWidget` | `0x142062D00` | `0x1408E0670` | `0x1408E0E80` |
| `enf::SpacerWidget` | `0x142062808` | `0x1408E05D0` | `0x1408BCEC0` |

These assignments were verified by reading each vtable's preceding MSVC `RTTICompleteObjectLocator`, resolving its relative `TypeDescriptor`, and matching the class name. This corrects the original class-address ambiguity without relying on undocumented symbol names.

The compiled methods now have class attribution:

- **Grid arrangement `0x1408E0960`**: calculates equal cell dimensions from widget bounds, two edge insets and inter-cell spacing. The value read from object offset `+0x174` determines the **horizontal loop count** (consistent with columns), and `+0x170` determines the **vertical divisor** (consistent with rows). It writes child position `+0x88/+0x8C`, child width/height `+0x90/+0x94`, and calls the child's virtual update at vtable `+0x70`. Child iteration follows a sibling pointer at `+0x68`. Optional child filtering uses a native helper.
- **Wrap arrangement `0x1408E0E80`**: processes child widths against available width, branches when a new line is required, and applies alignment modes (object byte fields `+0x168/+0x169`). It updates child rectangles and invokes virtual child layout.
- **Wrap measurement `0x1408E0670`**: calls the base measurement helper `0x1408E05D0` and traverses children to derive the required vertical extent. A float stored at `+0x170` in this *different class* is therefore **not** the grid's row count.
- **Base spacer measurement `0x1408E05D0`**: a distinct method assigned to the base `SpacerWidget` vtable.

**Important:** class-specific offsets must not be conflated. Property-to-field decoding is only partially inferred. For the grid routine, integer fields `+0x160/+0x164` act as edge inset and cell gap, optionally scaled via a parent DPI-style flag. The embedded native metadata labels `Padding` as “Outer margin” and `Margin` as “Padding between elements,” consistent with this interpretation.

The arithmetic observed in the first routine can be expressed, approximately, as:

```text
cellWidth  = (containerWidth  - 2*horizontalInset - (columns-1)*horizontalGap) / columns
cellHeight = (containerHeight - 2*verticalInset   - (rows-1)*verticalGap) / rows
```

This is a **description of an observed code path**, not a universal GridSpacer specification. The native class/field mapping and when that code path is selected still need to be proven. Memory offsets have different meanings across some related implementations, so identifying one integer counter as `Rows` or `Columns` without additional verification would be unsafe.

## Recovery boundaries

- **Confirmed:** the relevant classes and native functions exist in the executable; at least two different arrangement strategies and a measurement strategy are compiled into it.
- **Confirmed:** the arrangement routines include child iteration, visibility-like filtering, padding/spacing transformations, relative dimension handling, and alignment/rectangle writes.
- **Not established:** exact default row/column inference, all property-to-field mappings, how wrap children affect their parents, full two-pass update ordering, and how the renderer handles DPI or editor-only options.
- **Not available:** original BI C++ source or native PDB symbols. A readable substitute must be **reconstructed**, not extracted verbatim from the archive.

## Implications for NIH Layout Studio

Do not replace one hardcoded rule with another. In particular, the existing experimental `columns=3` fallback was observed in one layout but is not an established engine default. Use native-function analysis and controlled Workbench probes on several layouts to derive:

1. Property decoding and defaults (rows, columns, padding, margin, alignment, visibility).
2. Container intrinsic measurement and size-to-content.
3. Fixed-size and relative-size cell allocation.
4. Child ordering, wraps and overflow, including nested spacers.
5. Final layout update and coordinate transforms.

Keep `experimentalGridLayout=1` opt-in until these rules are demonstrated independently of any one layout. Workbench `spacertest.layout`, `spacertest2.layout`, and `scrolltest.layout` remain good regression cases.

**No native code has been reproduced or shipped.** This document records interoperable behavioral observations, not source-code equivalence.


## Verified instruction-level distinctions (second pass)

The grid arithmetic is row-major: the horizontal inner loop compares its index with `[grid+0x174]` and advances the child X coordinate by the computed cell width plus spacing; the outer loop advances Y by cell height plus spacing. The routine uses `(count - 1) * spacing` before division, not a hardcoded number of columns. This provides an evidence-backed fixed-cell formula when a grid is constrained by explicit parent dimensions.

For `spacertest.layout`, the unconfigured outer grid does **not** have size-to-content enabled, and the nested grid has `Columns=2`, `Rows=5`. Both should be tested against native equal-cell allocation. By contrast, `spacertest2.layout` enables size-to-content on both axes and visibly uses fixed outer cells and flexible middle cells. Those are different constraints; do not apply one equal-cell rule indiscriminately to both.

Still unresolved: precisely when the native size-to-content pass overrides/changes final grid child dimensions and the exact meaning of alignment and visibility flags. Defaults are verified in the property-loading routine below.


## First native-derived editor prototype (opt-in)

`src/renderer/GridLayout.ts` now exports `PlanConstrainedGrid`, a pure implementation of the **equal-cell arithmetic** verified in native `GridSpacerWidget` arrangement. It preserves explicitly configured row counts even when the grid contains fewer children than available cells. The helper accepts resolved counts; `ResolveNativeGridCounts` supplies the independently recovered native defaults.

Enable `experimentalGridLayout=1&experimentalNativeConstrainedGrid=1` to route **only grids with both `Size To Content H=0` and `Size To Content V=0`** through that planner. Other grids continue to use the existing experimental intrinsic-size planner, preserving the validated `spacertest2.layout` behavior. `experimentalNativeConstrainedGrid` is temporary until Workbench comparisons establish parity.

The native property loader at `0x1408DED50` assigns `3` independently to column count `+0x174` and row count `+0x170` when saved values are absent. Both defaults are now confirmed. Native reflection labels `Padding` as an outer margin and `Margin` as spacing between elements, supporting the inset versus cell-gap interpretation.

Suggested immediate test: compare `spacertest.layout` at 1920×1080 and the same zoom in both programs. The unconfigured outer grid should allocate equal cells and the nested `Columns=2, Rows=5` grid should divide into ten slots rather than overflow due to authored child sizes. The nested `WrapSpacerWidget` still uses the provisional authored-coordinate model and is **not** expected to match until its native arrangement logic is reconstructed.

### Disassembly verification checkpoints

- `0x1408E0A5F` reads the horizontal count from `[grid+0x174]`.
- `0x1408E0A8B` reads the vertical count from `[grid+0x170]`.
- `0x1408E0B30` bounds the horizontal child loop.
- `0x1408E0B4C` writes a child's X and width; `0x1408E0B70` writes Y and height, subject to mode flags.
- `0x1408E0B96` invokes a child's virtual update after assigning its rectangle.

The instruction addresses are image VAs with module base `0x140000000`, not file offsets. They are valid only for the archive's pinned executable build.


## Verified default counts and property semantics (third pass)

At native property loader `0x1408DED50`, a missing **Columns** value leads to immediate `3` at `0x1408DED7C`, written to `[grid+0x174]` at `0x1408DED85`. A missing **Rows** value leads to immediate `3` at `0x1408DEDA2`, written to `[grid+0x170]`; present row values are loaded instead. Both defaults are independent: `Rows=5` with omitted `Columns` does **not** imply `ceil(children/5)` columns.

Embedded class-property metadata near RVA `0x206ED40` distinguishes `Padding` (description **Outer margin**) from `Margin` (description **Padding between elements**). Thus the editor's new constrained-grid path maps `Padding` to the two edge insets and `Margin` to spacing between cells. The binary's exact propagation of DPI scaling and content-alignment flags still requires separate validation.

Only the constrained grid arithmetic has been ported. Wrap and size-to-content behavior remains incomplete.


## WrapSpacer arrangement trace (fourth pass)

`WrapSpacerWidget` virtual slot 14 resolves to `0x1408E0E80`. The routine reads the available parent width, subtracts twice the outer `Padding`-like inset, and iterates children via their sibling links. At `0x1408E0FD0–0x1408E0FE9`, a nonempty line is checked against remaining available width plus the next child's width. When the line would overflow, it finalizes that line and starts another, advancing by the maximum line height and inter-element spacing. This is a **true flow/wrap algorithm**, not preservation of authored child X/Y positions.

For the horizontal alignment mode byte `[wrap+0x168]`: mode `1` uses the far edge as reference (end/right); mode `2` distributes leftover space by half (center). The remaining default path uses the starting edge. For the vertical mode byte `[wrap+0x169]`, branches at `0x1408E10CE–0x1408E1136` adjust Y using the available height and the measured content height; modes `1` and `2` represent different end/center handling. The native wrap measurement method at `0x1408E0670` calculates required content extent before the arrangement pass.

**Next implementation step:** a pure `WrapSpacer` measurement-and-flow planner with line formation, maximum line height, horizontal line alignment, container-level vertical alignment, visibility filtering and size-to-content handling; compare it against the shipped `spacertest.layout`. The exact order in which Workbench updates child intrinsic dimensions before measuring lines is still under analysis. Do not connect this prototype to default rendering until this is checked.
