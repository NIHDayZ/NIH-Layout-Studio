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

Virtual class data in `.rdata` is found around these image VAs:

- `GridSpacerWidget`: `0x142062CE0`.
- `WrapSpacerWidget`: `0x142062F60`.
- `SpacerWidget`: `0x142062A68`.

The associated compiled methods include:

- `0x1408E0960`: one spacer arrangement routine. Reads two integer-sized fields, computes a usable width/height by subtracting two edge spacings and the per-cell spacing multiplied by count minus one, divides by a respective count, and writes child rectangles (positions and sizes). Walks children via native pointers, optionally skips some children, and invokes a virtual update method.
- `0x1408E0E80`: a different spacer arrangement routine. Walks children, checks accumulated child widths against available width, conditionally starts another line, and applies alignment adjustments. Also contains spacing scaling and explicit child-rectangle updates.
- `0x1408E0670`: a size/measurement routine. Iterates children and updates measured bounds; it is not the same as the arrangement routine.

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
