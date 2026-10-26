import { useMemo } from "react";
import type { LayoutNode } from "../model/LayoutTypes";
import { BuildRenderDiagnostics, type PropertyDiagnosticEntry } from "../renderer/RenderDiagnostics";

interface RenderStatusProps {
	nodes: LayoutNode[];
}

function FriendlyName(type: string) {
	return type.replace(/Class$/, "");
}

function PropertyRow({ entry, severity }: { entry: PropertyDiagnosticEntry; severity: "known" | "invalid" | "unknown" }) {
	const title = severity === "invalid" && entry.owners?.length
		? `Observed on ${FriendlyName(entry.widgetType)} (${entry.widgetName}, line ${entry.line}). Known on: ${entry.owners.map(FriendlyName).join(", ")}`
		: `Observed on ${FriendlyName(entry.widgetType)} (${entry.widgetName}, line ${entry.line})`;
	return (
		<div className={`status-property status-property-${severity}`} title={title}>
			<span>{entry.name}</span>
			<small>{FriendlyName(entry.widgetType)}</small>
			<b>{entry.count}</b>
		</div>
	);
}

export function RenderStatus({ nodes }: RenderStatusProps) {
	const diagnostics = useMemo(() => BuildRenderDiagnostics(nodes), [nodes]);
	const supported = [...diagnostics.widgetCounts.entries()].filter(([type]) => !diagnostics.approximateWidgetCounts.has(type) && !diagnostics.unknownWidgetCounts.has(type));
	const approximate = [...diagnostics.approximateWidgetCounts.entries()];
	const unknown = [...diagnostics.unknownWidgetCounts.entries()];
	const knownUnrendered = [...diagnostics.knownUnrenderedProperties.values()].slice(0, 12);
	const invalidProperties = [...diagnostics.invalidProperties.values()].slice(0, 12);
	const unknownProperties = [...diagnostics.unknownProperties.values()].slice(0, 12);

	return (
		<details className="render-status">
			<summary>Render Status</summary>
			<div className="render-status-body">
				{supported.map(([type, count]) => <div key={type}><span className="status-good">✓</span> {FriendlyName(type)} <b>{count}</b></div>)}
				{approximate.map(([type, count]) => <div key={type}><span className="status-warn">△</span> {FriendlyName(type)} <b>{count}</b></div>)}
				{unknown.map(([type, count]) => <div key={type}><span className="status-bad">?</span> {FriendlyName(type)} <b>{count}</b></div>)}

				{knownUnrendered.length > 0 && (
					<>
						<div className="status-subhead">Known / not yet rendered</div>
						{knownUnrendered.map((entry) => <PropertyRow key={`${entry.widgetType}:${entry.name}`} entry={entry} severity="known" />)}
					</>
				)}

				{invalidProperties.length > 0 && (
					<>
						<div className="status-subhead status-subhead-invalid">Possibly invalid for widget</div>
						{invalidProperties.map((entry) => <PropertyRow key={`${entry.widgetType}:${entry.name}`} entry={entry} severity="invalid" />)}
					</>
				)}

				{unknownProperties.length > 0 && (
					<>
						<div className="status-subhead status-subhead-unknown">Unknown properties</div>
						{unknownProperties.map((entry) => <PropertyRow key={`${entry.widgetType}:${entry.name}`} entry={entry} severity="unknown" />)}
					</>
				)}
			</div>
		</details>
	);
}
