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

`research/native-visual-parity-gate` adds a native `.layout` fixture, parser/geometry predictions, and a **two-phase empty capture template**. It also includes a new disposable client-only probe under `tests/fixtures/native-aspect/runtime-mod/`, an original-log-to-JSON extractor, and fail-closed extraction regression tests. The new probe reuses the existing native getter pattern and **compiled and ran in DayZ on October 29, 2026**.

**These additions were not part of the validated baseline commit.** Rerun `npm run test:geometry-engine`, `npm run test:native-image-uv`, TypeScript checks and the production build on this branch. The two empty native capture cases must remain `PENDING`; simulated extractor tests and Studio predictions must never be reported as native PASS.

After a genuine client capture, use `scripts/extract-native-aspect-log.mjs` to convert the original log into a separate JSON evidence file, then run the existing generic comparator with this fixture as the explicit layout argument. See `tests/fixtures/native-aspect/README.md` and `runtime-mod/README.md`. Once real native measurements and client-build provenance are available, evaluate mismatches centrally rather than adding widget-specific CSS patches. Visual Workbench/Studio screenshot parity and textured ImageWidget UV parity are independent, still-open acceptance gates.


## Independent native aspect capture — 2026-10-29

The user's disposable `NIH_NativeAspectProbe` built and ran in a DayZ **client**. Original `script_2026-10-29_09-34-51.log` SHA-256: `704346403ff69d2ce0080197802dcc8e284e53c8acfbce04e6804ef894ce91cc`. The separately supplied filtered probe log contains identical AspectProbe messages.

Native `GetScreenPos/GetScreenSize` returned **9/9 descendants per phase**, all **18/18 rectangles equal** the current shared geometry predictions across **72 coordinate/size fields** (maximum difference **0**). The phase at (31,19) confirmed the expected origin translation. Four common numeric `fixaspect` modes plus exact-width bypass were included across Frame/Panel/Text/Image/Button. Parent sizes were exact in both phases, so this does **not** prove adaptive root-relative sizing.

Structured evidence: `tests/fixtures/native-aspect/capture.runtime.2026-10-29.json`. Do not commit raw client log/user local paths. `DAYZ_1_30` is recorded as a script define, **not a precise binary build number**. The native build was subsequently supplied in a user-provided DayZ Launcher version screenshot: **Game `1.30.164.200.000000`**, **Launcher `1.6.164064`**. Its SHA-256 is `89df829251ef3779281d50b928b64253a61412ad884f26a52e14e53640499a4f`; it was provided after the log capture and was **not** embedded in that log. The recorded screenshot is associated with the same user's reported test environment, rather than cryptographically tied to the captured process. With this additional provenance, the comparator is expected to report **2 PASS (9/9 each)**. It must still FAIL on a coordinate mismatch.

After the native capture was added, the user's Windows checkout completed **262/262 geometry tests** (zero failed or skipped); the comparator reported the expected **2 PENDING (9/9 each)** prior to supplying the version screenshot. TypeScript validation and Vite build passed earlier on the branch. The subsequently added version-evidence updates and new regression test require another local test run. This evidence verifies the common authored rectangle path only. It does not establish native clipping/scissor, textured ImageWidget UV flips, FNT5 glyph painting, DPI or full Workbench visual fidelity.


## Versioned native capture gate — follow-up evidence

The original capture and native rectangles remain unmodified. The full DayZ log identified only the `DAYZ_1_30` script define. A user-supplied DayZ Launcher screenshot subsequently identifies **Game `1.30.164.200.000000`** and **Launcher `1.6.164064`**. Screenshot SHA-256: `89df829251ef3779281d50b928b64253a61412ad884f26a52e14e53640499a4f`; screenshot itself is not committed. This is a separately supplied version record and not a binary hash or a version string logged by the probe.

The fixture's two `provenance.nativeBuild` fields now carry the exact reported **game** version; the launcher version and screenshot hash remain separate metadata. Expected strict comparator result: **2 PASS**, **0 FAIL**, **0 PENDING**, with **9/9 numerically matching descendants in each case**. A deliberate mismatch must still fail. The unchanged pending template still reports PENDING. The new version assertion and demotion regression require local validation.

This closes the *tested native authored rectangle and fixaspect gate*, not the broader Workbench visual acceptance gates. Textured ImageWidget U/V pixel rendering, FNT5 glyphs, clipping/scissor, scale/DPI and managed layout interactions remain open. Keep PR #47 in draft.


## Completed local strict parity verification — October 29, 2026

The user's PowerShell 5.1 transcript `Pasted text(20261029-172543).txt` documents an unmodified fast-forward from `978415b` to `cbfcd14`, followed by:

- `npm run test:geometry-engine`: **263 passed, zero failed/cancelled/skipped/todo**.
- `npm run compare:workbench-common -- tests/fixtures/native-aspect/capture.runtime.2026-10-29.json tests/fixtures/native-aspect/NIH_NativeAspect_Parity.layout`: **2 PASS, zero FAIL/PENDING/SYNTHETIC**.
- `root-960x500-origin`: **9/9** independent native descendant rectangles matched.
- `root-1280x720-offset`: **9/9** independent native descendant rectangles matched.

The strict comparator succeeded without `--allow-pending` after associating the separately supplied DayZ Launcher screenshot game version `1.30.164.200.000000` with both capture records. The original client log still does **not** independently contain that precise build string.

**Disposition:** CLOSE the tested common `fixaspect` authored-rectangle gate on this research branch. Keep the original empty-capture fixture as a negative test. Do **not** infer visual UV, clipping, FNT5 or full Workbench parity from this result; PR #47 remains draft pending those separate gates.
