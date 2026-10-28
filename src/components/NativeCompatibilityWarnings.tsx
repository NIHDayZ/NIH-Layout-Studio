import type { NativeCompatibilityDiagnostic } from "../renderer/engine/NativePropertyCompatibility";

interface WarningListProps {
	warnings: readonly NativeCompatibilityDiagnostic[];
	limit?: number;
}

export function NativeCompatibilityWarnings({ warnings, limit = 20 }: WarningListProps) {
	if (warnings.length === 0)
		return null;
	const shown = warnings.slice(0, Math.max(0, limit));
	return (
		<div className="native-compatibility-list">
			{shown.map((warning, index) => (
				<div className={`native-compatibility-entry ${warning.severity}`}
					key={`${warning.id}:${warning.propertyName}:${warning.propertyLine ?? "unknown"}:${index}`}>
					<div className="native-compatibility-entry-heading">
						<span className="native-compatibility-entry-title">{warning.widgetName} · {warning.propertyName}</span>
						<span className="native-compatibility-entry-line">
							{warning.propertyLine === null ? "Line unknown" : `Line ${warning.propertyLine}`}
						</span>
					</div>
					<div className="native-compatibility-entry-detail">{warning.detail}</div>
					<div className="native-compatibility-entry-basis">
						{warning.evidence === "unverified"
							? "No native validation for this class/property pair"
							: "DayZ native client fixture · 2026-10-28 · build not recorded"}
					</div>
				</div>
			))}
			{warnings.length > shown.length && (
				<div className="native-compatibility-remaining">
					{warnings.length - shown.length} additional finding(s). The list is limited for readability; no source changes were made.
				</div>
			)}
		</div>
	);
}

interface ReviewProps {
	actionLabel: "Save" | "Export";
	warnings: readonly NativeCompatibilityDiagnostic[];
	onCancel: () => void;
	onContinue: () => void;
}

export function NativeCompatibilityReview({ actionLabel, warnings, onCancel, onContinue }: ReviewProps) {
	return (
		<div className="modal-backdrop" onPointerDown={(event) => {
			if (event.target === event.currentTarget)
				onCancel();
		}}>
			<div className="native-compatibility-dialog"
				role="dialog" aria-modal="true" aria-labelledby="native-compatibility-title"
				aria-describedby="native-compatibility-description"
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						onCancel();
					}
					event.stopPropagation();
				}}>
				<div className="native-compatibility-dialog-heading" id="native-compatibility-title">
					Native compatibility review
				</div>
				<p id="native-compatibility-description">
					{warnings.length} potentially unsafe native loader property
					{warnings.length === 1 ? " placement" : " placements"} detected.
					In the tested DayZ client, these property/class arrangements changed whether child widgets loaded.
				</p>
				<NativeCompatibilityWarnings warnings={warnings} limit={12} />
				<div className="native-compatibility-dialog-footnote">
					Findings are based on limited native DayZ tests, not a complete Workbench property allowlist.
					Continuing {actionLabel.toLowerCase()}s your current source unchanged; nothing is repaired or removed automatically.
				</div>
				<div className="native-compatibility-dialog-actions">
					<button onClick={onCancel} autoFocus>Cancel</button>
					<button className="native-compatibility-continue" onClick={onContinue}>
						Continue {actionLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
