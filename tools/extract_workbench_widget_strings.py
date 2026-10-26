#!/usr/bin/env python3
"""Extract widget-class and nearby property metadata from WorkbenchApp.exe.

The extractor inventories every printable *WidgetClass string instead of relying on
hand-picked widget anchors. Workbench/editor wrappers (AV*/AU*) are reported
separately from layout-facing widget classes. Nearby printable strings are evidence
for manual schema review only; they are not automatically promoted to properties.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ASCII_PRINTABLE = re.compile(rb"[\x20-\x7e]{3,}")
UTF16_PRINTABLE = re.compile(rb"(?:[\x20-\x7e]\x00){3,}")
WIDGET_CLASS = re.compile(r"\b[A-Za-z0-9_]*WidgetClass\b")

PROPERTY_EDITOR_ANCHORS = [
    "BooleanPropertyCheckBox",
    "IntegerPropertyComboBox",
    "IntegerPropertySlider",
    "IntegerPropertySpinBox",
    "ScalarPropertyComboBox",
    "ScalarPropertySlider",
    "StringPropertyComboBox",
    "StringPropertyResourceNamePicker",
    "ColorProperty",
    "FlagsProperty",
    "WidgetOffsetProperty",
    "WidgetAnchorProperty",
    "AlignmentProperty",
]


def strings(data: bytes):
    rows: list[tuple[int, str, str]] = []
    for match in ASCII_PRINTABLE.finditer(data):
        rows.append((match.start(), match.group().decode("ascii", "replace"), "ascii"))
    for match in UTF16_PRINTABLE.finditer(data):
        try:
            rows.append((match.start(), match.group().decode("utf-16le"), "utf16le"))
        except UnicodeDecodeError:
            pass
    rows.sort(key=lambda row: row[0])
    return rows


def first_offsets(rows):
    found: dict[str, dict[str, object]] = {}
    for offset, text, encoding in rows:
        for widget_class in WIDGET_CLASS.findall(text):
            found.setdefault(widget_class, {"offset": offset, "encoding": encoding})
    return found


def nearby(rows, offset: int, before: int = 256, after: int = 4096):
    return [
        {"offset": hex(row_offset), "encoding": encoding, "text": text}
        for row_offset, text, encoding in rows
        if offset - before <= row_offset <= offset + after
    ]


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: extract_workbench_widget_strings.py WorkbenchApp.exe [output.json]", file=sys.stderr)
        return 2

    exe = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("workbench_widget_metadata.json")
    data = exe.read_bytes()
    rows = strings(data)
    classes = first_offsets(rows)

    wrapper_names = sorted(name for name in classes if name.startswith(("AV", "AU")))
    layout_names = sorted(name for name in classes if not name.startswith(("AV", "AU")))

    widgets = []
    for name in layout_names:
        info = classes[name]
        widgets.append({
            "class": name,
            "offset": hex(int(info["offset"])),
            "encoding": info["encoding"],
            "strings": nearby(rows, int(info["offset"])),
        })

    editor_anchors = []
    for anchor in PROPERTY_EDITOR_ANCHORS:
        match = next(((offset, encoding) for offset, text, encoding in rows if anchor in text), None)
        if match is None:
            continue
        offset, encoding = match
        editor_anchors.append({
            "anchor": anchor,
            "offset": hex(offset),
            "encoding": encoding,
            "strings": nearby(rows, offset),
        })

    out.write_text(json.dumps({
        "executable": exe.name,
        "layout_widget_class_count": len(layout_names),
        "workbench_wrapper_class_count": len(wrapper_names),
        "layout_widget_classes": layout_names,
        "workbench_wrapper_classes": wrapper_names,
        "widgets": widgets,
        "property_editor_anchors": editor_anchors,
    }, indent=2), encoding="utf-8")
    print(f"wrote {out} ({len(layout_names)} layout widget classes, {len(wrapper_names)} Workbench wrappers)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
