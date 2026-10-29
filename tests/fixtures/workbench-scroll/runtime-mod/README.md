# In-game ScrollWidget observation probe (test-only)

This folder supplies an **optional, disposable DayZ client test mod**. It exists
because Workbench's Layout Editor preview cannot meaningfully exercise the
scrollbar wheel/drag interactions seen in a running DayZ UI. It is **not** part
of NIH Layout Studio's web build, and it must not be shipped on a production
server or silently injected into an ordinary mod.

## Assemble on the Windows workdrive

Run `Prepare-ScrollProbe.ps1` from Windows PowerShell 5.1 to create
`P:\NIH_LayoutScrollProbe` without manually copying the files. It refuses
to overwrite any existing target file unless you explicitly supply
`-Overwrite`. Alternatively, copy the files manually:

| Destination | Source in this repository |
|---|---|
| `P:\NIH_LayoutScrollProbe\config.cpp` | `runtime-mod/config.cpp` |
| `P:\NIH_LayoutScrollProbe\Scripts\5_Mission\NIH_ScrollParityRuntime.c` | `runtime-mod/NIH_ScrollParityRuntime.c` |
| `P:\NIH_LayoutScrollProbe\gui\layouts\NIH_Scroll_Parity.layout` | `../NIH_Scroll_Parity.layout` |

Pack as a normal client-loaded DayZ test mod using PBO prefix
`NIH_LayoutScrollProbe`. Load `@NIH_LayoutScrollProbe` in a **local,
disposable** DayZ client test session. The mod adds a `modded MissionGameplay`
hook solely to create the four-widget fixture. Do not include this test
mod in your regular mod set.

The fixture is deliberately copied from the **same source** used for the
Workbench screenshots, rather than creating a second, independently edited
layout. If Workbench round-trips the file, preserve the original fixture for
comparisons.

## What it measures

The probe uses native script methods exposed by
`scripts/1_Core/proto/EnWidgets.c`. For each named ScrollWidget it logs:

- Authored-local position, actual screen rectangle, scrollbar width,
  scrollbar visibility, native content width/height.
- Horizontal and vertical absolute and normalized scroll getter results.
- Actual screen rectangles of the `ORIGIN` and `OVERHANG` children.

It first captures the initial state, then uses `HScrollToPos01` and
`VScrollToPos01` on enabled axes to request 0.5 and 1.0 normalized
positions, and finally returns to zero. The new native getter values and
screen rectangles are recorded after each stage. These are **observations**;
the probe makes no assumptions about the actual native offset clamping,
bar thickness, or clip behavior. `ScrollNone` is never programmatically
scrolled, and the single `IsScrollbarVisible()` result must not be
interpreted as separate H/V visibility flags.

Find output labeled `[NIH_LayoutStudio][ScrollProbe]` in the client logs.
A before/after screenshot or video from the **running game**, ideally
including the visible scrollbar positions and any clipped child regions,
can complement the numeric log. This is distinct from the earlier
Workbench editor view.

### Important provenance boundaries

1. The runtime getter `GetScrollbarWidth()` returns an effective native
   width, **not** the native `+0xC4/+0xCC` context pair or proof of which
   scaling branch was used. Do not label it `nativeScale: {mode: "unscaled"}`
   merely because it equals 10, or derive the context from editor zoom.
2. `GetScreenPos/GetScreenSize` are screen-space observations and may not
   equal local child viewport/context coordinates. Do not directly copy them
   into `capture.template.json.observed.childViewport` or
   `observed.childContext` and claim parity.
3. Normalized scroll setters may clamp. Always use the **getter results**
   as observed state instead of assuming the requested 0.5/1.0 were applied.
4. Visibility/clipping in a screenshot does not establish the engine's exact
   scissor rectangle. Record it as visual evidence unless measured by
   independent native instrumentation.
5. The source is intentionally not compiled by Node/Vite CI. The user has
   independently confirmed that it compiled and executed in a DayZ gameplay
   session on 2026-10-28. See
   [the runtime capture](../2026-10-28-runtime-capture.md). Future changes
   still require DayZ compilation; web CI does not guarantee this.

## Numeric comparator scale contract

The comparator now distinguishes three cases per fixture:

- `nativeScale: null` (or omitted): the 10-unit prediction is an
  **unverified hypothesis**; the case stays `PENDING` even if numeric
  observations are supplied.
- `nativeScale: {"mode":"unscaled"}`: use the native unscaled 10-unit
  branch **only** after separate evidence establishes that branch.
- `nativeScale: {"mode":"context-scaled","numerator":125,"denominator":100}`:
  use the native arithmetic on **captured**, signed-int32 `+0xC4` and
  unsigned-int32 `+0xCC` values. These numbers are illustrative, **not**
  actual DayZ observations.

For cases that may count as numeric `PASS`, `provenance` also requires
`captureMethod`, `workbenchBuild`, `evidenceFile`,
`scaleBranchSource`, and `offsetSource`. These are human-supplied
source descriptions; the comparator cannot independently authenticate files,
build identifiers, or captured inputs. `captureMethod: "synthetic"` is
still explicitly excluded from native pass totals.

The original four native viewport comparator cases remain `PENDING`
despite the successful runtime getter capture. Screen-space child positions
and effective scrollbar width do not prove native clip rectangles or the
scale-context branch.

## Scope after this experiment

The Scroll-specific test is one targeted native investigation within the
shared engine. Native-verified geometry/measurement across Frame, Panel,
Text, Image, Button, Grid and Wrap remains the main requirement before
moving the read-only engine into the production Canvas.
