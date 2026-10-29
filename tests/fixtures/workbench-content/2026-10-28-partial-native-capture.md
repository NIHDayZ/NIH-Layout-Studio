# DayZ native content sizing — first client capture (2026-10-28)

## Provenance and completeness

The user ran the `NIH_ContentSizingProbe` test PBO in a real DayZ client.
The submitted material is the filtered `[NIH_LayoutStudio][ContentProbe]`
output from `script_2026-10-28_13-33-15.log`, with complete BEGIN/END
markers for four phases at 13:33:55–13:33:59 local log time.

The captured observations are stored in
[`capture.runtime.partial.2026-10-28.json`](capture.runtime.partial.2026-10-28.json).
**This is an incomplete native capture.** Exactly 13 of the original 18
authored widgets were traversed in **each** of the four phases. The five
missing names are `FrameChildTop`, `FrameChildBottom`, `PanelChild`,
`VisibleChild`, and `HiddenChild`. All five are nested inside
`FrameContentHeight`, `PanelContentBoth`, or `FrameContentHidden`.
The outer containers themselves were present. The first probe used
`GetChildren/GetSibling` recursion but did not independently query
`FindAnyWidget` for the missing descendants.

Do **not** infer that DayZ did not construct the descendants, nor that
Frame/Panel must omit children under content flags. The log only shows
the recursive traversal failed to report them. The full unfiltered client
log, game build identifier, UI scale, image resource loading confirmation,
and Workbench screen visuals were not supplied.

## Observed native text sizing

At baseline (root 1120×460), all four text samples using
`TEST 0123456789` have native `GetTextSize` **128×16**:

| Widget | Authored GetSize | Screen GetScreenSize | Native GetTextSize |
|---|---|---|---|
| TextFixed | 220×40 | 220×40 | 128×16 |
| TextToTextH | 220×36 | 128×36 | 128×16 |
| TextToTextV | 180×36 | 180×16 | 128×16 |
| TextToTextBoth | 220×36 | 128×16 | 128×16 |
| TextToContentBoth | 220×36 | 220×36 | 128×16 |

When the text becomes `X`, `GetTextSize` becomes **9×16**.
`TextToTextH` then measures **9×36**, while
`TextToTextBoth` measures **9×16** in screen space. Restoring the
text restores **128×16** without changing the authored `GetSize`
values. At the fourth phase, the root shrinks to 720×460; the sampled
text glyph sizes and fixed child pixel positions remain unchanged.

**Supported narrow rule:** In these fixed-font, fixed-resolution
test cases, native `size to text h/v` selects the corresponding
`GetTextSize` axis as the final screen size, while `GetSize`
continues to return the authored dimensions. This is independent
native getter evidence, **not** a verified universal DPI/font/wrapping
algorithm.

The `TextLongNarrow` case had authored width 140 and native
`GetTextSize=235×16` while its screen rectangle was 140×16.
This does **not** demonstrate width-constrained multiline wrapping.

## What cannot be concluded yet

- The `size to content h/v` property on Text and Image did not change
  their observed `GetScreenSize` in these cases. This does **not**
  prove that all widget families ignore such flags or that the image
  resource was resolved to a known intrinsic logical size.
- Frame/Panel outer rectangles remained authored at 190×20, but their
  five expected descendants were not traversed. Their native content
  extent selection/inclusion rules remain **unverified**.
- `GetFlags()` produced identical integers for several text cases
  that nonetheless had different final sizes. The raw flags are not
  sufficient to infer auto-sizing policy.
- The game client build and scale branch are unknown. The DayZ Tools
  Addon Builder version is not the game build.

## Next controlled fixture (v2)

The source `NIH_ContentSizing_Parity.layout` now additionally contains
three controls (with 9 extra widget names; **27 total**):

1. Fixed Frame with two ordinary nested children.
2. Frame using uppercase `"Size To Content V" 1`, with two
   ordinary children (tests property spelling/case against lower-case
   cases and native class support).
3. WrapSpacer with uppercase `"Size To Content V" 1` and two
   fixed children (tests a widget family normally supporting
   content sizing).

The updated test-only script records `FindAnyWidget` results for
all eleven nested child names and direct `GetChildren` counts for
six parents, separately from recursive traversal. This isolates
missing construction/lookup from traversal behavior.

The strict extractor now expects **27 widgets** for v2. The v1
13-widget capture is deliberately stored separately and **must not**
be presented as an extractor PASS for v2. Native results from the new
fixture do not yet exist; the updated probe must be staged, rebuilt,
and tested before interpreting any further content-size behavior.

No production Canvas behavior, SDF measurement rules, or native
content-sized parent algorithm was changed based on these findings.
