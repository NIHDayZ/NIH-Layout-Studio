# Native font source selection — isolated experiment

Parent branch: `research/native-font-resource-parity`, baseline route evidence on `229f3ed3`.

The October 29 logs establish that Book24 remains on `FSDF fallback` even with `experimentalStandaloneFnt5=1`. The source registers a standalone FNT5 entry, then overwrites the same keys when a sidecar exists. This branch makes one **experimental-only** source-order correction: if a valid standalone FNT5 has been registered for the current font, keep it rather than replacing it with the sidecar. Without the switch, no standalone resource loads and normal FSDF behavior is unchanged.

A structural regression checks the guard and both assignment points, but it is not a browser-font integration test. The proper acceptance test is an independently observed `[FNT5 sampling]` record for **sdf_metronbook24** with `selected: "Standalone FNT5 cell"` (rather than `FSDF fallback`) under the switch. It must still be separately visually compared to Workbench and should not be assumed to look better merely because the path changed.

After running geometry tests and build on this branch, reload and **reindex** the vanilla GUI assets with:

```
http://localhost:5173/?experimentalStandaloneFnt5=1&debugFnt5Sampling=1
```

The branch does not change FNT5 glyph placement, alpha sampling, letter spacing, font-height fitting, Canvas behavior, or the non-experimental default. Both the failure and future improvements must be measured before considering promotion. PR #47 remains draft.
