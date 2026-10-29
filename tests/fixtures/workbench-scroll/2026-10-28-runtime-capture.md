# ScrollWidget in-game client runtime capture — 2026-10-28

## Provenance and outcome

The user built `P:\Mods\@NIH_LayoutScrollProbe\addons\NIH_LayoutScrollProbe.pbo`
through DayZ Tools Addon Builder 1.0.240639 and launched the test mod in a
**DayZ client gameplay session**. The probe executed successfully and logged
all four phases; the filtered client log was supplied in the conversation
(`script_2026-10-28_11-56-52.log`, with probe records at approximately
11:57:32–11:57:47). No compile errors appear in the supplied filtered output.
The complete unfiltered log, DayZ client build identifier and runtime
screenshots were not supplied.

The independent observed values have been transcribed into
[`capture.runtime.2026-10-28.json`](capture.runtime.2026-10-28.json).
`tests/workbench-scroll-runtime.test.mjs` checks the native-derived arithmetic
against those observed runtime getters and screen-space child positions.
The test is deliberately separate from the numeric viewport comparator.

## Native observations

The authored layout has four ScrollWidget containers, each **240×180**, with
identical children: Origin at (0,0), 170×48, and Overhang at (185,150),
110×70. All four `GetContentWidth/Height` results were **295×220**.
All four `GetScrollbarWidth` results were **10**, even for ScrollNone, whose
`IsScrollbarVisible` returned false.

| Widget | Scrollbar settings | Initial (X,Y) | Half (X,Y) | End (X,Y) | Reset (X,Y) |
|---|---|---|---|---|---|
| ScrollNone | None | (0,0) | (0,0) | (0,0) | (0,0) |
| ScrollVertical | V | (0,0) | (0,20) | (0,40) | (0,0) |
| ScrollBoth | H + V | (0,0) | (32.5,25) | (65,50) | (0,0) |
| ScrollLeft | H + V + V Left | (0,0) | (32.5,25) | (65,50) | (0,0) |

The normalized native position getters returned exactly 0, 0.5, 1 and 0
on enabled axes for the four stages. The probe **requested** those values
through native setters; the results above were obtained from getters rather
than assumed from the requests.

The observed full offsets agree with the native-derived normalized-getter
denominators:

- H for H+V: `295 + 10 - 240 = 65`
- V for H+V: `220 + 10 - 180 = 50`
- V for vertical-only: `220 - 180 = 40`

Screen-space child readings independently demonstrate translation:

| Widget | Initial origin screen X,Y | Half | End | Reset |
|---|---|---|---|---|
| ScrollNone | (20,78) | (20,78) | (20,78) | (20,78) |
| ScrollVertical | (300,78) | (300,58) | (300,38) | (300,78) |
| ScrollBoth | (580,78) | (547.5,53) | (515,28) | (580,78) |
| ScrollLeft | (870,78) | (837.5,53) | (805,28) | (870,78) |

The `Overhang` screen positions follow the same offset subtraction, with
their authored local origin (185,150) added. Example: ScrollLeft Overhang
starts at (1055,228), moves to (1022.5,203), and reaches (990,178).
The measured left-bar +10 X origin adjustment holds at zero and nonzero
scroll offsets.

## Exact confidence boundaries

**Observed in running DayZ:** probe script initialization and execution,
effective scrollbar width, reported content extents, native absolute and
normalized scroll positions after setter calls, child screen-rectangle
translations, and reset.

**Supported by native disassembly and this runtime cross-check:** the
scroll-offset origin subtraction, the visible left-bar origin adjustment,
and the ScrollWidget normalized-getter denominators in this one fixture.

**Not established by this capture:**

- The actual native scrollbar scale-mode branch or internal context
  `+0xC4/+0xCC`. `GetScrollbarWidth()==10` does **not** select a branch.
- An independently measured child *viewport* rectangle, constraint
  context rectangle, or clipping/scissor rectangle. Widget `GetScreenPos`
  can include coordinates outside the visually clipped region.
- Whether scrollbars correctly render and clip at other DPI/UI scales,
  whether user wheel and drag inputs behave identically, or how the
  native setters clamp out-of-range arguments.
- Other widget families, managed nested contents, visibility filtering,
  mixed exact/relative child measurements, or production Canvas equivalence.

**Therefore:** `capture.template.json` retains all four `observed:null`
and `nativeScale:null`. The numeric comparator must remain at **4 PENDING**.
The new runtime regression tests verify only the independently observed
getters and screen-space motions; they do not turn a calculated viewport
candidate into a measured native viewport golden.

No production rendering, layout serialization, or ScrollWidget strategy
activation is authorized by these measurements. Broader Frame/Panel/Text/
Image/Button/Grid/Wrap measurement and Workbench parity remain priorities
for the unified engine.
