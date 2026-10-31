# Phase 2M — opt-in shared geometry snapshot bridge

Status: **research branch only**; production Canvas behavior unchanged. This stage integrates the Phase 2L native-derived pure GridSpacer model into the same shared snapshot measurement/arrangement pass used by other widget families. It does not create an alternate UI renderer.

## Activation contract

Explicit options for `ArrangeMeasuredGeometry(measured, viewport, dpiScale, options)`:

```ts
{
	constrainedGrid: true,
	gridRelativeContentPrototype: true
}
```

Without **both** flags the native-derived relative-content path is inactive. The preexisting `gridContentArrangement` fixed-child prototype stays separate and retains its existing guards. There is no Canvas-facing toggle or production default change.

The new `GridRelativeBridge.ts` consumes already decoded `MeasuredLayoutNode` properties and calls `PlanNativeRelativeGrid` from `GridRelativeContent.ts`. A pass-local WeakMap caches successful and unsupported measurements. Nested content-sized GridSpacers are measured bottom-up; a managed child of any other family or a partial/unverified nested dependency fails closed without guessed dimensions.

`GeometrySnapshot.ts` uses the **same** measured grid plan for the parent extent and child slots through `LayoutArrangers.ts`, preserving alignment recalculation, normal snapshots, shared strategy reporting, original document order, and existing managed visibility selection. The planner never depends on a source-authored widget ID.

## Native validation

`tests/grid-native-relative-snapshot-bridge.test.mjs` is an end-to-end shared geometry snapshot check, using independently captured `grid-complex-phase2l-native.json`, not a second hardcoded sizing formula:

- 20 top-level content-sized GridSpacer cases and their one nested grid
- 21 measured grid parent rectangles, 86 participating managed child rectangles per viewport
- Two captured root dimensions (1920x1080 and 1120x720)
- Assert an explicit strategy application, no unresolved grid issues on supported cases, and stable visibility
- Assert default options, old fixed-child options, and the new flag without `constrainedGrid` remain unchanged
- An unsupported nested managed child refuses the new strategy instead of guessing

**Known difference:** the excluded invisible child in `LHiddenSkip` has no native managed slot and is intentionally not compared for screen geometry. A fallback authored snapshot still retains it as a nonvisible node. This research bridge does **not** claim fully native hidden widget getter semantics.

Unsupported behavior remains unclaimed for fixed-height overflow, invalid/negative child inputs, unknown visibility flags, non-grid nested content, and runtime mutation or invalidation.

## Local verification

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git switch research/live-snapshot-bridge
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
git status --short
```

Only after successful local compilation and regression checks should the result be considered validated. Until then it is **committed but unverified**; keep the experiments off in the app.
