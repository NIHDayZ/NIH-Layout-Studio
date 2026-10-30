# NIH Layout Studio — PR #47 and Native Research Merge Readiness

**Review date:** 2026-10-29  
**PR #47:** [Unified Enfusion layout engine](https://github.com/NIHDayZ/NIH-Layout-Studio/pull/47)  
**Main:** `521a99206787201e8fa4b51991845d7977e77643`  
**PR #47 head:** `7622914f35da3ecaea8991e931616734d146a130` (`feature/unified-layout-engine`)  
**Research baseline:** `1ec22f181f3f21de61a2ea45499dda7704680e61` (`research/native-font-integration-gate`)  
**Status:** Read-only merge assessment. **No PR, production default, or main-branch merge performed.**

## Executive decision

**Do not fold the entire research branch into PR #47.** Complete the existing PR #47 acceptance gate independently. Then promote native aspect/UV support through a focused follow-up, and evaluate the opt-in FNT5 renderer through a separate integration proposal.

The research branch is a direct descendant of PR #47's current head. GitHub's compare endpoint reports **69 ahead, 0 behind**. This means Git ancestry is uncomplicated; it does not imply the extra 69 commits share one release-readiness status.

PR #47 itself is **367 ahead of main**; its current REST metadata reports **147 files changed, +20,071/−207 lines, 367 commits**. GitHub reports its head Git-mergeable, but it remains **draft** with `mergeable_state: blocked`. The most recent returned runs for PR #47 head are **CI success**, **Dependency Review success**, and **Browser compatibility smoke success**. These results apply **only to PR #47 head `7622914f`**, not automatically to the research head. The research SHA returned no pull-request-triggered workflow runs. The user reports completing local research test commands through Phase 5, but no final terminal transcript or local acceptance report was attached to that confirmation; do not translate the acknowledgment into a documented numeric test pass.

## Scope between PR #47 head and research head

GitHub's compare endpoint returned **103 changed files**. This is not one font-only patch:

| Group | Files | Release classification |
|---|---:|---|
| Source code | **13** | Native aspect / UV and opt-in FNT5 rendering + resource/cache refactors |
| Tests and independent capture fixtures | **60** | Verification and research provenance; mixed native-readiness levels |
| Research/audit documents | **27** | Evidence and limitations, useful but not production acceptance |
| Validation scripts | **2** | Evidence and local test harness |
| Package test runner | **1** | Wires the new checks |

The thirteen changed source files are:
- `src/components/Canvas.tsx`
- `src/project/Fnt5Standalone.ts`
- `src/project/ProjectWorkspace.ts`
- `src/project/SdfFontResource.ts`
- `src/project/SdfGlyphDrawPlan.ts`
- `src/project/SdfGlyphRasterPlan.ts`
- `src/project/SdfTextCanvas.tsx`
- `src/renderer/engine/Fnt5FontSizingExperiment.ts`
- `src/renderer/engine/Fnt5LineOriginExperiment.ts`
- `src/renderer/engine/Fnt5ResearchOptions.ts`
- `src/renderer/engine/NativeAspectSizing.ts`
- `src/renderer/engine/NativeImageUv.ts`
- `src/renderer/engine/WidgetGeometry.ts`

Review **`Canvas.tsx`, `WidgetGeometry.ts`, `SdfTextCanvas.tsx`, and `ProjectWorkspace.ts`** first: these are the integration boundaries where optional helpers connect to active user-visible behavior.

## Readiness matrix

| Candidate | Technical/evidence status | Integration decision |
|---|---|---|
| **PR #47 shared geometry, native source serialization, compatibility diagnostics** | Existing PR #47 head has green CI/Dependency/Chromium checks. Native common getter captures support tested geometry; project-style manual acceptance is explicitly `PENDING` in `docs/pr47-windows-acceptance.md`. | **Keep draft until local real-layout acceptance**; reviewed squash merge of PR #47 *alone* is reasonable only after that gate. |
| **Native `fixaspect` common sizing** | `NativeAspectSizing.ts` and `WidgetGeometry.ts` decode numeric modes and apply shared rectangle sizing when an authored `fixaspect` property is present. Independently captured native aspect getters cover the tested modes and roots. Not gated by a font experiment URL. | **Focused post-PR #47 candidate**; require real HUD/inventory style tests for exact/relative sizing and managed-layout interaction. |
| **ImageWidget `flip u`/`flip v`** | Native registration and UV bits are derived; `NativeImageUv.ts` maps common U/V mirroring to CSS; screenshots support four simple axis-aligned orientations. Applies when authored properties request flips. | **Same or companion focused PR after PR #47**; verify image layers/modes and editor interactions. Do not claim arbitrary quad UV parity. |
| **FNT5 standalone resources, median MSDF, bearing draw plan, widget-height sizing, shared `-0.08×height` baseline** | Independent Workbench/Studio samples: 20-control Hg9 holdout mean top error **1.769 logical px**, 20 ink widths within **2.18% mean absolute difference**; 32-case parent clipping behavior agrees at the 24px boundary. Cross-stage pure tests cover default/experimental selection. Research switches remain explicit. | **Keep opt-in on separate PR**; do **not** promote a calibrated baseline coefficient or claim universal native shader/metric parity. |
| **FNT5 implementation cleanup** | Shared typed research options, pure glyph draw plan, pure atlas sample/alpha helper, renderer-independent `SdfFontResource`, retained atlas context, once-per-workspace FNT5 flag and once-per-sidecar text read. Designed to preserve default output. | **Can be reviewed as source-only cleanup with focused regression gates**, but avoid cherry-picking individual modules without their dependencies and tests. |
| **Browser default Widget chrome** | Workbench screenshot displays unfilled test buttons; Studio `Canvas.BuildWidgetStyle` injects `rgba(50, 68, 86, 0.78)` when ButtonWidget style is neither empty nor blank, including absent style. Unassigned ImageWidget paint also differs in the common fixture. | **Separate default-style review**; don't change font alpha, default CSS fallback, or native geometry to compensate. |

## Existing evidence and what it cannot prove

1. **Native common geometry:** recorded 16 widget classes at two root sizes with observed matching getter rectangles. This is not a complete recovered Enfusion C++ layout engine.
2. **Visual font holdout:** independent `Hg9` evidence is stored under `tests/fixtures/native-font-line-origin/`. The legacy difference **3.794px** was reconstructed from the new capture, not a separate legacy screenshot. `0.08` remains a fitted candidate.
3. **Descender/parent clipping:** `tests/fixtures/native-font-descender/` has 32 paired tests. Both editors suppress substantial overhang when `clipchildren=1`; Workbench retains at most 1–2 screenshot rows of boundary fringe. This does not recover exact GPU scissor rules.
4. **Native image UV/aspect:** verified properties and controlled samples support the implemented paths; remaining image modes, combined content sizing, and native DPI/safe-area logic are outside the captured evidence.
5. **Pure tests versus visual CI:** the geometry suite includes strict fixtures and pure math tests, not a live Workbench pixel-accuracy oracle. An expected count of 351 tests is **not itself a test log**.
6. **PR #47 source safety:** unchanged export can preserve bytes, while canonical Serialize may alter comments, whitespace and line endings. Cross-existing-child-group reorders remain a source-order risk. Manual `PENDING` still applies.

## Sequence for integration without broadening PR #47

1. **Gate A — Finish PR #47 on its own head.** Use the existing `scripts/Prepare-Pr47Acceptance.ps1 -RunChecks` and the documented acceptance matrix on `feature/unified-layout-engine`. Check a real HUD plus a resource/style-backed layout; direct unchanged export SHA, source edit/reload, compatibility warning behavior. The script deliberately does not mark manual rows PASS. Record the actual accepted branch SHA. Do not require impossible interactive scrolling in Workbench.
2. **Gate B — Native geometry/image follow-up.** After PR #47 is accepted, open a focused branch based on the newly merged `main` and bring only the associated native aspect/UV helpers, common geometry/Canvas wiring, tests and exact evidence. Require `npm run test:geometry-engine`, `npm run test:native-image-uv`, typecheck/build and real-layout visual acceptance. Check for conflicts after PR #47 lands.
3. **Gate C — FNT5 cleanup and optional renderer.** Construct a separate reviewable PR carrying all necessary `SdfFontResource`, research config, drawing/raster helpers, FNT5 parser/Workspace/Canvas code and its tests. Keep URL switches opt-in; explicitly test zero-flag legacy SDF, FSDF sidecars, bitmap/CSS fallback, line wrapping, shadows, font style and previously validated holdout fixtures. Run the full local checks and use a real font-heavy project before deciding any default promotion.
4. **Gate D — Native visual defaults.** Independent proposal for unstyled ButtonWidget, no-image ImageWidget, native font defaults, and style precedence. Acceptance should cover normal/hover/pressed/disabled and explicit styles/colors; no quick universal fallback solely from an unstyled fixture.
5. **Do not merge PR #47, research, or `main` without a separately reviewed user decision.** The current research history has 69 extra commits, but its additional evidence files and opt-in code need not all be attached to PR #47.

## Immediate status

- **Git architecture:** research branch is a direct descendant of PR #47 head, with 69 extra commits and no behind commits. No Git-base reconciliation required *at this snapshot*.
- **CI:** green on PR #47 head; no equivalent GitHub PR-triggered run was returned for the research head.
- **User local tests:** last research test command set was reported `completed`; numeric summary and exact SHA execution log unavailable in this conversation.
- **Manual acceptance:** PR #47 real-project visual and unchanged export gates remain `PENDING` in its maintained acceptance document.
- **Source changes made by this audit:** none. This report is documentation only and leaves the original PR draft, its head, and all production defaults unchanged.
