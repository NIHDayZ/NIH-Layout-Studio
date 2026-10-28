# Native-safe property order preservation — design, not implementation

**Status:** Design proposal for the next independently reviewed change.
**Production implementation:** Not started. The existing `LayoutParser.Serialize()`
and all source-aware editor operations remain unchanged in PR #47.

## Problem and native evidence

The DayZ client syntax matrix from 2026-10-28 created twelve independent
layout resources. On the tested `FrameWidgetClass` and `PanelWidgetClass`
parents, an unsupported-looking `"Size To Content V" 0` or an arbitrary
`"NIH_ProbeUnknown" 0` **before** the child group resulted in zero
native children. With the same property **after** the child group,
both children remained. A recognized `clipchildren 1` control kept
the children regardless of order. This is observed loader behavior,
not recovery of the internal C++ parser.

References:

- `tests/fixtures/workbench-content/2026-10-28-property-syntax-native-results.md`
- `tests/fixtures/workbench-content/capture.property-syntax.native.2026-10-28.log`
- `tests/native-content-property-syntax.test.mjs`

In Studio today, `LayoutParser.Parse()` represents `properties` and
`children` in separate arrays. Although each parsed property and
child declaration retains a source line number, **the node structure
does not explicitly preserve the child-group placement relative to
properties**. `LayoutParser.SerializeNode()` writes every property
first and the children group second. Consequently, a canonical
structural edit may transform a native-loadable after-child property
into a native-hazardous before-child property.

**Important distinction:** Direct Save and Export As write the current
`source` string without calling the canonical serializer. Source-aware
patch operations likewise may preserve order for their specific edits.
Do not describe an unchanged direct export as reordering the source.

## Design decision

Treat **authored source fidelity** and **canonical serialization**
as distinct operations with explicit, testable contracts. Preserve
property/group ordering by structure, not by a heuristic that pushes
known hazardous properties to the bottom.

### Proposed source model

Introduce optional ordered source entries on `LayoutNode` without
removing existing `properties` or `children` arrays:

```ts
type NodeSourceEntry =
  | { kind: "property"; propertyId: string; line: number }
  | { kind: "children-group"; groupId: string; line: number }
  | { kind: "trivia"; sourceRange: { start: number; end: number } };
```

This is a conceptual model, **not a committed TypeScript type**.
Exact field names, stable IDs, and trivia strategy require
implementation review. The point is that the serializer must know
the actual relative order, including an explicit child-group
boundary and properties after it. Multiple child groups,
noncanonical line breaks and comments need a documented policy
instead of assuming a single child-group location.

### Editing and serialization policy

1. **Unchanged source:** Write bytes as supplied (including line
   endings, quoting, comments and property placement).
2. **Small source-aware property edits:** Patch the existing source
   span, retaining placement and surrounding trivia. Do not make
   a whole-node canonical rewrite unless the patch is impossible.
3. **Structural edits:** Preserve ordered entries for unaffected
   nodes and rebase only the changed blocks. A duplicate should
   preserve the original block's property/group order, while
   reparenting should move the full source range.
4. **Newly authored properties:** Use an explicit stable insertion
   policy. Prefer the original property zone when safe; do not
   place unknown attributes before a child block merely because
   another widget's schema accepts the property.
5. **Fallback serialization:** If source-order provenance cannot be
   reconstructed reliably, flag a non-mutating compatibility
   issue and require an explicit choice. Do not silently claim
   output is native-safe.
6. **No native behavior invention:** The generic model records
   *syntax order* for every widget family; the limited
   class/property evidence registry is used only to produce
   risk warnings.
7. **Compatibility and performance:** Keep the geometry engine
   free of source-token parsing. Update ordered entries when a
   document changes, not during every Canvas layout pass.

## Acceptance tests for an implementation PR

All must pass before replacing the current canonical serializer.

- Parse → serialize → reparse preserves child/group order for
  `FrameContentAfter0`, `FrameUnknownAfter0`,
  `PanelContentAfter0`, and `PanelUnknownAfter0`.
- The same round-trip is lossless for all 12 isolated syntax fixtures,
  including recognized `clipchildren` controls.
- Comments, quoted names/values, CRLF/LF, repeated properties,
  multiple properties per line and unknown attributes remain intact
  or have explicitly documented formatting changes.
- Source-aware property update/rename, duplicate, reparent, move,
  delete and undo/redo preserve relative order of untouched blocks.
- The new model never manufactures, deletes or reorders children
  based on the native evidence registry.
- Saving/exporting unchanged source produces **byte-identical** files.
- Geometry calculations and native parity snapshot tests remain
  unchanged when the syntax-order capability is unused.
- Browser smoke tests cover a file with an after-child unknown
  property both before and after a structural edit, and the
  compatibility warning correctly follows the resulting source.

## Out of scope

No global property allowlist, native C++ parser reconstruction,
automatic unknown-property stripping, Canvas subtree suppression,
or speculative content-size negotiation is included.

The current read-only `NativePropertyCompatibility` and
Save/Export review remain valuable until the new serializer has
been designed, tested, and independently approved. PR #47 stays
draft and unmerged.
