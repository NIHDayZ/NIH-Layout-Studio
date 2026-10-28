/**
 * Shared classification of authored child-layout ownership.
 *
 * Class identity is matched exactly, not by a loose substring test. The
 * registry only selects a strategy; it does NOT implement native behavior.
 * A new Workbench-specific class should add a strategy here only after its
 * layout responsibility is demonstrated.
 */
export type ChildLayoutKind =
	| "authored"
	| "grid"
	| "wrap"
	| "spacer"
	| "scroll"
	| "content"
	| "embedded"
	| "smart-panel";

export type StrategyEvidence = "authored" | "native-disassembly" | "script-api" | "layout-observation";

export interface ChildLayoutStrategy {
	kind: ChildLayoutKind;
	evidence: StrategyEvidence;
	/** True when child coordinates must not be treated as final authored positions. */
	requiresArrangement: boolean;
}

const AUTHORED: ChildLayoutStrategy = Object.freeze({
	kind: "authored",
	evidence: "authored",
	requiresArrangement: false
});

function Managed(kind: Exclude<ChildLayoutKind, "authored">, evidence: Exclude<StrategyEvidence, "authored">): ChildLayoutStrategy {
	return Object.freeze({ kind, evidence, requiresArrangement: true });
}

// Native evidence for Grid/Wrap is in docs/workbench-native-spacer-static-analysis.md.
// The others are identified from public script APIs and shipped layout classes;
// their exact measure/arrange procedures remain to be recovered.
const STRATEGIES = new Map<string, ChildLayoutStrategy>([
	["gridspacerwidgetclass", Managed("grid", "native-disassembly")],
	["wrapspacerwidgetclass", Managed("wrap", "native-disassembly")],
	["spacerwidgetclass", Managed("spacer", "script-api")],
	["scrollwidgetclass", Managed("scroll", "script-api")],
	["contentwidgetclass", Managed("content", "layout-observation")],
	["embededwidgetclass", Managed("embedded", "layout-observation")],
	["smartpanelwidgetclass", Managed("smart-panel", "layout-observation")]
]);

export function ResolveChildLayoutStrategy(type: string): ChildLayoutStrategy {
	return STRATEGIES.get(type.trim().toLowerCase()) ?? AUTHORED;
}
