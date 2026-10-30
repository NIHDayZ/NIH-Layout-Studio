# Phase 2A: Shared managed-strategy dispatch

This change preserves Phase 1's Canvas/adapter separation and brings the native constrained Grid and opt-in fixed Wrap preview behind **one strategy-dispatch entry point** in `LayoutArrangers.ts`: `PlanNativeManagedPreview`. `LiveManagedGeometry` no longer imports native Grid/Wrap planners directly.

The measured snapshot still invokes `PlanManagedChildren`; its existing experimental semantics (notably right-aligned Wrap) are **not silently changed**. The live preview still deliberately supports a Workbench-observed right-to-left fixed Wrap ordering and an opt-in constrained Grid. This is consolidation of dispatch, not yet a single fully measured tree.

Remaining work: reconcile `PlanNativeManagedPreview` with `PlanManagedChildren` and transition Canvas to a single `ArrangeMeasuredGeometry` snapshot as its rectangle source. Preserve unresolved cases, visibility, content-sizing, and viewport-specific geometry constraints.

Do not promote this to production or merge PR #47 until real layout and full geometry tests pass.
