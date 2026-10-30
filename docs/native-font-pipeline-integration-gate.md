# Native FNT5 pipeline — integration and regression gate (step 5)

**Branch:** `research/native-font-integration-gate`  
**Base:** `research/native-font-resource-cache` at `3788274d`  
**Goal:** Validate the *combined* configuration → source selection → sizing → line origin → atlas selection → glyph placement → SDF/MSDF alpha → canvas integration behavior across legacy and research modes, while preserving default rendering and prior Workbench evidence.

## Actual code changes

Two small, behavior-preserving optimizations in `BuildProjectWorkspace`:

1. Parse the standalone FNT5 research flag **once per workspace font-indexing pass**, instead of once for each FNT5 font. This is captured after EDDS decoding, where the font indexing phase begins.
2. Read an `.fsdf` sidecar's immutable `File.text()` contents **once**, using the same string for `ParseFsdf` and `ParseFsdfGlyphMetrics`. Previously the same file was read twice per resource.

Neither change adjusts font lookup keys, sidecar preference, parsed content, font geometry, sprite caching, alpha curves, text alignment or native clipping. Existing research-option source assertions were updated to the new single-read location.

## Integration tests

A new test file, `tests/native-font-pipeline-integration.test.mjs`, contains **13 cases**:
- Legacy, no-flag composition for the **same 20 measured Hg9 controls** (sizing, baseline, FSDF cell and draw mode)
- Explicit experiment composition on all 20 controls (height, −0.08×height line origin, standalone atlas and bearing mode)
- Standalone FNT5 independent from the old Book24-only TCRD flag
- Non-FNT5 guardrails and explicit authored sizes
- Multiline origin exception and cell-mode precedence
- Distinct red-channel SDF and median MSDF alpha, including cache key modes
- Retention of **previously measured**, versioned Hg9 and 32-case clipping evidence without pretending the numeric fixture is newly re-captured
- One-read indexing, pure resource boundaries, reused atlas source context and one canvas glyph draw

**Important:** FNT5 metrics passed into the pure cross-stage planning tests are synthetic unit doubles; they test integration contracts and must not be labeled recovered native font measurements. The historical `Hg9` and clipping JSON remain the only independent visual evidence in these checks. The tests are not browser pixel-comparison automation and do not independently establish full Workbench shader parity.

## Windows validation

```powershell
git fetch origin
git switch research/native-font-integration-gate
git pull --ff-only
npm run test:geometry-engine
npm run test:native-image-uv
npm run test:fnt5
npm run test:sdf-preview
npm run test:imageset
npm run typecheck
npm run build
```

**Expected geometry tests: 351** (338 in Phase 4 plus 13). Pending actual Windows execution.

If those pass, the safest remaining tasks are a deliberate **merge-readiness review** of research versus PR #47, and a *separate* native ButtonWidget visual-state/default audit. No font rendering default is changed here. The FNT5 integration remains opt-in; the legacy FSDF, non-FNT5 and CSS paths must stay supported. PR #47 remains draft and unmodified.

## Known limitations

- Exact native FNT5 shader/gamma/antialiasing, multiline/explicit property behavior, unsupported file variants and self-clipping remain unproven.
- Existing `debugFnt5Sampling` placement bounds check is a research diagnostic, not proof of paint beyond a native scissor.
- A default Studio ButtonWidget fallback blue-gray background remains different from the shown Workbench fixtures and must not be "fixed" by altering glyph alpha or font origins.
