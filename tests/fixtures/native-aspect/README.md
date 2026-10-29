# Native `fixaspect` parity gate — Run 09 integration

**Purpose:** Compare NIH Layout Studio's shared geometry engine with an independent DayZ Workbench or runtime native observation for the common `fixaspect` property. This is a cross-family layout test, **not** an ImageWidget texture fit test.

## Reproducible fixture

`NIH_NativeAspect_Parity.layout` is a self-contained layout text fixture. Use a **960 × 500 logical root widget** (and record the actual root rectangle, zoom, DPI/UI scale, and application/build when capturing native results). Its four 420 × 160 exact-size parents sit in a 2 × 2 arrangement. Each descendant has authored relative size `0.4 0.2`, relative offset `0.05 0.1`, and a different native aspect mode. The fixture uses Panel, Text, Image, Button, and Frame widget families.

The ImageWidget deliberately does **not** specify a texture; this fixture compares its widget rectangle, not image pixels. Workbench may show only its selection outline. If a resource is missing, don't infer geometry from an absent image or style.

### Studio predicted rectangles (not yet independent native evidence)

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

The mode-3 Button deliberately extends **50 logical pixels below its parent's 160-pixel height**. This is intended: distinguish geometry from visual clipping. Do not compare clipped pixels to `GetScreenSize` as if they were the same measurement.

### Workbench vs Studio procedure

1. Check out `research/native-visual-parity-gate`, open this exact `.layout` in **Workbench**, and open the same fixture in **NIH Layout Studio** running locally (see repo README for dev-server command).
2. Use matching logical canvas/root dimensions, ideally 960×500. Record Workbench zoom percentage, Studio zoom, OS display scaling, application version, and the actual root screen rectangle. **Workbench zoom percentage is not itself the logical root size.**
3. Inspect/select `Fill_Mode0`, `Text_Mode1`, `Image_Mode2`, `Button_Mode3`, and `ExactWidthBypass`. Record native X/Y/W/H from the Workbench inspector or independent DayZ `GetScreenPos/GetScreenSize`; take screenshots showing the entire canvas and selected widget. Keep native observations separate from the predictions above.
4. For a native runtime getter capture, adapt the existing **working disposable client probe** in `../workbench-common/runtime-mod`, stage it under a **different mod name/prefix**, and point its layout resource path to this new fixture. Do not overwrite the established common-geometry PBO, alter production mods, or run both disposable MissionGameplay probes simultaneously.
5. Compare each observed native rectangle against the Studio-predicted rectangle after accounting for the **actual recorded parent/root screen geometry**. A screenshot alone at unequal zoom is weaker evidence than the native X/Y/W/H getters.
6. Separately, inspect ImageWidget `flip u` and `flip v` using a **known, resolved asymmetric texture/image-set** in both tools. Test none, U, V, both; compare image pixels without flipping the debug overlay. This geometry-only fixture cannot establish UV parity without a real texture source.

## Automated preflight

```powershell
npm run test:geometry-engine
npm run test:native-image-uv
```

The geometry suite parses the actual fixture and asserts the shared calculated rectangles. It is a **synthetic Studio prediction test**, not native parity proof. Passing it cannot be reported as Workbench-verified behavior.

## Promotion gate

Promote to PR #47 only after (a) full local build/test checks pass, (b) native aspect modes and exact-size bypass are independently observed, and (c) ImageWidget UV comparison passes with a known resource. Record failures by widget and property, not by ad-hoc CSS changes. Font metrics, safe-area/DPI behavior, container content measurement, and scissor/clipping remain separate scope.

The parent consolidation commit `f6d5b106bef400c953f0a11fd4e7372497adc26f` passed 299 local tests in the user's 2026-10-29 09:16 PDT validation. The fixture/test additions on **this new branch** still require a new local run.
