# Opt-in live WrapSpacer test — vanilla DayZ HUD badges

The live Canvas currently preserves authored child rectangles under WrapSpacer, including identical positions for six `BadgesPanel` children. Native Workbench instead arranges the nine visible child icons across a horizontal row.

This research-only branch integrates the **existing native-derived `PlanFixedWrap`** into the Canvas through `PlanFixedWrapPreview`, gated by `?experimentalNativeWrapLayout=1`. The preview wrapper handles the observed named horizontal/vertical alignment values (`right`, `center`) and vertically centers an already measured fixed-size line block. The existing `PlanFixedWrap` behavior and default Canvas rendering remain unchanged.

The candidate applies only to fixed-height/width WrapSpacer parents with all-visible, exact-size, non-content-sized children. Unsupported parent/child configurations fall back to authored coordinates. No widget-name or HUD-ID-specific branches are introduced.

Real `day_z_hud.layout` source dimensions: `BadgesPanel` 364.349 x 79; 9 widths total 332 (35, 35, 52, then 6 x 35); Padding 0, Margin 0, right/end horizontal alignment and vertical center. Candidate: one row, first X = 32.349, Y = 20.5, no overlap. These numbers are fixture expectations, **not** native C++ implementation proof.

## Validate

```powershell
git fetch origin
git switch research/native-wrap-hud-parity
git pull --ff-only
npm run test:geometry-engine
npm run test:layout-corpus -- "C:\Temp\NIH-Layout-Corpus" --expect-files=333
npm run typecheck
npm run build
npm run dev
```

Load the same vanilla HUD under:
- `http://localhost:5173/` (existing default, overlapping icons)
- `http://localhost:5173/?experimentalNativeWrapLayout=1` (candidate row layout)

At 1920×1080, 46%, check the status row against Workbench. Avoid promoting this switch based solely on one layout: additional WrapSpacer, hidden-child, multi-row and responsive examples remain unverified. Avoid global geometry or font changes to compensate.

Separately, `loading.layout` displays a central background texture thumbnail because its ImageBackground is relative 0.16×0.09 with a mask, transition and `fixaspect outside`; the current renderer does not implement full native image/mask/transition semantics. Its disclaimer strings and styled background also differ from Workbench. The loading screen is a second acceptance track and cannot be corrected by this Wrap experiment.

No code in PR #47 was modified.
