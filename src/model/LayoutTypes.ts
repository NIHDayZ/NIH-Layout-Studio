export interface LayoutProperty {
	name: string;
	value: string;
	rawName: string;
	rawValue: string;
	line: number;
	startColumn?: number;
	endColumn?: number;
	valueStartColumn?: number;
	valueEndColumn?: number;
}

export interface LayoutNode {
	id: string;
	type: string;
	name: string;
	properties: LayoutProperty[];
	children: LayoutNode[];
	line: number;
	/** Original containing child-group opening line; optional for synthesized nodes. */
	sourceGroupLine?: number;
	/** Parent node ID at parse time; stops stale source coordinates after reparenting. */
	sourceGroupParentId?: string;
}

export interface LayoutDocument {
	roots: LayoutNode[];
	source: string;
}

export interface LayoutProblem {
	type: "format" | "duplicate" | "parse";
	severity: "warning" | "error";
	line: number;
	message: string;
	detail?: string;
	canNormalize?: boolean;
}
