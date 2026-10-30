# Phase 2B: opt-in full-tree geometry snapshot bridge

`?experimentalGeometrySnapshot=1` now makes Canvas prepare `MeasureLayoutTree` and `ArrangeMeasuredGeometry` once per layout/viewport change, and use their localRect values for all displayed widget positions, including nested containers. It bypasses the independent live managed-child planning and Grid content-size adjustments only while the option is enabled. Default behavior is unchanged.

The current snapshot deliberately leaves unsupported native Grid/Wrap/Scroll strategies at authored rectangles. The experiment is for proving ownership and surfacing differences, **not** a claim that its HUD managed elements already match Workbench. Duplicate internal IDs fail closed back to the default geometry path. Existing drag interactions and presentation remain intact; native equivalence and selection while dragging still require comparison.

Next reconcile the snapshot strategies against the proven opt-in live preview and native fixtures, then remove the transitional adapter after end-to-end parity tests. PR #47 unchanged.
