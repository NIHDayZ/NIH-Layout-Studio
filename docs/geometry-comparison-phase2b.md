# Whole-tree geometry comparison — Phase 2B diagnostic

The opt-in flag `?experimentalGeometrySnapshot=1&compareGeometryPipelines=1` now logs a whole-tree differential report in the browser console. `CompareLiveToSnapshot` separately recreates the existing Canvas layout path (including legacy spacers and optional Grid/Wrap modes), and compares local AND absolute rectangles with `ArrangeMeasuredGeometry` at the same viewport. Reports include widget identity, class, parent identity, managed ancestry, both rectangles, delta, duplicate IDs and unresolved native strategy diagnostics.

This is a **diagnostic** with no effect on rendered geometry. It cannot establish native Workbench parity and does not include browser paint offsets or drag preview state. The snapshot intentionally leaves some native layout strategies unresolved. The comparison exposes which families diverge; it does not correct them.

Use `console.info("[NIH Layout Studio][Geometry comparison]", report)` and inspect `differences` and `unresolved`. Default UI behavior and PR #47 are unaffected.
