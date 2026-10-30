# Layout parser corpus integration gate — metadata and mixed identifiers

**Date:** 2026-10-30 | **Branch:** `research/native-layout-corpus-gate` | **Base:** `5ff66ec4`.

This change addresses a structural class of layout source that appears **96 times across 48 layouts** in the user's previously supplied corpus: `ScriptParamsClass` declarations. The source format also mixes traditional names, quoted IDs, and a real identifier-less HUD frame. A parser may recognize all `*Class` declarations without treating them all as renderable widget children.

## Implementation

`LayoutParser` stores non-widget class declarations in `sourceAuxiliaryBlocks`, with their original group/line provenance. The renderer, `WidgetTree`, and managed layouts see only `children` containing widget classes. Canonical `Serialize` interleaves widget and auxiliary declarations in source order across multiple groups, preserving script settings including `AlignChilds` and `Gap`. The unmodified source is still available byte-for-byte as `LayoutDocument.source` for the existing source-aware export path.

This is a generic AST distinction, **not a special case for HUD offsets** or a font/style fix. Existing (possibly duplicated) source ID strings are retained and separate from unique in-memory `node.id`.

The repository tests include specific ID-less root/child, mixed declarations, repeated ID, grouped and direct metadata, canonical reparse, and metadata exclusion from widget child slots. They are synthetic contract tests and do **not** replace running the actual 333-file corpus.

## Private corpus procedure

The original five ZIPs and standalone `sort.layout` are not published to this public repository. Extract them into a local directory outside the Git checkout (e.g., `$env:TEMP\NIH-Layout-Corpus\`); preserve separate archive subfolders. Then run:

```powershell
git fetch origin
git switch research/native-layout-corpus-gate
git pull --ff-only
npm run test:layout-ids
npm run test:geometry-engine
npm run typecheck
npm run build
npm run test:layout-corpus -- "$env:TEMP\NIH-Layout-Corpus"
```

The corpus runner reports **actual** scanned files, widget/auxiliary counts, source preservation and canonical round-trip mismatches; it exits nonzero on a discrepancy. Expect 333 files, 12,348 widgets and 96 `ScriptParamsClass` metadata declarations **if all six supplied inputs were extracted**. Use `--expect-files=333` for strict corpus completeness. Do not treat synthetic test counts or the previous lexical scanner as a full parser PASS.

PR #47 remains untouched. A green corpus run plus a side-by-side recheck of `day_z_hud.layout` are the acceptance requirements before considering this compatibility change for integration.
