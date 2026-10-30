# Phase 2B discrepancy attribution — October 30

The independently captured `day_z_hud.layout` comparison reports **163 evaluated, 79 matching, 84 differing, 32 unresolved, 0 duplicate IDs**. These are live-to-snapshot diagnostics, *not* Workbench parity measurements.

Evidence shows repeated 40-unit row displacements at the directly arranged Grid children (for example one authored local Y=0 versus live Y=40). Nested Panels, ContentWidget, images and text retain matching **local** coordinates yet inherit displaced **absolute** coordinates. Treating all 84 records as independent defects would incorrectly multiply a single ancestor disagreement into dozens of alleged rendering problems.

`GeometryComparison` now reports separately:
- `localPlacementDifferences`: widgets whose OWN local rectangle differs;
- `inheritedOffsetDifferences`: same local rectangle, different absolute rectangle;
- `rootCauses`: originating local mismatch and its affected descendant count (ranking by affected widgets).

This is read-only attribution. The snapshot still reports unresolved Grid/Wrap/Content arrangements and native size-to-content. **Do not** globally enable provisional live Grid algorithms as native truth merely to make this comparison count zero. Reconcile by class and verified native constraints, with explicit fallbacks.

Validate tests, build and 333 corpus; then inspect `rootCauses` instead of dumping each descendant record. No PR #47 changes.
