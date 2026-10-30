# Native GridSpacer measurement matrix — probe inputs, not native measurements

This eight-container `.layout` input isolates the unknown native content-measurement branch from the known fixed-cell arrangement branch. The parent uses fixed authored dimensions (240×100) with native-decoded Columns=2, Rows=2, Padding=3, Margin=4. Each default grid has three direct children with exact sizes (40×10, 20×15, 30×25). Cases vary only as stated:

| Case | Size To Content H | Size To Content V | Independent variation |
| --- | --- | --- | --- |
| GridFixed | 0 | 0 | baseline |
| GridContentH | 1 | 0 | horizontal measurement |
| GridContentV | 0 | 1 | vertical measurement |
| GridContentBoth | 1 | 1 | both axes |
| GridRelativeChild | 1 | 1 | second child relative size |
| GridHiddenDefault | 1 | 1 | second child invisible; default Ignore invisible |
| GridHiddenIncluded | 1 | 1 | same hidden child, Ignore invisible 0 |
| GridExplicitCounts | 1 | 1 | separate stable controls for future counts variant |

**Capture required:** from the pinned Workbench build or matching DayZ client, for EACH Grid container and three children, record GetPos, GetSize, GetScreenPos, GetScreenSize, visibility and count at creation, after Update, and after viewport resize. Keep root resolution, DPI/scale, build hash, and unmodified source alongside output. Include a second viewport size for identifying parent-dependent effects.

**Do not** fill native observation fields from `PlanGrid`, `PlanConstrainedGrid`, or the fixed-child diagnostic. Native measurement/update order and the resulting dimensions are still unverified. A successful parser test asserts fixture integrity, NOT native parity.

This is nonproduction research; the accepted 280-test baseline and PR #47 are unchanged.
