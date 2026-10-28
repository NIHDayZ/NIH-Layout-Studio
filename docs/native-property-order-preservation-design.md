# Native-safe property order preservation — implementation stages

**Status:** Phase A (canonical property / child-group ordering) is
implemented on draft PR #47; remaining source-trivia fidelity and
structural-edit requirements below are explicitly not complete.
Direct Save/Export still writes the current source string unchanged.

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

Originally, `LayoutParser.Parse()` represented properties and
children in separate arrays and `SerializeNode()` wrote every property
first. Phase A now records each child's group-opening source line and
parent identity. That fixes the verified after-child ordering defect
for parsed layouts, while exact trivia, source formatting and
all editing edge cases remain separate validation work.

**Important distinction:** Direct Save and Export As write the current
`source` string without calling the canonical serializer. Source-aware
patch operations likewise may preserve order for their specific edits.
Do not describe an unchanged direct export as reordering the source.

## Phase A — source-order-aware canonical serializer

The minimal implementation uses the existing `LayoutProperty.line` data,
and records the original **child-group opening line** and **source
parent ID** on each parsed direct child as optional
`LayoutNode.sourceGroupLine` and `sourceGroupParentId`.
`LayoutParser.SerializeNode` merges the existing property and group
entries by source line rather than writing every property first.
Multiple distinct child groups remain distinct; an arbitrary property
between two groups retains its relative order.

New children, or children reparented to an unrelated node, have
untrusted original group coordinates and join the last valid existing
group where one exists. If no source-group provenance exists,
new/synthesized nodes use the traditional properties-before-children
fallback. This is an intentional conservative boundary, **not**
a guarantee that every synthesized/modified layout will load in
DayZ. Canonical source remains formatted output and is not a
round-trip preserving comments, whitespace, or exact original bytes.

All class/property native compatibility findings remain read-only:
verified property-before-children hazards still warn; a previously
hazardous **serializer-order** warning is now informational for
parsed source whose child-group ordering is known and preserved.
The exact native C++ parsing implementation is still unknown.

Regression coverage includes all twelve actual DayZ syntax fixtures,
property ordering between multiple child groups, a new child joining
the existing group, a child moved from another parent, and fallback
behavior for synthesized nodes without provenance. Browser coverage
also checks that a safe trailing native property exports without an
unnecessary warning. Geometry and Canvas strategies are unchanged.

**Remaining Phase B design tasks:** source trivia/comments,
new property insertion policies under direct AST edits, byte-accurate
source-range patching beyond current source-aware actions, and
extensive undo/redo plus structural-edit browser tests. The
conceptual ordered-entry model below is an option for Phase B,
not a requirement to replace the newly introduced small metadata
with a second parse tree.

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

The read-only `NativePropertyCompatibility` and Save/Export
review remain valuable for **observed native child-loss risks**.
Phase A ordering preservation is implemented in PR #47, which
remains draft and unmerged. Full trivia/source-format preservation
is not implemented or claimed.
