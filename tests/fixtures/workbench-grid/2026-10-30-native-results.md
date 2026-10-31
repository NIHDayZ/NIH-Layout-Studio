# First independent native GridSizer capture — 2026-10-30

The user ran the disposable DayZ client probe successfully. Native `GetScreenSize` showed 33 widgets per phase, eight grid containers and 24 child panels, plus root. The capture preserves eight per-case container sizes and all first-phase child screen rectangles in `capture.native.2026-10-30.json`.

Root reported 1920×1080 at creation, and 1120×720 after explicit resize; non-root rectangles were identical in all three observations. This does not establish Workbench's separate DPI/zoom behavior.

- `Size To Content H`: observed 71 instead of authored 240; `V`: observed 51 instead of authored 100.
- Both: 71×51. The current diagnostic fixed-child envelope produces 70×50: one unit lower on each axis. The origin of this offset (inclusive bounds, rounding, or elsewhere) is **not proven**.
- Hidden child with default filtering: 81×33; with `Ignore invisible=0`: 71×51. Native does not drop the hidden child from the widget tree.
- Relative child: parent 145.5×63, child second slot 94.5×27; demonstrates a dependency not solved by the conservative candidate.
- 1-column/3-row count variant: 48×64.

The new regression suite protects the discrepancy rather than changing native sizing code on the basis of a single fixture. This is DayZ **client native-getter** evidence; Workbench-specific parity is still not claimed. See the test source for comparisons and the named matrix fixture for authored properties.
