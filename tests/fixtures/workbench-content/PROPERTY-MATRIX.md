# Controlled native property matrix — Frame / Panel / Wrap

**Status:** Test fixture and client-side EnScript diagnostics prepared; **not yet packed or run in DayZ**. This is independent of the completed v1 and v2 native captures, which remain unchanged.

## Research question

In the v2 DayZ client capture, the native Frame and Panel objects
with `"Size To Content V" 1` existed, but each had zero children.
Native `FindAnyWidget` confirmed those descendants were absent.
A normal Frame retained both children, including one extending
outside its authored parent height. A WrapSpacer with the same
content-height request retained its children and grew from 20 to 28.

These observations do **not** identify the C++ loader's failure path.
Specifically, they cannot distinguish whether an unknown/unsupported
property changes **widget creation**, whether only an enabled `1`
is problematic, or whether a different class-specific measurement
policy is selected.

The new standalone `NIH_ContentProperty_Matrix.layout` isolates
these dimensions in **14 same-family parents**, each with two identical
Panel children (28 authored descendants). All parent rectangles start
at **190×20**; the children are 60×24 and 90×28, with the lower child
authored below the parent height to test overflow tolerance.

| Family | Matched variants | What the comparison isolates |
|---|---|---|
| Frame | no sizing flag, V=0, V=1 | Attribute presence versus active value |
| Frame | H=1 and H+V=1 | Axis-specific parsing/activation |
| Frame | `Size To Text V=1` | Different, possibly unsupported attribute on the same class |
| Frame | `clipchildren=1` | Recognized non-sizing parent property control |
| Panel | no flag, V=0, V=1, H=1 | Whether outcomes repeat for a different ordinary widget class |
| WrapSpacer | no flag, V=0, V=1 | Native managed-layout control with established content sizing |

Only each candidate property and the parent grid position differ
within a family. All descendant source properties are identical.
`tests/content-property-matrix.test.mjs` independently parses this
fixture and enforces the matched-property design. These are **not**
native results.

## Native measurement phases

After the existing v2 probe's four phases complete, the same
disposable `@NIH_ContentSizingProbe` mod creates the independent
matrix root. It logs with the **separate**
`[NIH_LayoutStudio][PropertyProbe]` prefix:

- `after-create`: immediately after `CreateWidgets`, before an
  explicit root `Update()`.
- `post-update`: after native `SetScreenSize(1120,720)` and `Update()`.
- `after-resize`: after changing the root to 1120×620.

For each of the 14 cases, the probe records whether the parent exists,
its immediate `GetChildren/GetSibling` count, independent
`FindAnyWidget` results for both children, the parent's native
`GetScreenSize`, and its authored `GetSize`. A missing parent is
reported explicitly instead of silently becoming a zero-sized widget.

The separate prefix means the original strict four-phase content
extractor is **unchanged** and will not accidentally treat these new
records as v2 widget observations.

To extract this evidence after an actual DayZ client run:

```powershell
npm run extract:workbench-property-matrix -- "$env:LOCALAPPDATA\DayZ\script_YYYY-MM-DD_HH-MM-SS.log" matrix-native.json
```

The strict parser requires all 14 case records in each of the three
phases, consistent BEGIN/END markers, root dimensions, and separate
native parent sizes. Missing/unknown/duplicated cases or malformed
values fail validation. It records a **diagnostic**, never a parity PASS.
See `tests/workbench-property-matrix-extractor.test.mjs`.

## Interpretation guardrails

- If V=0 and no-flag retain both children while V=1 does not,
  this implicates **enabling** the property on that native class.
- If mere V=0 also suppresses children, this implicates **presence
  or parsing of the property**, rather than an active sizing request.
- If `clipchildren=1` has children while another unsupported
  attribute does not, the difference is not caused by ordinary
  clipping or child bounds.
- If `after-create` has children and `post-update` loses them,
  inspect update-time behavior; if absent in both phases, the
  native **CreateWidgets/initial hierarchy** path is implicated.
  These getter snapshots do not independently expose C++ parser internals.
- Wrap must be interpreted as a separate widget-family policy;
  never apply its observed height formula to Frame or Panel automatically.

Do not declare all Frame/Panel widgets inherently unsupported; do not
delete authored children from Layout Studio and do not alter Canvas
geometry or serialization based solely on this diagnostic.

## Run

In PowerShell 5.1 from the GitHub checkout, after pulling the current
branch, run the existing guarded staging script with `-Overwrite`
and pack the same **test-only** PBO using DayZ Addon Builder:

```powershell
git pull --ff-only
.\tests\fixtures\workbench-content\runtime-mod\Prepare-ContentProbe.ps1 -Overwrite

$builder = "D:\SteamLibrary\steamapps\common\DayZ Tools\Bin\AddonBuilder\AddonBuilder.exe"
$source = "P:\NIH_ContentSizingProbe"
$output = "P:\Mods\@NIH_ContentSizingProbe\addons"
& $builder $source $output "-prefix=NIH_ContentSizingProbe" "-packonly"
```

The staging script now copies both `.layout` files and both EnScript
files. Leave previous v2 source and native evidence untouched.
The v3 additions have **not been EnScript-compiled in DayZ**, so retain
any compile or resource error in the complete client script log.
No production code uses this matrix.

## Native result, 2026-10-28 — property PRESENCE matters

The completed DayZ client matrix captured **14 native parents**
immediately after creation, after an update and after root resize.
The **presence** of `Size To Content V` on ordinary Frame/Panel
correlated with **zero native descendants even when explicitly set
to 0**. Similar no-child outcomes appeared for H=1 and Frame's
`Size To Text V=1`. Ordinary Frame with no flag or `clipchildren=1`
and Panel with no flag retained both children.

WrapSpacer with no flag or V=0 retained two children at authored
height 20; V=1 retained two and measured native height **28**.
This distinction occurred *immediately after CreateWidgets*,
not during subsequent layout updates.

Read [the actual native findings](2026-10-28-property-matrix-native-results.md).
Native C++ parser token handling is still unproven; do not turn
a parse-time correlation into a universal child-deletion policy.
