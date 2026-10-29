# Native font source selection — isolated experiment

Parent branch: `research/native-font-resource-parity`, baseline route evidence on `229f3ed3`.

The October 29 logs establish that Book24 remains on `FSDF fallback` even with `experimentalStandaloneFnt5=1`. The source registers a standalone FNT5 entry, then overwrites the same keys when a sidecar exists. This branch makes one **experimental-only** source-order correction: if a valid standalone FNT5 has been registered for the current font, keep it rather than replacing it with the sidecar. Without the switch, no standalone resource loads and normal FSDF behavior is unchanged.

A structural regression checks the guard and both assignment points, but it is not a browser-font integration test. The proper acceptance test is an independently observed `[FNT5 sampling]` record for **sdf_metronbook24** with `selected: "Standalone FNT5 cell"` (rather than `FSDF fallback`) under the switch. It must still be separately visually compared to Workbench and should not be assumed to look better merely because the path changed.

After running geometry tests and build on this branch, reload and **reindex** the vanilla GUI assets with:

```
http://localhost:5173/?experimentalStandaloneFnt5=1&debugFnt5Sampling=1
```

The branch does not change FNT5 glyph placement, alpha sampling, letter spacing, font-height fitting, Canvas behavior, or the non-experimental default. Both the failure and future improvements must be measured before considering promotion. PR #47 remains draft.

## 2026-10-29 actual source-selection observation — PASS

The user reindexed the GUI workspace under `experimentalStandaloneFnt5=1&debugFnt5Sampling=1` and supplied a new screenshot plus the full `[FNT5 sampling]` console trace. Frozen metadata and SHA-256 references: `tests/fixtures/native-font-route/capture.source-selection.2026-10-29.json`. The original screenshot and console are not committed.

All six `ABC012` sampling records per font select **`Standalone FNT5 cell`** for **Book24, Light24 and Book72**, with atlas sizes 1024×1024 for the 24px fonts and 4096×2048 for Book72. This establishes that the experimental source precedence actually works at runtime. It also eliminates FSDF sidecar overwrite as the explanation of the remaining Book24 glyph appearance.

**Glyph parity still FAILS.** The updated screenshot shows Book24 is more recognizable, but all named fonts remain visibly different from native Workbench. The trace identifies `experimentalMsdf: false` and `placementMode: "legacy"` across these samples; Book72 reports 95px cells at nominal 72px and ink outside a 34px widget. No fresh test/build transcript was supplied for this source-selection commit itself.

### Next isolated diagnostic (no additional code change)

Keep the standalone source selection enabled, toggle **MSDF alpha only**, and leave the placement algorithm unchanged:

```
http://localhost:5173/?experimentalStandaloneFnt5=1&experimentalMsdf=1&debugFnt5Sampling=1
```

Reindex if necessary and capture the same screenshot and `[FNT5 sampling]` / `[FNT5 placement]` logs. Verify `msdf: true` and `placementMode: "legacy"`. Compare with the frozen red-channel screenshot. This is a test of the existing experimental median-channel path, **not** a default renderer change or a claim that MSDF matches native. If glyphs remain malformed, test `experimentalFnt5Placement=1` alone next, not together with MSDF. Do not change the renderer based on an unverified combined experiment.
