# Phase 2C — native Wrap strategy reconciliation in the measured snapshot

The measured snapshot now optionally uses the **same** `PlanFixedWrapPreview` implementation already proven visually for the DayZ HUD's fixed-size, right-aligned icon row. This is implemented in `LayoutArrangers.ArrangeFixedWrap` behind `fixedWrapPreview`; it is NOT a Canvas geometry override.

`?experimentalGeometrySnapshot=1&experimentalSnapshotManaged=1` enables the shared fixed Wrap preview inside the snapshot. The preview preserves existing eligibility checks, native managed visibility selection, source child indices, and non-Wrap strategy decisions. Default snapshots and the existing strict start-aligned fixed Wrap option retain prior behavior.

Grid remains unresolved when its parent requires size-to-content; the large action-list collapse is expected until content-size negotiation is proven. Do not bypass the native eligibility rule or infer Grid sizing from the visual comparison alone. This phase explicitly reconciles fixed Wrap only, not all managed families.

Tests should cover opt-in right-to-left placement, preserving default and strict strategies, and refusing content-sized parent arrangements. Verify with 333 corpus and Workbench against 1920x1080 / 46% viewport. PR #47 untouched.
