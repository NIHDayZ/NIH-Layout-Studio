# Phase 2F — bounded native Grid measurement prototype

This stage adds an **opt-in, read-only** measurement map in the shared geometry snapshot: `gridNativeMeasurementDiagnostics`. It reconstructs the six fixed-child size-to-content observations recorded in the October 30 native DayZ client capture.

The prototype supports only three-child matrices with the captured exact spacing (Padding=3, Margin=4) in the observed 2x2 and 1x3 structures. The relative-child case is explicitly rejected. No parent/child geometry or renderer changes are made, and the default option remains disabled.

The adjustments (+1/+1 for three participating children in 2x2, +1/-2 for a skipped second child, +2/0 for 1x3) are **empirical evidence-bound results, not a recovered universal C++ rule**. Further native probes with changed padding/margin, children and counts are required before loosening guards or promoting this to a layout strategy.
