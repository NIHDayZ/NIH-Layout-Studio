# PR #47 — Windows / Workbench final acceptance

**Status:** Manual acceptance is **PENDING**. Automated CI and Chromium tests
cannot prove a real DayZ Workbench rendering match. This checklist is
intentionally short and non-destructive; do not merge PR #47 until the
actual local review is satisfactory.

## 1. Prepare the checked-out project

Use **PowerShell 5.1** from the local repository. The source remains
under its existing checkout (for example `Z:\GitHub\NIH-Layout-Studio`).
Do not copy the application into a new workspace or rebuild any game PBO.

```powershell
Set-Location 'Z:\GitHub\NIH-Layout-Studio'
git switch feature/unified-layout-engine
git pull --ff-only

# Only if node_modules is missing or out of sync with package-lock.json:
npm ci

.\scripts\Prepare-Pr47Acceptance.ps1 -RunChecks
```

The helper checks the exact branch, records commit SHA, Node/npm and
Windows versions, hashes the six shipped acceptance fixtures, optionally
runs **typecheck, geometry-engine tests, and production build**, and
writes an `manifest.json` and `local-acceptance.md` under
`%TEMP%\NIH-Layout-Studio-PR47-Acceptance\<timestamp>\`.

It does **not** modify source layouts, install tools, start DayZ,
build PBOs, save screenshots, or mark manual checks as PASS. Use
`-RunChecks` to execute the existing npm checks; without that
switch it records provenance only. If you have real `.layout`
samples ready, you can include their **checksums only**:

```powershell
.\scripts\Prepare-Pr47Acceptance.ps1 -RunChecks -RealLayouts @(
    'P:\YourMod\gui\layouts\RepresentativeHUD.layout',
    'P:\YourMod\gui\layouts\RepresentativeInventory.layout'
)
```

The two paths above are **examples**; replace them with actual files.
The helper never copies their contents into the evidence bundle.
If local dependencies are missing, explicitly run `npm ci` first.

## 2. Open NIH Layout Studio

In a **second** PowerShell window:

```powershell
Set-Location 'Z:\GitHub\NIH-Layout-Studio'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://127.0.0.1:5173/` in a Chromium-based desktop browser.
Use **Upload** to load a fixture, or the existing Source/project
workflow for actual project assets. Do not assume uploading only
the `.layout` file resolves external imagesets/fonts.

Record the browser zoom, Studio preview viewport/root resolution and
display scaling before comparing with Workbench. **Both views need the
same intended root dimensions** to make placement differences useful;
Workbench's zoom percentage is not itself a DPI or pixel-coordinate
measurement.

## 3. Short acceptance matrix

Work through the generated `local-acceptance.md`; use **PASS**, **FAIL**
or **PENDING**, with at least one screenshot pair for a discrepancy.

| Gate | Local case | Acceptance criterion |
|---|---|---|
| Common geometry | `tests/fixtures/workbench-common/NIH_Common_Geometry_Parity.layout` | Anchoring, relative/exact geometry, nested visibility consistent with existing Workbench evidence at the recorded root size |
| Static scroll | `tests/fixtures/workbench-scroll/NIH_Scroll_Parity.layout` | Scrollbar side, visible clipping/overhang and fixed positions agree where evidence exists; do not infer interactive-scroll parity |
| Native warning | `tests/fixtures/workbench-content/syntax-matrix/FrameContentBefore0.layout` | PROBLEMS shows the child-loss risk; Cancel does not export; Continue exports unchanged source |
| Safe control | `FrameBase.layout` and `FrameContentAfter0.layout` in the same syntax-matrix folder | No false native warning; direct Export As retains source bytes and after-child property order |
| Real layout | One HUD and one image/font-heavy layout from the actual project | Visible text, bitmap/SDF fonts, imagesets, widget styles, and nested geometry remain usable; edit/undo/redo/save/reload |
| Source safety | Export an **unchanged** real file and compare SHA-256 hashes | Original source and downloaded export hashes match |

The previously completed native Scroll runtime probe and static
Workbench screenshots already establish **limited** observations.
The Workbench Layout Editor did **not** provide reliable interactive
scrolling during that capture. Do **not** repeat an impossible scroll
interaction or treat a static screenshot as evidence of scrolling
behavior.

The native **content-sizing** fixture intentionally contains
unsupported-looking Frame/Panel properties which were shown to prevent
their children from loading in the DayZ test context. Do not treat
those missing native children as an ordinary Studio renderer bug;
refer to the isolated syntax-matrix controls first.

## 4. Capture evidence without changing the project

When a difference is visible, record:

- The **exact `.layout` filename and widget**, and whether external
  assets were loaded in the Studio project.
- The **root viewport, Workbench zoom, display scaling**, and any
  explicit DPI/widget Scaled flags.
- Paired Studio and Workbench **full-context screenshots** at the
  same intended root size, plus one focused screenshot for glyphs
  or clipping if it helps.
- The expected native observation versus actual Studio behavior.
  Include the relevant source lines only if needed; do not upload
  private full project data unnecessarily.

For an unchanged file export, compare hashes in PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'P:\Original.layout'
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Path\To\Exported.layout'
```

Only identical bytes yield identical hashes; a canonical *structural*
edit can still reformat comments/whitespace even when child group
order is preserved.

## 5. Completion decision

The acceptance bundle remains **PENDING** until reviewed. If all
mandatory rows are PASS and there are no unresolved critical visual
or source-fidelity regressions, PR #47 can be considered for a
reviewed squash merge. If any test fails, record the exact
discrepancy and fix the shared mechanism or compatibility assumption
based on the evidence—**not** a widget-specific visual workaround.

This process does not certify all DayZ widget classes, ScrollWidget
runtime clipping, the Workbench C++ parser, or every DPI/font case.
See [the consolidation audit](pr47-consolidation-audit.md) for the
remaining scope and known risks.
