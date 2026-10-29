# Local validation follow-up — native clipping fixture (October 29, 2026)

The user supplied a PowerShell terminal transcript `Pasted text(20261029-182752).txt`, retained with the conversation. The checked-out branch fast-forwarded from `d60631d` to `80846fadf7c8627238a5266a18acd5959317b829`, including the independent visual evidence record and its additional regression test.

`npm run test:geometry-engine` completed with **272 tests passed**, **zero failed**, **zero cancelled**, **zero skipped**, **zero todo**. The new test `October 29 paired clipping screenshot observations match all six cases without asserting native scissor` passed.

The supplied transcript **only** reruns geometry-engine after this last commit. The UV suite (11 passed), typecheck and Vite production build were already verified on the predecessor commit `d60631d`; do not incorrectly attribute fresh build/UV results to `80846fad`.

**Disposition:** verified frozen screenshot evidence tests and six-case native/Studio Frame and Panel visual clipping observations. Exact raster/scissor internals, alternative image draw modes, managed Scroll clipping and fonts remain separate. No production Canvas changes required. PR #47 stays draft.

## Next: font resource route comparison

The documented vanilla `day_z_hud.layout` test established that affected ActionListItem text references `gui/fonts/sdf_MetronBook72` but took the **CSS fallback route** because `resolvedSdf` and `resolvedBitmap` were null. `FitUnresolvedCssFontSize` prevents gross glyph clipping in the CSS fallback, but it is *not* native FNT5 parity. The repository has an opt-in `?experimentalStandaloneFnt5=1` resolver for FNT5 without FSDF; compare default and experimental modes on a controlled cross-font fixture before promoting it. Keep actual Workbench text and Studio route logs separate from inferred glyph metrics.
