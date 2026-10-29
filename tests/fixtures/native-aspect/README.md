# Native `fixaspect` parity gate — Run 09 integration

**Purpose:** Compare NIH Layout Studio's shared geometry engine with an independent DayZ Workbench or runtime native observation for the common `fixaspect` property. This is a cross-family layout test, **not** an ImageWidget texture fit test.

## Reproducible fixture

`NIH_NativeAspect_Parity.layout` is a self-contained layout text fixture. Use a **960 × 500 logical root widget** (and record the actual root rectangle, zoom, DPI/UI scale, and application/build when capturing native results). Its four 420 × 160 exact-size parents sit in a 2 × 2 arrangement. Each descendant has authored relative size `0.4 0.2`, relative offset `0.05 0.1`, and a different native aspect mode. The fixture uses Panel, Text, Image, Button, and Frame widget families.

The ImageWidget deliberately does **not** specify a texture; this fixture compares its widget rectangle, not image pixels. Workbench may show only its selection outline. If a resource is missing, don't infer geometry from an absent image or style.

### Studio predicted rectangles (independently matched for these native client cases)

All values are root-local `x, y, width, height` in logical pixels. The prediction assumes the root is exactly **960 × 500** and scale=1. If Workbench reports a different actual root rectangle, use that observed rectangle when comparing—do not force native values to match this table.

| Widget | Mode | Expected rect |
| --- | ---: | --- |
| `Parent_Mode0` | n/a | `24, 24, 420, 160` |
| `Parent_Mode1` | n/a | `500, 24, 420, 160` |
| `Parent_Mode2` | n/a | `24, 264, 420, 160` |
| `Parent_Mode3` | n/a | `500, 264, 420, 160` |
| `Fill_Mode0` | 0 | `45, 40, 168, 32` |
| `Text_Mode1` | 1 | `521, 40, 64, 32` |
| `Image_Mode2` | 2 | `45, 280, 320, 160` |
| `Button_Mode3` | 3 | `521, 280, 420, 210` |
| `ExactWidthBypass` | 3, width exact | `32, 118, 200, 32` |

The mode-3 Button deliberately extends **66 logical pixels below its parent's 160-pixel height**. This is intended: distinguish geometry from visual clipping. Do not compare clipped pixels to `GetScreenSize` as if they were the same measurement.

### Workbench vs Studio procedure

1. Check out `research/native-visual-parity-gate`, open this exact `.layout` in **Workbench**, and open the same fixture in **NIH Layout Studio** running locally (see repo README for dev-server command).
2. Use matching logical canvas/root dimensions, ideally 960×500. Record Workbench zoom percentage, Studio zoom, OS display scaling, application version, and the actual root screen rectangle. **Workbench zoom percentage is not itself the logical root size.**
3. Inspect/select `Fill_Mode0`, `Text_Mode1`, `Image_Mode2`, `Button_Mode3`, and `ExactWidthBypass`. Record native X/Y/W/H from the Workbench inspector or independent DayZ `GetScreenPos/GetScreenSize`; take screenshots showing the entire canvas and selected widget. Keep native observations separate from the predictions above.
4. For a native runtime getter capture, use the dedicated disposable [AspectProbe](runtime-mod/README.md). Its structure reuses the previously working common-probe native getters but has a separate mod prefix. Do not overwrite the established common-geometry PBO or run both MissionGameplay probes simultaneously. The AspectProbe's EnScript still requires its first actual DayZ build/run validation.
5. Compare each observed native rectangle against the Studio-predicted rectangle after accounting for the **actual recorded parent/root screen geometry**. A screenshot alone at unequal zoom is weaker evidence than the native X/Y/W/H getters.
6. Separately, inspect ImageWidget `flip u` and `flip v` using a **known, resolved asymmetric texture/image-set** in both tools. Test none, U, V, both; compare image pixels without flipping the debug overlay. This geometry-only fixture cannot establish UV parity without a real texture source.

## Automated preflight

```powershell
npm run test:geometry-engine
npm run test:native-image-uv
```

The existing generic Workbench-native rectangle comparator also accepts this fixture as an explicit second argument. For the empty two-case capture template (expected two `PENDING` results rather than `PASS`):

```powershell
npm run compare:workbench-common -- tests/fixtures/native-aspect/capture.template.json tests/fixtures/native-aspect/NIH_NativeAspect_Parity.layout --allow-pending
```

Capture the native client log using the [disposable probe procedure](runtime-mod/README.md), then extract the complete two-phase capture with `node scripts/extract-native-aspect-log.mjs <client-script.log> <actual-client-build> <output.json>`. Use that separate JSON (do not overwrite the template). The comparator already rejects mismatched rectangles, guards against synthetic captures, and requires a native build identifier for a version-pinned PASS.

The geometry suite parses the actual fixture and asserts the shared calculated rectangles. It is a **synthetic Studio prediction test**, not native parity proof. Passing it cannot be reported as Workbench-verified behavior.

## Promotion gate

Promote to PR #47 only after (a) full local build/test checks pass, (b) native aspect modes and exact-size bypass are independently observed, and (c) ImageWidget UV comparison passes with a known resource. Record failures by widget and property, not by ad-hoc CSS changes. Font metrics, safe-area/DPI behavior, container content measurement, and scissor/clipping remain separate scope.

### Independent native client capture (October 29, 2026)

The disposable probe has now compiled and executed successfully in a DayZ client. Its independent [structured capture](capture.runtime.2026-10-29.json) reports **18/18 matching descendant rectangles** across both root sizes, including all numeric aspect modes and exact-width bypass. The exact client executable build is not in the log (`DAYZ_1_30` is only a script define), so the generic comparator correctly returns **2 PENDING (9/9 numerically matched in each)**, not a version-pinned PASS.

```powershell
npm run test:geometry-engine
npm run compare:workbench-common -- tests/fixtures/native-aspect/capture.runtime.2026-10-29.json tests/fixtures/native-aspect/NIH_NativeAspect_Parity.layout --allow-pending
```

The new capture test asserts both matching numeric cases and the pending metadata gate. The untouched template must continue returning PENDING. Actual ImageWidget pixel UVs, clipping, fonts, and Workbench screenshot matching remain separate, open visual gates.

The parent consolidation commit `f6d5b106bef400c953f0a11fd4e7372497adc26f` passed 299 local tests in the user's 2026-10-29 09:16 PDT validation. The initial fixture additions passed the user's local run; the newly committed native capture regression cases require a fresh local run.
