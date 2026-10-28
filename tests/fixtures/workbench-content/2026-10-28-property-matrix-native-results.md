# Real DayZ native property matrix — 2026-10-28, 14:50 client run

## Independent evidence

The user supplied the complete client file
`script_2026-10-28_14-50-18.log`. The mod executed successfully, under
script define `DAYZ_1_30`; this is **not** a specific game build number.
There were unrelated warnings from DayZ and other loaded mods, but no
`[PropertyProbe] ERROR` lines.

Only the **95 original native `PropertyProbe` log lines** (with their
timestamps) were retained in
[`capture.property-matrix.native.2026-10-28.log`](capture.property-matrix.native.2026-10-28.log);
the other game/mod log lines are not copied into the repository.
The matching structured
[`capture.property-matrix.native.2026-10-28.json`](capture.property-matrix.native.2026-10-28.json)
contains all 14 native case entries in each of the three phases,
their native parent presence, direct child counts, independently
looked-up child presence, authored `GetSize`, and `GetScreenSize`.

`tests/native-content-property-matrix.test.mjs` **re-parses the native
evidence log and compares every phase to the frozen JSON**. The
test results are comparisons against independently obtained getter
data, not values manufactured by the layout model.

The three native measurement phases were complete:

| Phase | Native measured matrix root screen size |
|---|---|
| `after-create` | 1920 × 1080 |
| `post-update` | 1120 × 720 |
| `after-resize` | 1120 × 620 |

All 14 parent objects were found in all three phases. Every direct
child count, name lookup and parent screen/local size was **identical
between phases**. This is evidence that the difference is already
present after `CreateWidgets` and does not arise from the tested
later `Update()` or root resize.

## Observed native attribute behavior

The table reports the same values in **all three phases**. Each
ordinary Frame/Panel has authored and observed parent size 190×20.

| Widget family | Authored distinguishing property | Native children / 2 | Screen height |
|---|---|---:|---:|
| Frame | Absent | 2 | 20 |
| Frame | `Size To Content V 0` | **0** | 20 |
| Frame | `Size To Content V 1` | **0** | 20 |
| Frame | `Size To Content H 1` | **0** | 20 |
| Frame | H + V both 1 | **0** | 20 |
| Frame | `Size To Text V 1` | **0** | 20 |
| Frame | `clipchildren 1` | 2 | 20 |
| Panel | Absent | 2 | 20 |
| Panel | `Size To Content V 0` | **0** | 20 |
| Panel | `Size To Content V 1` | **0** | 20 |
| Panel | `Size To Content H 1` | **0** | 20 |
| WrapSpacer | Absent | 2 | 20 |
| WrapSpacer | `Size To Content V 0` | 2 | 20 |
| WrapSpacer | `Size To Content V 1` | 2 | **28** |

Every missing child returned `FindAnyWidget(childName)=null`
independently of the parent `GetChildren` count. The parents
themselves existed. `clipchildren 1` on an ordinary Frame did **not**
remove its children.

**Strongest supported finding:** For these authored properties and
widget classes, **mere presence** of `Size To Content` (including
explicitly disabled `0`), or the tested `Size To Text` flag on
Frame, correlates with **no descendants in the native hierarchy
immediately after creation**. An active sizing request is NOT
necessary. WrapSpacer retains its children for all three property
variants. It changes its native screen height only for V=1; its
local `GetSize` remains authored 190×20.

## Interpretation: loader parsing, not a global layout algorithm

The values implicate **native property recognition/parse-time handling**
more strongly than runtime layout measurement or clipping. However,
the getter probe does not observe the C++ loader token stream,
skipped blocks, warnings or internal state. It cannot tell whether
the property is unsupported, whether an unexpected attribute ends
a widget property section, or whether another class-specific parse
condition discards the nested block.

Avoid unsupported stronger claims:

- NOT proven: all Frame or Panel instances universally reject sizing
  attributes, or the native C++ parser has been recovered.
- NOT proven: a property set to 0 is semantically interpreted as
  enabled. The result is consistent with a **syntactic presence**
  effect even when disabled.
- NOT proven: missing children are deliberately destroyed during
  sizing. They are already missing **after creation**.
- NOT proven: the WrapSpacer's simple max-child-height result applies
  to ordinary containers or complex wrapped/hidden children.

### Architecture implications

Keep native source, authored parse tree, runtime existence, measured
layout and painted pixels as separate evidence domains. The Studio
layout parser can preserve authored children, and the shared geometry
engine can still compute their ordinary authored rectangles, without
claiming they necessarily appear in a native runtime hierarchy when
unsupported properties are present.

The proper production response is not to erase authored children,
silently strip unknown attributes or hardcode a Canvas subtree
suppression. Preserve the existing **passive** sizing intent decoder,
the conservative Frame/Panel opt-in content prototype and a separate
native widget-family capability/evidence boundary. Any compatibility
warning should be based on verified native eligibility and should
not mutate saved `.layout` content.

A further **isolated parser-level** test could compare a harmless
unknown property with valid `clipchildren`, and move the sizing
attribute before versus after the child block to distinguish
unrecognized-token behavior from a class-specific content-size
handler. Neither outcome is known yet. The earlier v1 and v2
native captures remain untouched.

## Status

**Real native getter observations: confirmed.** Complete 14-case
property matrix and phase telemetry; regression tests inspect all
42 case entries. Game build and actual native C++ parsing algorithm:
**still unknown**.

**PR #47:** draft and unmerged. No production Canvas or serialization
changes were made.
