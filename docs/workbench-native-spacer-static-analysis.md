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

**Important:** class-specific offsets must not be conflated. Property-to-field decoding is only partially inferred. For the grid routine, the two values converted from integer fields `+0x160/+0x164` act as edge inset and cell gap, optionally scaled via a parent DPI-style flag; the exact authored-property correspondence needs independent testing.

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

Still unresolved: precisely when the native size-to-content pass overrides/changes final grid child dimensions, how zero/absent row or column settings are initialized, and the exact meaning of alignment and visibility flags. The compiled routine alone does not prove that `Columns=3` is a universal default.
