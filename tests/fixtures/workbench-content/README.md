# Native text / image / content-size investigation

**Status (2026-10-28):** Both disposable DayZ probes compiled and ran
in-game. The **v1** capture contained 13/18 authored widgets. The revised
**v2** capture independently recorded 20/27 authored widgets, all native
direct lookup results and all parent child-count checks at four phases.

**Confirmed native difference:** A fixed Frame loaded 2/2 children;
a content-sized WrapSpacer loaded 2/2 and grew from 20 to **28** height;
the tested content-flagged Frame/Panel parents loaded **0** children and
remained at their authored 20 height. The seven absent children were
unreachable by both recursive traversal and native `FindAnyWidget`.
This establishes a class/property-specific loader behavior in the
fixture; **the exact native parser-level cause is not yet proven**.
Text's `size to text` dimensions also repeated the prior measured
128×16 and 9×16 native values.

See [v2 runtime evidence](2026-10-28-v2-native-capture.md),
[v2 machine-readable native getter capture](capture.runtime.partial.v2.2026-10-28.json),
and [original v1 capture](2026-10-28-partial-native-capture.md).
Neither incomplete capture is a full parity reference. The client
build and exact native clipping/DPI context remain unrecorded.

## Why this is a separate fixture

The previous DayZ captures independently validated **32 of 32 common
descendant screen rectangles** under two root sizes. That does not identify
native content-size negotiation, text glyph metrics, or imageset-derived
dimensions. The current SDF preview and imageset-logical geometry models
must not be treated as Workbench-native sizing algorithms.

This layout deliberately compares the following **different requests**:

| Case | Authored property | Required observation |
|---|---|---|
| TextFixed | no auto-size flags | widget screen rect and `GetTextSize` |
| TextToTextH / V / Both | `size to text h/v` | native widget rect vs native pixel text extent |
| TextToContentBoth | `size to content h/v` | does native widget size react differently? |
| TextLongNarrow | `size to text v` + `wrap` | wrapped or unwrapped native text size and resulting rect |
| ImageFixed | fixed image rect, vanilla `Expand` | rendered image widget geometry control |
| ImageContentBoth | `size to content h/v`, vanilla `Expand` | measured widget geometry; resource-specific cause still unknown |
| ImageContentWide | `size to content h/v`, vanilla `Gradient` | distinguish 20×20 and 75×5 imageset entries |
| FrameContentHeight | `size to content v` | direct child bottom extent vs actual parent height |
| PanelContentBoth | `size to content h/v` | two-axis parent content sizing |
| FrameContentHidden | `size to content v` + hidden far child | unknown native hidden-child inclusion policy |
| FrameFixedControl | ordinary fixed Frame with two nested children | native tree construction control |
| FrameContentUpper | uppercase `Size To Content V` on Frame | isolate property spelling/case vs unsupported class |
| WrapContentUpper | uppercase `Size To Content V` on WrapSpacer | independently test native managed container sizing |

The two built-in image samples are from DayZ's `dayz_gui` imageset. Their
recorded atlas entries (Expand=20×20 and Gradient=75×5) are **reference
metadata**, not proof of the actual native widget's content dimensions at
any client UI scale. If a resource fails to resolve in the game, preserve
that error rather than inventing a fallback size.

The test-only script records `GetScreenPos/GetScreenSize`,
`GetPos/GetSize`, `GetFlags`, `IsVisible`, and `TextWidget.GetTextSize`
for every reachable widget. v2 additionally checks direct `FindAnyWidget`
presence for nested children and immediate parent-child counts, to
distinguish missing construction from recursive traversal gaps. There is no equivalent safe image intrinsic getter in
this harness; it records image **widget bounds**, not image source pixels.
`GetTextSize` and the widget's rectangle are not interchangeable.

## Four independent in-game observation phases

1. **baseline-1120x460:** original authored text and root screen size.
2. **short-text-1120x460:** replace selected control texts with `X`.
3. **restored-1120x460:** restore original `TEST 0123456789` strings.
4. **baseline-720x460:** preserve original texts and resize the test root.

This controls for text mutations versus root constraints and checks that
sizing behavior is reproducible. The source layout also contains fixed
children, hidden descendants, and plain alignment controls.

The test mod deliberately does not modify production Canvas rendering or
change any native flags after creation. The **original v1** harness compiled
and ran; the revised v2 must be rebuilt and revalidated independently.
Passing Node/Vite CI cannot prove EnScript compilation.

## Passive shared sizing intent

`src/renderer/engine/ContentSizingRequests.ts` decodes authored
`size to text h/v` independently from `size to content h/v` for **any**
widget family. The decoder uses first-property-wins semantics; invalid
flag strings and mutually active flags on the same axis are preserved as
`invalid` or `ambiguous`. It does not assert native priority or trigger
the existing SDF/text or imageset intrinsic resolver.

`MeasureLayoutTree` now prepares `node.contentSizing` once, retaining
the original authored size-to-content behavior and opt-in gates. Tests
verify that size-to-text is **not** erroneously treated as native intrinsic
measurement and never automatically resizes a widget in the current engine.

## Log integrity and evidence gates

The parser in `scripts/extract-workbench-content.mjs` accepts complete
DayZ client logs or only the matching `[NIH_LayoutStudio][ContentProbe]`
records. It refuses malformed values, duplicate getters, missing capture phases,
missing text pixel sizes, missing **v2 fixture widgets (27)**, and
probe errors **by default**. With explicit `--allow-partial`, incomplete
yet internally consistent native captures can be preserved as
`incomplete-native-capture`, not a PASS. v1 and v2 are stored as
separately documented partial native records.

After successfully running the probe, from a local checkout:

```powershell
npm run extract:workbench-content -- "$env:LOCALAPPDATA\DayZ\script_YYYY-MM-DD_HH-MM-SS.log" native-content.json
```

The resulting JSON is **independent getter evidence**, NOT a native
sizing-parity comparison. It sets `nativeClientBuild:null` until the
actual client build is recorded explicitly and uses the status
`captured-unversioned-not-native-parity`. It must not infer a game build
from the DayZ Tools Addon Builder version.

No native reference case can be called PASS until the text/image
measurement model, any DPI scale, fallback behavior and content-sizing
eligibility have been independently compared with the observations.

See [runtime-mod/README.md](runtime-mod/README.md) for PowerShell
preparation, local packaging and capture instructions.

## v3 isolated native property comparison — prepared, not yet tested

The earlier two native datasets are frozen. A **third, separate** layout
`NIH_ContentProperty_Matrix.layout` and `NIH_PropertyMatrixRuntime.c`
are now included in the same disposable mod. Fourteen controlled
Frame/Panel/Wrap parent variants independently test whether a
`Size To Content` property set to **0** differs from the same property
set to **1**, with other controls for the sizing axis and a non-sizing
property. The separate `[NIH_LayoutStudio][PropertyProbe]` logger
captures each case immediately after widget creation, after an
`Update()`, and after a root resize.

The original four `[ContentProbe]` phases are retained, so the
existing complete/partial v2 extractor and native JSON are unaffected.
This third matrix is **source-verified only**, not compiled or observed
in DayZ. See [the protocol and evidence boundaries](PROPERTY-MATRIX.md).


## v3 property matrix — native evidence collected, 2026-10-28

The user ran the 14-case isolated property matrix in a DayZ client
with **all three phases complete**. Each Frame/Panel parent carrying
a tested `Size To Content` property had **zero native children** even
when the property was explicitly `0`; the no-property and
`clipchildren=1` controls kept their descendants. WrapSpacer
with `Size To Content V=0` also kept children at height 20, while
`V=1` kept both children and changed screen height to 28.

The result was already present at the **after-create** phase and
did not change after native Update or root resize. The actual
native C++ property parser remains unobserved; this is a native
widget-tree diagnostic, not a recovered parser implementation.

See [native property matrix results](2026-10-28-property-matrix-native-results.md),
[original getter log](capture.property-matrix.native.2026-10-28.log),
and [structured capture](capture.property-matrix.native.2026-10-28.json).
The new regression re-parses the native log, compares all 42 case
records, and preserves the missing children without inventing geometry.

## v4 native syntax isolation — test source prepared

An independent [12-resource parser experiment](PROPERTY-SYNTAX.md)
now probes unknown attribute names and attribute order **around**
the child block on Frame and Panel. It deliberately uses separate
`CreateWidgets` calls to avoid contaminating the previous native
14-case property matrix. The experiment subsequently **completed in DayZ**, and 24 native
getter observations are preserved separately. The earlier v1/v2 and
14-case property-matrix captures remain unchanged. Web CI checks
source-input integrity and replays the actual native log; it cannot
inspect DayZ's C++ loader internals.

## Verified native parser-order finding — 2026-10-28

The separate 12-case native syntax probe is complete:
`"Size To Content V" 0` and deliberately unknown
`"NIH_ProbeUnknown" 0` **before** the child block led
to zero child widgets on tested Frame/Panel parents.
The **same property after the block** preserved two children.
A known `clipchildren` attribute kept two children in either
position. All observations were stable after `Update`.

This is a **native parser compatibility / ordering effect**,
not evidence that content-sizing calculations should delete
children. See
[the controlled native results](2026-10-28-property-syntax-native-results.md).
No exact C++ parser recovery or full widget capability registry
is claimed.
