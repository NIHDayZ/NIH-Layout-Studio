# Native content sizing v2 — actual DayZ client observations, 2026-10-28

## Source integrity

The user supplied the **complete client** `script_2026-10-28_14-11-45.log`.
DayZ compiled and loaded `NIH_ContentSizingProbe` with the `DAYZ_1_30`
script define. The full log contains unrelated game/mod warnings, but no
reported `ContentProbe` script error. The actual game client build number
and UI/DPI scale remain **unrecorded**; `DAYZ_1_30` is a script define, not
a specific client build number.

The four captures have complete BEGIN/END pairs, with independent native
`GetScreenPos/GetScreenSize`, `GetPos/GetSize`, widget flags and
`TextWidget.GetTextSize` observations, plus **direct `FindAnyWidget`**
and **parent `GetChildren` counts**:

- `baseline-1120x460`
- `short-text-1120x460`
- `restored-1120x460`
- `baseline-720x460`

**20 of the 27 authored widget names** were present in every phase.
All seven missing widget names were the intended children of four
Frame/Panel containers carrying `size to content` flags. This is an
incomplete native capture; it is nevertheless sufficient to resolve the
prior ambiguity about missing recursive traversal. All actual getter
records, direct name lookups and child counts are preserved in
[`capture.runtime.partial.v2.2026-10-28.json`](capture.runtime.partial.v2.2026-10-28.json).

## Controlled native results

| Authored parent | Sizing property | Authored height | Observed screen height | Direct children |
|---|---|---:|---:|---:|
| `FrameContentHeight` | `size to content v=1` | 20 | 20 | 0 (expected 2) |
| `PanelContentBoth` | `size to content h/v=1` | 20 | 20 | 0 (expected 1) |
| `FrameContentHidden` | `size to content v=1` | 20 | 20 | 0 (expected 2) |
| `FrameContentUpper` | `Size To Content V=1` | 20 | 20 | 0 (expected 2) |
| `FrameFixedControl` | No content-sizing property | 20 | 20 | **2 (expected 2)** |
| `WrapContentUpper` | `Size To Content V=1` | 20 | **28** | **2 (expected 2)** |

The seven absent names were `FrameChildTop`, `FrameChildBottom`,
`PanelChild`, `VisibleChild`, `HiddenChild`, `UpperFrameTop`, and
`UpperFrameBottom`. Every one returned `FindAnyWidget(...)=null`.
The four affected parent widgets were present but returned a native
`GetChildren()` count of **0**. Thus the missing children are **absent
from the reachable native widget hierarchy**, not merely missed by our
recursive logger.

The control Frame had two reachable children; its lower child had screen
rect `(510,395,90,28)`, extending below the parent's 20-high rectangle
`(500,350,190,20)`. Therefore a child extending beyond the fixed
parent's box did not prevent native construction in the control.

The WrapSpacer retained its two children:
`WrapItemOne=(310,350,60,24)`,
`WrapItemTwo=(370,350,90,28)`, side by side.
Its native screen rect `(310,350,190,28)` changed the **height
from authored 20 to 28**; `GetSize` still reported authored height 20.
This is direct evidence of content-height negotiation for **this native
WrapSpacer fixture**. It does not prove more complex width/wrapping,
nested visibility or native per-edge inclusion rules.

## Repeatable TextWidget results

The same native `size to text` behavior was reproduced across all four
phases of v2, consistent with the earlier v1 probe:

- `GetTextSize(TEST 0123456789)=128×16` and `GetTextSize(X)=9×16`.
- `size to text h`: final widget screen width follows the native text width,
  while `GetSize` still reports the authored width.
- `size to text v`: final widget screen height is the native 16.
- Text `size to content h/v` left its authored 220×36 screen rectangle
  unchanged in these cases.
- The narrow sample recorded `GetTextSize=235×16`, while the widget's
  final screen rect remained 140×16; do **not** claim native multiline
  wrapping has been validated.

## Interpretation and next engine implications

The strongest supported conclusion is **class- and property-dependent
native behavior**. In this exact DayZ layout and build context,
`size to content` entries on the ordinary Frame/Panel controls correlate
with their expected children not being present in the created native
hierarchy. Upper- versus lower-case spelling did **not** change that
outcome. It is plausible that those attributes are unsupported for these
widget families by the native layout loader, but this log does not expose
the loader's internal reason. Do **not** generalize this as a rule that
all Frame/Panel children vanish or that these containers inherently
implement content sizing.

The independent fixed Frame and Wrap controls establish that neither
generic recursion nor ordinary child overhang explains the absence.
A definitive parser-level diagnosis would require a controlled
attribute-disabled/attribute-enabled comparison on otherwise identical
Frame/Panel layouts or native loader internals.

The existing `boundedParentContent` Frame/Panel candidate remains an
**opt-in arithmetic prototype**, NOT validated native behavior. Do not
activate it in the production Canvas or silently infer missing native
children from authored ones. Native Wrap, Grid and Text each need their
own demonstrated sizing eligibility rules even though common geometry
arithmetic may be reused.

## Extractor and test policy

The `scripts/extract-workbench-content.mjs` default remains **strict**:
a 20/27 native result fails complete-fixture validation. The explicit
`--allow-partial` option preserves every observed getter and marks status
`incomplete-native-capture` with a required per-phase missing-widget
roster, without converting it to a PASS. It still rejects malformed,
inconsistent or unknown widget observations and unclosed phases.

`tests/native-content-v2.test.mjs` covers the actual independent native
readings; `tests/workbench-content-extractor.test.mjs` protects partial
versus complete semantics. No production Canvas or serialization changes.
