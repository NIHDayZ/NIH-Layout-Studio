# Native engine consolidation — validation gate

**Date:** 2026-10-29  
**Branch:** `research/native-engine-consolidation`  
**Base:** `feature/unified-layout-engine` (PR #47, unchanged)

## Scope

The research branch contains:
- Native `fixaspect` modes (0=unchanged, 1=width from authored ratio and height, 2=fit parent, 3=cover parent) in shared `WidgetGeometry` using independently verified registration + property-loader + rectangle-resolver instructions (Runs 08–09).
- Verified ImageWidget `flip u` / `flip v` property decoding and common image-surface mirroring in `Canvas` (Runs 10–11). The native UV permutation helper remains separately reusable; CSS mirroring is equivalent only for axis-aligned image presentation.
- Removal of the older *ImageWidget-only* textual `fixaspect` sizing branch (`inside`, `fixwidth`, `fixheight`) from `Canvas`. Shared geometry now owns aspect resolution across widget types.
- Regression coverage for four aspect modes, exact-size bypass, first-property-wins decoding, independent U/V flips, and cross-widget geometry. The new source guard asserts that the competing ImageWidget resolver is not reintroduced.
- Native research documentation through Run 15. No speculative FNT5 KERN reader has been added.

## Static integration audit

Verified against the branch on GitHub:
- `Canvas.tsx` has zero remaining calls to `GetImageDestination` and zero direct reads of `fixaspect`.
- `WidgetGeometry.ts` decodes `fixaspect` through `DecodeNativeAspectMode` and calls `ResolveNativeAspectSize` before shared reference-edge alignment.
- `Canvas.tsx` uses the native ImageWidget property/flip helper for resolved image surfaces.
- `test:geometry-engine` includes `tests/native-image-geometry.test.mjs`; `test:native-image-uv` remains a separate regression command.
- PR #47 was not edited or merged.

## Local validation (required before merge)

The connector cannot execute the full repository dependency graph in the user's Windows checkout; no GitHub Actions minutes were consumed. Run `scripts/Validate-NativeEngine.ps1` in the checked-out research branch. The script executes:
1. `npm run typecheck`
2. `npm run test:geometry-engine`
3. `npm run test:native-image-uv`
4. `npm run test:grid-layout`
5. `npm run test:imageset`
6. `npm run test:sdf-preview`
7. `npm run build`

It archives command logs and environment information under the user's `Documents\\NIH-Workbench-Native` directory and reports exit codes. Use `-InstallDependencies` if the local `node_modules` directory is absent or stale. Do not claim full CI validation until the resulting log files have been reviewed.

## Remaining risks before promotion

1. **Workbench visual oracle.** Native geometry arithmetic is supported by disassembly; multi-widget screenshot/parity tests still need to confirm visual placement, ImageWidget flips, and clipping in realistic layouts.
2. **Image modes.** CSS axis flips do not cover arbitrary quad UV geometry or every native image draw mode. Native `+0x90` renderer dispatch has additional unimplemented modes.
3. **Content-size interactions.** Aspect handling with size-to-content and managed Grid/Wrap/Scroll layouts needs more native evidence; the authored-rectangle path is implemented.
4. **Resource formats.** FNT5 KERN and versioned TCRD readers remain unverified. No format changes should be added until a true loader is identified.
5. **Legacy authored strings.** The textual image-only aspect labels were an approximation. Real native `fixaspect` values are numeric; Studio should not quietly reinterpret unsupported strings as native modes.

**Merge decision:** defer until local validation logs pass and visual parity is accepted. Keep PR #47 separate.
