# FNT5 pipeline consolidation — step 1: shared experimental configuration

**Base:** `research/native-font-integration-audit` at `daaee5c6`. Workbench/Studio 32-case parent clipping visual gate passed and the user subsequently confirmed **309/309** geometry tests on `research/native-font-descender-boundary` at `9155cc93`.

This branch is a **mechanical configuration refactor**, not a native behavior or font algorithm change.

- New pure `ParseFnt5ResearchOptions(search)` in `src/renderer/engine/Fnt5ResearchOptions.ts` centralizes the ten existing FNT5 research switches and their original strict URL semantics.
- `SdfTextCanvas.tsx` and `Canvas.tsx` take the research snapshot once at module initialization, preserving existing startup behavior.
- `ProjectWorkspace.ts` calls `ReadFnt5ResearchOptions()` when indexing, preserving existing indexing-time detection of `experimentalStandaloneFnt5=1`.
- Default query remains **legacy rendering**: no standalone FNT5, no median MSDF, no bearing placement, no height fit, and no baseline override.
- Explicit URL values such as `experimentalFnt5Fit=height`, `experimentalFnt5Fit=1`, and `experimentalFnt5LineOrigin=0.08` are kept raw for the existing numerical resolvers to validate. No new global mutable state, UI control, or default policy is introduced.
- This commit does not modify the decoder, glyph color/alpha, advance, draw coordinates, widget chrome, CSS clipping, font assets, or PR #47.

The dedicated regression suite confirms default values, enabled combinations, strict boolean parsing, duplicates, and source consumers.

## Validate

```powershell
git fetch origin
git switch research/native-font-pipeline-consolidation
git pull --ff-only
npm run test:geometry-engine
npm run test:native-image-uv
npm run typecheck
npm run build
```

The prior geometry suite had **309** tests; this commit adds **5** tests, so expect **314/314** if all pass. Verification is still required on the Windows checkout. Re-run the existing `Hg9` and clipping fixtures with the same URL to ensure there is no visible change, but there is no need to create a new Workbench fixture for the mechanical config move.

**Next consolidation slice:** extract a single pure glyph draw-plan selector for legacy, cell and bearing paths, preserving existing `Fnt5Placement`, `SdfAtlasCell`, glyph advance and log behavior. Keep it isolated until the current 314-test gate passes.
