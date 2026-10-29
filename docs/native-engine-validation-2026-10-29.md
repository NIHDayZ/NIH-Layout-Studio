# Native engine local validation — October 29, 2026

## Validated baseline

- **Branch:** `research/native-engine-consolidation`
- **Commit:** `f6d5b106bef400c953f0a11fd4e7372497adc26f`
- **Platform:** Windows, PowerShell 5.1, Node `v24.14.0`
- **Captured:** 2026-10-29 09:16:16 PDT
- **Evidence:** user-supplied `NIH_Native_Engine_Validation_20261029-091616.zip`; SHA-256 `52e31764638c16bbc9f911460a4eb94dee9389284a7ccb80f7ca97418f5be637`. Log bundle retained in original conversation; intentionally not committed.

All 7 validation steps exited 0:

| Validation step | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run test:geometry-engine` | 252/252 PASS |
| `npm run test:native-image-uv` | 11/11 PASS |
| `npm run test:grid-layout` | 20/20 PASS |
| `npm run test:imageset` | 12/12 PASS |
| `npm run test:sdf-preview` | 4/4 PASS |
| `npm run build` | PASS, Vite 7.3.7, 70 modules transformed |

**Total:** 299 automated tests passed, 0 failed, 0 skipped, 0 cancelled. TypeScript compilation and production build completed without warnings in the supplied logs.

### Scope of this evidence

This establishes that the native-derived aspect-sizing and ImageWidget UV-flip implementation, plus the removal of competing image-only `fixaspect` behavior, compiled and passed the selected local suite at that exact baseline commit. `LayoutMath.ResolveRect` calls `DecodeAuthoredGeometry` + `ResolveAuthoredRect`, so this geometry path is used by the live Canvas and editor; it is not a detached helper.

This is **not** evidence of Workbench image-pixel, font, content-size, or screen-space parity. No Web browser/Workbench paired capture was supplied. Do not merge PR #47 solely on this validation.

## Subsequent work on this parity branch

`research/native-visual-parity-gate` adds a new actual `.layout` fixture, a parser/geometry prediction test, and an empty native capture template. **These additions were not part of the validated baseline commit** and require `npm run test:geometry-engine` on this branch. The empty native capture template must remain `PENDING`; synthetic predictions must never be reported as native PASS.

Use the existing generic comparator with this fixture as an explicit layout argument, following `tests/fixtures/native-aspect/README.md`. Once real native measurements and build provenance are available, evaluate mismatches centrally rather than adding widget-specific CSS patches.
