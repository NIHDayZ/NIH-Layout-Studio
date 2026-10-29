# Native ImageWidget UV validation — October 29, 2026

## Validated Windows baseline

- Branch: `research/native-image-pixel-parity`
- Commit: `48f88cc39c36172856ad342b6eed2f10a2084df8`
- Source of validation: user-provided PowerShell transcript `Pasted text(20261029-181021).txt`, retained in conversation, not committed
- Test platform: Windows / PowerShell, NIH Layout Studio v0.37.0
- Fast-forward: `7d35ddb` → `48f88cc` using `git pull --ff-only`

| Validation | Observed result |
| --- | --- |
| `npm run test:geometry-engine` | **267/267 PASS**, 0 failed, skipped, cancelled, todo |
| `npm run test:native-image-uv` | **11/11 PASS**, 0 failed, skipped, cancelled, todo |
| `npm run typecheck` | PASS, `tsc -b --pretty false` |
| `npm run build` | PASS, Vite 7.3.7; 70 transformed modules |

**Total selected automated tests: 278 pass, 0 fail**. This is validation of the selected suite, not an exhaustive repository-wide test claim.

## Paired Workbench/Studio visual result

The earlier October 29 PNG pair (retained in the conversation, referenced via SHA-256 in `tests/fixtures/native-image-visual/capture.visual.2026-10-29.json`) displays the same resolved DayZ logo in four cases:

- `UV_None`: orientation matches
- `UV_FlipU`: horizontal mirror matches
- `UV_FlipV`: vertical mirror matches
- `UV_FlipUV`: combined mirror matches

Both editor preview settings reported **1280×720**; Studio zoom **79%**, Workbench **80%**. White silhouette diagnostic overlaps were 0.931 / 0.926 / 0.938 / 0.942, after approximate scale normalization (final comparison included a one-pixel shift). Different zoom, alpha, background and rasterization make strict pixel equality **unproven**.

## Scope and disposition

**Close the four-state axis-aligned ImageWidget U/V visual orientation gate.** The existing shared UV calculation and live image transforms are supported by static Workbench native analysis, regression tests and paired editor screenshots. No production Canvas edit is indicated by this evidence.

Do **not** close exact pixel/alpha/filtering parity, alternate native source-rect/draw modes, clipping/scissor, managed containers or font painting. PR #47 remains draft; branch geometry and U/V orientation evidence should be preserved as independent gated results.

Next research should compare actual native **visible pixels** for `clipchildren` on and off, including Frame/Panel and nested hierarchies. The authored `InspectAuthoredVisibility` diagnostic calculates candidate intersections only; it does **not** prove the engine uses that exact render scissor or all paint paths obey it.
