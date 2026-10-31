# Phase 2O — URL-gated shared-snapshot Canvas preview

**Research branch only.** The normal NIH Layout Studio editor and exported `.layout` sources remain unchanged by default. Phase 2O reuses the Phase 2M native-derived GridSpacer measurement/arrangement path; it does not add a new renderer or a persistent setting.

## Validation

Run from `Z:\GitHub\NIH-Layout-Studio`:

```powershell
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
git status --short
```

The new `tests/grid-relative-canvas-preview.test.mjs` protects the explicit URL opt-in and verifies an independently observed Phase 2L grid has a different measured width only when the experimental options are used.

## Compare the editor preview

Start the local editor with `npm run dev`, then use the **actual URL printed by Vite**, preserving any nondefault port.

1. **Control:** open `?experimentalGeometrySnapshot=1` and load `tests/fixtures/workbench-grid/NIH_Grid_Complex_Matrix.layout` in Studio.
2. **Phase 2O experiment:** open the same editor and fixture with `?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1`.
3. Choose the captured 1920x1080 canvas resolution, scale at 100% when measuring screen pixels (or account for the editor zoom), and turn on the existing widget bounds debug display if needed.
4. Compare grid positions, sizes, child order, nested grid structure and visibility against the independently captured native geometry. Switch to 1120x720 only as a separate controlled comparison.
5. Compare a rendered screenshot from Workbench / native DayZ at the same resolution and UI scale with an actual Studio Canvas screenshot. The Phase 2N static HTML outlines are a **numerical diagnostic**, not a rendered Workbench reference.

Do not mutate the authoritative Phase 2L layout file or its native golden values. If a separately styled visual-only copy is needed for visible PanelWidget colors in native DayZ, ensure the PanelWidget type uses **`rover_sim_colorable`**; the original layout remains the geometry-control fixture. A blank PanelWidget surface is not by itself evidence of wrong widget sizing.

## Safety and limits

- Both URL query flags are required. `experimentalGridRelativeContent=1` without `experimentalGeometrySnapshot=1` does **nothing**.
- The option is deliberately not shown in the normal editor UI, not saved to projects, not enabled on the default route and not used by exported `.layout` source.
- Existing `experimentalSnapshotManaged` Wrap research flag remains independent.
- Canvas uses the existing `geometryById` map and React render components; no new Canvas geometry algorithm is introduced.
- Existing native-evidence guardrails still reject unsupported nested dependencies. An excluded hidden child is left as an invisible authored fallback and **not** claimed to match native hidden-getter coordinates.
- Only a controlled rendered Workbench comparison can establish actual visual parity. The recovered grid rectangle measurements do not validate FNT5, clipping, textures, stencil behavior or every widget family.
