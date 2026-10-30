# Consolidation Phase 1 — eliminate live Canvas-managed child layout duplication

Branch `research/live-engine-consolidation`, based on `3211c75b`.

## Exact boundary changed

Previously `Canvas.tsx` contained its own `GetSpacerDirection`, `GetSpacerGap`, `GetGridPlan`, Grid cursor placement, Wrap eligibility, and Wrap placement, directly alongside React tree rendering. The existing independent `LayoutMeasurement` / `GeometrySnapshot` / `LayoutArrangers` pipeline did not own these live decisions.

This patch **moves** all those calculations into `src/renderer/engine/LiveManagedGeometry.ts`, using `PlanLiveManagedChildren` and `PlanLiveGridContent`. React's `RenderChildren` now consumes the returned child rectangles. The existing opt-in flags and experimental algorithms retain their previous gates and result ordering. No native properties are newly inferred.

The transitional adapter is intentionally named as such: it is **not** a completed unified measurement/arrangement engine. It exists to remove the live geometry algorithms from Canvas safely, then reconcile them against `PlanManagedChildren` and ultimately replace the two pipelines with one final snapshot. Avoid extending the adapter with independent new native rules.

## Duplicate/conflict inventory

| Concern | Live owner *before* | Engine owner *before* | Follow-up |
|---|---|---|---|
| Ordinary authored rectangle | `Canvas.RenderNode → LayoutMath.ResolveRect` | `WidgetGeometry.ResolveAuthoredRect` | Establish single geometry snapshot and remove Canvas recomputation |
| Grid child arrangement | `Canvas.GetGridPlan` + cursor fallback | `LayoutArrangers.ArrangeConstrainedGrid` | Reconcile experimental intrinsic Grid and native constrained slots with one strategy |
| Wrap child arrangement | `Canvas.RenderChildren` + `PlanFixedWrapPreview` | `LayoutArrangers.ArrangeFixedWrap` | Reconcile right-to-left ordering and centered content in native Wrap strategy |
| Grid content sizing | `Canvas.RenderNode` | `GeometrySnapshot` content probes | Pass final measured parent rect to renderer |
| Visibility/clip | `Canvas.RenderNode` DOM/CSS | `GeometryVisibility` diagnostics | Separate actual native clip from read-only diagnostics |
| Text intrinsic/Wrap content | `Canvas.RenderText` | `ConstrainedText` + `WrapContent` | Supply actual intrinsic measurements before arrangement |
| Images/styles | `Canvas.RenderWidgetContent` | Resource/style helpers | Keep paint independent of layout ownership |

## Acceptance and restrictions

New tests cover preserved default authored positions, opt-in reversed right-aligned Wrap, Grid route consistency, and absence of legacy Canvas planners. The test command must pass locally with `npm run test:geometry-engine`, `npm run typecheck`, `npm run build`, followed by `npm run test:layout-corpus -- "C:\Temp\NIH-Layout-Corpus" --expect-files=333`. Compare the same HUD at 1920×1080 / 46% with `experimentalNativeWrapLayout=1` to check visual nonregression.

**Remaining gate:** the end-to-end canvas still calculates ordinary and sized parent rectangles. Do not claim a fully unified engine or Workbench parity until the next reconciliation phases complete. PR #47 remains unchanged.
