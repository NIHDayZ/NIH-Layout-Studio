# Native property syntax result — 2026-10-28 (15:13 client log)

## Real runtime provenance

The user supplied the complete `script_2026-10-28_15-13-19.log`
from a DayZ client. Mission scripts compiled and all three disposable
probe families executed; this document concerns only the last,
**isolated syntax probe**, which started at 15:14:09.814 and ended
at 15:14:09.815 in the client script log.

We preserved the original **50** `[NIH_LayoutStudio][SyntaxProbe]`
lines without modifications to their contents in
[`capture.property-syntax.native.2026-10-28.log`](capture.property-syntax.native.2026-10-28.log).
The structured
[`capture.property-syntax.native.2026-10-28.json`](capture.property-syntax.native.2026-10-28.json)
stores native getter results for **12 separately constructed layout
resources, each observed after creation and after Update** (24 cases).
All 12 `CreateWidgets` calls returned a root, and all 12 expected
parents existed. The client had script define `DAYZ_1_30` but
the exact client build version and UI scale are still unrecorded.

The new `tests/native-content-property-syntax.test.mjs` test
independently reparses the original native lines and verifies every
structured getter observation without generating expected geometry
from the authored preview engine.

## Matched controls — observed native children

All parent objects retained authored and native **190×20** size.
Each row below reports the native number of directly reachable
children from the matching `GetChildren` and `FindAnyWidget` calls.
Every result was identical in the two phases.

| Widget class | Property placement | Native child count |
|---|---|---:|
| Frame | No additional property | 2 |
| Frame | `"Size To Content V" 0` **before** children | **0** |
| Frame | `"Size To Content V" 0` **after** children | **2** |
| Frame | `"NIH_ProbeUnknown" 0` **before** children | **0** |
| Frame | `"NIH_ProbeUnknown" 0` **after** children | **2** |
| Frame | `clipchildren 1` **before** children | 2 |
| Frame | `clipchildren 1` **after** children | 2 |
| Panel | No additional property | 2 |
| Panel | `"Size To Content V" 0` **before** children | **0** |
| Panel | `"Size To Content V" 0` **after** children | **2** |
| Panel | `"NIH_ProbeUnknown" 0` **before** children | **0** |
| Panel | `"NIH_ProbeUnknown" 0` **after** children | **2** |

The native parent objects exist even when neither child was
constructed. The **same syntactically present attribute**, moved
after the child group in an otherwise identical independent file,
does not prevent the two earlier children from being constructed.
A recognized `clipchildren` control keeps both children in either
position. These facts hold **before** an explicit Update.

## Recovered mechanism boundary

This is now **strong, controlled evidence for a native layout parser
property-recognition / parse-order effect**, rather than a native
content-size or clipping calculation:

1. Presence of `Size To Content V=0` before a Frame/Panel child
   block has the same native tree effect as a deliberately
   unrecognized `NIH_ProbeUnknown=0` property.
2. Moving either property after the child block preserves the
   already encountered child group.
3. The recognized `clipchildren` property does not interfere
   with child construction, whether located before or after.

**The likely explanation** is that, while reading Frame/Panel
layout definitions, the native loader encounters an unsupported
attribute and stops or skips subsequent tokens in the widget
definition, thereby never building the following child group.

**Not directly demonstrated:** The exact native C++ tokenizer,
whether its recovery method is stop/skip/ignore-with-boundary,
whether the trailing unsupported property is processed at all,
the formal property allowlist for every widget family, or
behavior in every DayZ build. We should therefore describe
this as a **parser-compatibility inference grounded in getter
observations**, not an exact recovered C++ algorithm.

## Implications for NIH Layout Studio

The shared geometry engine and the native source loader are
distinct mechanisms. Our parser should continue preserving
all authored widget children and unknown properties for
round-trip losslessness. The production Canvas should not
magically discard descendants to imitate an observed native
loader defect: that could destroy legitimate editable content.

A future **non-mutating compatibility diagnostic** can identify
property names not recognized for the corresponding native
widget family **before** a child group. Such warnings require
an evidence-backed class/property capability registry rather
than a hardcoded `FrameWidgetClass` exception or blanket
rejection of unknown user properties.

For accurate Workbench fidelity, prefer validation and
per-widget **native capability data** at import/export time,
with known/unknown evidence distinctions. Keep size-to-content
geometry negotiation limited to the widget families actually
validated by native probes (currently the tested WrapSpacer
height case). Do not generalize Wrap's algorithm to Frame/Panel.

The previous v1, v2, and 14-case native captures are unchanged,
PR #47 remains draft, and production Canvas and serialization
have not been altered.
