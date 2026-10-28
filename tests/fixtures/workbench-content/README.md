# Native text / image / content-size investigation

**Status:** Source fixture, passive authored sizing decoder, log parser and
regressions are implemented. The **new DayZ probe is not compiled or tested
in-game**. No native measurements from this fixture exist yet.

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

The two built-in image samples are from DayZ's `dayz_gui` imageset. Their
recorded atlas entries (Expand=20×20 and Gradient=75×5) are **reference
metadata**, not proof of the actual native widget's content dimensions at
any client UI scale. If a resource fails to resolve in the game, preserve
that error rather than inventing a fallback size.

The test-only script records `GetScreenPos/GetScreenSize`,
`GetPos/GetSize`, `GetFlags`, `IsVisible`, and `TextWidget.GetTextSize`
for every widget. There is no equivalent safe image intrinsic getter in
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
change any native flags after creation. Its EnScript compilation and runtime
execution must be validated separately; passing Node/Vite CI cannot prove
the test mod is loadable in DayZ.

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
records. It refuses malformed values, duplicate getters, missing capture
phases, missing text pixel sizes, missing widgets, and probe errors.

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
