# PR #47 — Consolidation and regression audit

**Audit date:** 2026-10-28
**Branch:** `feature/unified-layout-engine`
**Status:** Draft, unmerged. This document is an integration checkpoint, **not** a declaration of complete native Workbench parity.

## Review scope

The branch is large (over 140 changed files and hundreds of commits)
but most new files are independent native getter fixtures, test code,
evidence documents and a new opt-in engine. **Eight existing production
source files** have been modified: `App.tsx`, `Canvas.tsx`,
`LayoutTypes.ts`, `LayoutParser.ts`, `SdfTextCanvas.tsx`,
`GridLayout.ts`, `LayoutMath.ts` and `styles.css`.
Reviewability and change-surface discipline matter more than
adding additional speculative layout algorithms.

### Production-facing integration checked

| Existing integration | Audit outcome |
|---|---|
| `LayoutMath.ResolveRect` / inverse geometry | Delegates common authored arithmetic into `WidgetGeometry`; old public entry points remain. Differential and geometry/native fixture tests gate it. |
| `GridLayout` | Keeps existing `PlanGrid`, re-exports native-constrained arithmetic from its shared engine module; do not confuse the two algorithms. |
| `Canvas` bitmap glyph width | Reuses `MeasureBitmapAdvance`; the renderer's other text painting remains unchanged. |
| `SdfTextCanvas` | Uses shared `WrapPreviewText` instead of its local line-wrapping loop; text-flow unit regression tests cover the helper. |
| `LayoutParser` | Records source child-group line and original parent, preserves native-tested property order during canonical serialization; direct unchanged Save/Export still writes current source bytes. |
| `App` | Shows evidence-scoped native compatibility warnings, uses explicit non-destructive Save/Export review and keeps the SOURCE editor path separate from Canvas state. |
| Native measurement, content bounds and Scroll/Grid/Wrap candidates | Stay separate from production Canvas policy unless explicitly integrated; experimental candidates cannot be represented as exact native pixel parity. |

### Optimization and regression fixes in this audit

**Duplicate SOURCE parsing removed.** Previously, both native
compatibility warnings and formatting analysis independently called
`LayoutParser.Parse(source)` on the same source edit.
`App` now shares one memoized parsed SOURCE document. Formatting
analysis accepts the already parsed document and **rejects reuse
when `document.source !== source`**. This reduces two full source
parse traversals to one for that combined read-only analysis path.
This is a structural optimization, not a benchmarked speedup claim.

`tests/live-source-analysis.test.mjs` proves the shared path uses
one parse, compares diagnostics against the previous API, rejects
a stale document, and checks the twelve actual native syntax inputs.
A Chromium integration test also verifies that **Normalize All**
can clear formatting defects without removing an independent native
loader warning.

## Native evidence that does exist

- Native common geometry capture covers **16 widget classes × two root sizes**, recording 32 native state rectangles with zero reported comparison differences for the captured getters. These are not full C++ layout algorithms.
- Native content sizing probes recorded actual `TextWidget` sizes and a WrapSpacer height change; the v1/v2 captures are **incomplete** by fixture widget count and remain explicitly labeled as such.
- The native 14-case property matrix showed Frame/Panel child loss from the presence of tested unrecognized-looking properties even at value `0`, whereas tested WrapSpacer retained its children.
- The 12 isolated native syntax resources showed **before/after-child-group parse-order sensitivity** for unsupported-looking Frame/Panel properties, unlike recognized `clipchildren`; these results remain getter evidence, not recovered C++ source.
- Machine-readable original captures, independent extractor checks, and regression tests live under `tests/fixtures/workbench-*/`.

## Merge-readiness boundaries

**Automated gates:** Main CI covers typechecking, build and the existing parser, UI, fonts/imagesets, geometry, grid, text, visibility, native-capture and serialization tests. The scoped Chromium job checks real upload, warning presentation, Cancel/Continue, Ctrl+S, SOURCE edits and byte-identical downloads; the added audit case checks formatting/native warning independence. Dependency Review is a separate required check. Record the final run/commit on PR #47 after completion.

**Not proven by these gates:** Exact Workbench C++ layout algorithms,
native paint/clipping/scrollbar behavior, all DPI/font/asset cases,
the user's full-project visual behavior, all widget property allowlists,
or byte-for-byte trivia preservation under canonical serialization.
The native probes validated class/property hypotheses, not every
possible source structure. Do not claim the whole shared engine is
native-equivalent from these captures.

**Residual implementation risks (not silently corrected here):**

1. **Canonical source trivia:** comments, whitespace, exact line endings and unusual compact syntax can still be reformatted by canonical `Serialize()`. Direct unchanged Save/Export is byte-preserving.
2. **In-memory reordering across multiple existing child groups:** parsed group provenance provides stable syntax positions; an arbitrary AST-only reordering across distinct preexisting groups may require a dedicated source-order edit policy. Current UI move/reparent operations use source-aware patches. Add focused coverage before claiming general arbitrary AST reorder support.
3. **Browser/environment coverage:** Chromium tests pass their supported fixtures, but Windows/local resource paths, real Workbench zoom, rendering quality, scroll interactions and large project assets still need targeted manual visual acceptance.
4. **Review surface:** Do not merge directly without inspecting the eight modified production files, the opt-in boundaries, the source-order fallback and the scope of test-only assets. The hundreds of branch commits favor a reviewed **squash merge** after approval, not a blind merge.

## Windows acceptance bundle prepared

The manual acceptance gate has a non-destructive local helper:
[`scripts/Prepare-Pr47Acceptance.ps1`](../scripts/Prepare-Pr47Acceptance.ps1)
and [the scoped acceptance procedure](pr47-windows-acceptance.md).
It generates a versioned report under Windows TEMP, hashes six
unchanged test layouts, records actual environment/build details
and—only when explicitly requested—runs the existing npm checks.

It **does not** run DayZ/Workbench, collect screenshots, alter
source layouts, install dependencies or mark any local case
PASS by itself. Manual review of same-root-viewport geometry,
the already evidenced static Scroll case, real font/imageset
rendering and source edit/export/reload remains **PENDING**.
The previous Workbench scrolling interaction must not be
repeated as a required gate because that editor did not expose
reliable scrolling during its original test.

## Recommendation

Retain PR #47 as **draft** until final main CI, Dependency Review
and Chromium smoke runs are green on the same branch head and a
short Windows/Workbench acceptance pass confirms the real editor
still behaves as expected. If manual observations reveal visual
discrepancies, address **shared geometry or native source loading**
with evidence; avoid new widget-specific Canvas hacks.
