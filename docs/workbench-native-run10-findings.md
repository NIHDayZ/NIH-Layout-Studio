# Workbench native resource/render trace — Run 10 (2026-10-29)

## Provenance

Pinned `WorkbenchApp.exe` SHA-256: `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`. Ghidra 12.2 headless, existing Run 04 Safe project. Read-only processing, full autoanalysis disabled. This is an interoperability summary, **not** original developer source.

Extraction: 56 targets; 51 decompiled; five addresses without recognized function boundaries; no decompiler errors/truncations. All eight targeted vtable entries matched. Results archive: `NIH_Workbench_EngineRecon_Results_10.zip` (local, not committed).

## ImageWidget and rendering: high-confidence findings

- Native ImageWidget render: `0x1408B2480`, verified vtable slot6.
- Image dispatch: `0x1408EA750`; reads widget bounds at `+0x88..+0x94`. A flag triggers boundary rounding before dispatch.
- Renderer draw: `0x1408EA020`, verified `IWidgetRenderInterface` vtable slot18 (byte offset `+0x90`).
- ImageWidget chooses the image resource using index at `+0x188`; it also passes texture rectangle, flags, colors, and rendering parameters to the shared dispatcher.
- In the textured-quad draw path, renderer reads eight UV components ordered TL(U,V), TR(U,V), BR(U,V), BL(U,V). Widget flag word `+0xA8` bit26 selects horizontal U inversion; bit27 selects vertical V inversion. These are *independent per-component permutations*, not a reordering of whole UV point pairs.
- Quad emitted vertices are TL, TR, BL, BR. `NativeImageUv.ts` mirrors these exact component selections. Its regression tests include deliberately nonrectangular source UVs to catch false point-swapping implementations.
- Renderer `0x1408EA020` has an alternative path for drawing without an explicit source rectangle, plus resource, blend, color, and drawing-mode handling. Do not infer a complete native renderer implementation from the UV subset.

### Important limitation

The authored property names setting flags bit26 and bit27 are **not yet established**. The inspected ImageWidget property loader `0x1408B1790` reads per-property tokens at `0x146143A10` and `0x146143A14` and writes flag masks `0x04000000` and `0x08000000`, respectively. These static token locations are zero in the data image because they are initialized dynamically. A correct authored-property mapping requires tracing the native property registration sequence, not guessing labels.

## Font pair data: confirmed lookup, loader still unresolved

- `IRenderDistanceFont` pair lookup `0x1408E2980`: pointer at `+0x78`, count at `+0x84`.
- `IRenderFont` pair lookup `0x1408EEBA0`: pointer at `+0x88`, count at `+0x94`.
- Both use a sorted 8-byte record, packed 16-bit pair key at `+0`, value at `+4`; binary-search misses return zero. Per-character advance paths use these lookups.
- Neither FNT3 nor FNT5 file serialization of these arrays was established in Run 10.
- The investigated `MatFontInternal` virtual methods, including `0x140ACA510` and `0x140ACA910`, heavily manipulate property values, strings, and resource/editor metadata. They **must not** be described as verified binary-font loading routines.

## New research prototype

Branch `research/native-image-uv-run10` includes:
- `src/renderer/engine/NativeImageUv.ts`: pure shared native-derived UV mapping, no live renderer changes.
- `tests/native-image-uv.test.mjs`: seven regression cases; locally run with strict TypeScript compilation.
- `npm run test:native-image-uv`: dedicated validation command.

This branch descends from `research/native-fixaspect-run09`, and neither prototype is merged into PR #47.

## Next high-value native research

1. Cross-reference writes to global property tokens `0x146143A10` and `0x146143A14` in the widget registration initializer; recover native property string names and optional defaults.
2. Identify the actual FNT3/FNT5 binary parsing and pair-table loading functions using explicit format markers / resource-manager call sites rather than editor property objects.
3. Map the image source-rectangle layout, rendering-mode flag combinations, clipping and alpha paths before integrating into production previews.

Confidence: **verified** for vtable links, pair lookup record shape, U/V quad permutation, and the property-loader use of both flip-bit masks; **unresolved** for authored property names, FNT pair serialization, and complete draw-mode semantics.
