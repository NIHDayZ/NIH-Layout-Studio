# Right-aligned Wrap child ordering — HUD parity follow-up

**Date:** 2026-10-30  
**Branch:** `research/native-wrap-right-order`, based on `research/native-wrap-hud-parity` at `05c736a3`.

## User observation and cause

The opt-in fixed Wrap experiment successfully distributed the nine `day_z_hud.layout` BadgesPanel icons. The user then observed **the order is reversed compared with Workbench**. The experimental implementation had treated `content_halign right` as a CSS-like right-aligned *left-to-right* row: it offset the line but left the source children in forward horizontal order.

In the supplied Workbench comparison, a right-aligned badge line instead places the first source child nearest the right edge and each successive child to its left. The original native disassembly notes identify `horizontalAlign=1` as far-edge placement, but do not by themselves prove this ordering rule across every native Wrap combination. This is a **visually observed candidate**, not a recovered universal native formula.

## Narrow fix

`PlanFixedWrapPreview` now mirrors X coordinates **within each measured line** when `horizontalAlign===1`; it does not reverse `children`, reorder the source AST, modify React keys, alter Y positions or shift the overall occupied content envelope. The parent right inset, per-line width, gaps, and line membership remain unchanged. Other alignment modes continue to call the existing unmodified planner. In particular, the shared `PlanFixedWrap` and `ArrangeMeasuredGeometry` snapshots keep their old semantics.

The existing opt-in URL switch `experimentalNativeWrapLayout=1` and exact-size eligibility rules remain unchanged. No default rendering or PR #47 code changed.

## Regression tests

- The original nine-badge test now expects child 0 against the right edge, with each successor immediately left of the previous child; total row envelope and center Y are unchanged.
- New two-line Wrap test with asymmetric item widths and a nonzero gap confirms correct ordering separately within each row.
- New start/center preservation and named/numeric right mode equivalence test.
- New test confirms the original shared planner's output is unaffected.

## Verify locally

```powershell
git fetch origin
git switch research/native-wrap-right-order
git pull --ff-only

npm run test:geometry-engine
npm run test:layout-corpus -- "C:\Temp\NIH-Layout-Corpus" --expect-files=333
npm run typecheck
npm run build
npm run dev
```

Visit `http://localhost:5173/?experimentalNativeWrapLayout=1` and reload `day_z_hud.layout` at 1920×1080 and 46%. Compare Workbench and Studio **icon identity and left-to-right order**, not just the line envelope. Keep this opt-in until other right-aligned Wrap rows, multiline and mixed hidden/relative cases are checked independently.
