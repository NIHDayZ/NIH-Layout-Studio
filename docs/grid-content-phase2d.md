# Phase 2D — Grid content-size evidence boundary

The recovered native Grid arrangement routine establishes the fixed-cell arithmetic but does **not** establish the size-to-content measurement algorithm or its update order. Enabling the live provisional `PlanGrid` in the snapshot would falsely imply native parity.

This commit introduces a **read-only** fixed-child Grid envelope candidate in the snapshot via `gridContentCandidateDiagnostics`. It reports only a lower-bound estimate from independent exact child sizes, native decoded row/column settings and spacing; it declines relative sizes, content-sized children, nested managers, invalid visibility policies and oversubscribed grids. It neither changes rectangles nor resolves native sizing issues.

The vanilla HUD content-sized Grid action lists remain unresolved. Further native measurement captures are necessary before promoting any candidate into a layout strategy. Existing default and experimental preview rendering remain unchanged; PR #47 unaffected.
