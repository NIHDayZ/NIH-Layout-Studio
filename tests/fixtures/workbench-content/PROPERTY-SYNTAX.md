# Native loader syntax isolation — 12 separate DayZ resources

**Status:** The isolated syntax probe **compiled and ran in DayZ on 2026-10-28**. All 12 independent resources loaded and all 24 native creation/update observations were captured. The previous v1/v2 and 14-case native property matrix data remain preserved separately. See [native findings](2026-10-28-property-syntax-native-results.md).

## Why isolate the resources?

The prior native matrix independently established that an ordinary
Frame or Panel **lost its two children even when `Size To Content V`
was explicitly `0`**, while no-property controls retained them.
The difference existed immediately after `CreateWidgets`. WrapSpacer
with the same property retained its children and changed height only
when it was enabled.

Those measurements support a **native loader/parse-time property
compatibility difference**, but they do not tell us whether an
unrecognized property confuses the parser's child-block boundary,
whether the sizing property has special handling, or which C++
parser operation is involved.

The new `syntax-matrix/` directory contains 12 separately loadable
`.layout` resources rather than combining unrecognized properties
into one tree. If one resource cannot be created or parses partially,
the other eleven remain independent.

## Controlled cases

Every resource has the same root, one class-specific parent with
authored `size 190 20`, and two nested Panel children with identical
authored sizes and offsets: 60×24 at (4,6), 90×28 at (10,45).
Identifiers differ by resource for reliable `FindAnyWidget` checks.

| Case family | Cases | Isolated difference |
|---|---|---|
| Frame | `FrameBase` | No extra attribute |
| Frame | `FrameContentBefore0`, `FrameContentAfter0` | `"Size To Content V" 0` before versus after the child block |
| Frame | `FrameUnknownBefore0`, `FrameUnknownAfter0` | Deliberately unrecognized `"NIH_ProbeUnknown" 0` before versus after the child block |
| Frame | `FrameClipBefore1`, `FrameClipAfter1` | Recognized `clipchildren 1` before versus after the child block |
| Panel | `PanelBase` | No extra attribute |
| Panel | `PanelContentBefore0`, `PanelContentAfter0` | `"Size To Content V" 0` before versus after |
| Panel | `PanelUnknownBefore0`, `PanelUnknownAfter0` | Deliberately unknown property before versus after |

The **property-after-child-block** cases may not be valid native
syntax. They are forensic inputs only, not recommended production
layouts. A resource that does not load must be recorded as missing,
not silently treated as a zero-sized widget. Each independent file
contains a single potentially invalid construct so it cannot
consume other cases' source data.

The original 14-case matrix remains the stronger native evidence
for ordinary property presence/values. The new experiment tests
**property identity and order**, which that earlier matrix could
not isolate.

## DayZ capture and integrity

The third probe is `NIH_PropertySyntaxRuntime.c`, compiled into the
existing disposable `@NIH_ContentSizingProbe` test PBO. It runs
**after** the previous content and property probes finish. Its
separate prefix is `[NIH_LayoutStudio][SyntaxProbe]`.

For each of 12 resources, it logs both `after-create` and
`post-update` states:

- `CreateWidgets` returned a root versus `null`.
- `FindAnyWidget` found the expected parent and each direct child.
- Native immediate `GetChildren/GetSibling` child count.
- `GetScreenSize` and `GetSize` **only when a parent exists**.

The strict `scripts/extract-workbench-property-syntax.mjs` parser
requires one BEGIN/END pair and all 24 case-phase observations,
in the expected order. A missing resource or parent is valid
evidence, provided it is explicitly logged; inconsistent, duplicate,
missing or malformed getter records fail validation. A completed
record is still **native diagnostic evidence, not proof of an exact
C++ parser algorithm**. The tests in
`tests/content-property-syntax.test.mjs` check the independent
layout variants, and reject incomplete log examples.

## Interpretation boundaries

- If unknown-property-before causes the same native descendant loss
  as content-property-before, that supports a **generic unsupported
  attribute parsing** hypothesis, not necessarily a sizing rule.
- If content-before behaves differently from unknown-before, then
  native handling is more property-specific.
- If an after-child attribute preserves earlier children but is
  otherwise ignored/rejected, that supports **order sensitivity**,
  not proof of precisely how the parser loops or skips tokens.
- If a whole resource fails to load, compare the isolated control
  first and do not attribute a missing root to the sizing engine.
- If `clipchildren` after the block fails as well, the issue could
  be **general grammar ordering**, not just unknown properties.

In all cases, preserve authored child trees and property text in
NIH Layout Studio. Do not introduce destructive child removal,
automatic stripping of unknown attributes, or speculative Canvas
sizing updates.

## Local run (Windows PowerShell 5.1)

From `Z:\GitHub\NIH-Layout-Studio` on
`feature/unified-layout-engine`:

```powershell
git pull --ff-only
.\tests\fixtures\workbench-content\runtime-mod\Prepare-ContentProbe.ps1 -Overwrite

$builder = "D:\SteamLibrary\steamapps\common\DayZ Tools\Bin\AddonBuilder\AddonBuilder.exe"
$source = "P:\NIH_ContentSizingProbe"
$output = "P:\Mods\@NIH_ContentSizingProbe\addons"

& $builder $source $output "-prefix=NIH_ContentSizingProbe" "-packonly"
```

The preparation script copies the existing two layouts/two EnScript
files, plus the new third client EnScript and 12 isolated
`syntax-matrix/*.layout` files, and never touches production mods.

Launch the rebuilt disposable mod in your local test client/server,
enter gameplay, and collect the **complete** latest client
`script_*.log` (including any native resource errors).
The syntax probe runs at the end and prints its BEGIN/END pair.
Do not load the former Scroll or CommonGeometry disposable probes
alongside it.

After a successful run, the source log can be validated with:

```powershell
npm run extract:workbench-property-syntax -- $latest.FullName syntax-native.json
```

The completed run loaded every independent resource without a reported
syntax-probe error. For future test modifications, retain client error
logs rather than inferring results for unexecuted cases. GitHub CI
validates the source fixtures and extractor; native execution evidence
is recorded separately.

## Actual native results — 2026-10-28

**Completed in DayZ.** All twelve independent files returned a root
and parent, and all 24 creation/update getter cases were captured.

A Frame or Panel with either `"Size To Content V" 0` or an
arbitrary `"NIH_ProbeUnknown" 0` **before** its child block
constructed **0 of 2** children. With that same attribute
**after** the child block, **2 of 2** children were present.
A Frame with known `clipchildren 1` retained **2 of 2**
children in either order. All results were already observable
immediately after `CreateWidgets` and stayed unchanged after
`Update`. Every parent remained 190×20.

This supports a **generic native loader unknown-property / child-block
parse-order mechanism** for these Frame/Panel fixtures—not an
intrinsic sizing algorithm. The exact C++ skip/stop logic is not
directly visible. Do not move unsupported properties after
children as a production workaround without determining export
syntax compatibility and side effects.

See [native syntax findings](2026-10-28-property-syntax-native-results.md),
[original filtered native log](capture.property-syntax.native.2026-10-28.log),
and [structured capture](capture.property-syntax.native.2026-10-28.json).
New regressions reconstruct all 24 observations independently.
