/**
 * Central, opt-in FNT5 research settings. Parsing is pure and never enables
 * experimental rendering without an explicit URL parameter.
 */
export interface Fnt5ResearchOptions {
	standalone: boolean;
	cells: boolean;
	placement: boolean;
	cellLayout: boolean;
	lineOrigin: string | null;
	debugClip: boolean;
	debugSampling: boolean;
	msdf: boolean;
	msdfSmoothing: boolean;
	msdfStroke: boolean;
	fit: string | null;
}

export function ParseFnt5ResearchOptions(search: string): Fnt5ResearchOptions {
	const query = new URLSearchParams(search);
	return {
		standalone: query.get("experimentalStandaloneFnt5") === "1",
		cells: query.get("experimentalFnt5Cells") === "1",
		placement: query.get("experimentalFnt5Placement") === "1",
		cellLayout: query.get("experimentalFnt5Layout") === "cell",
		lineOrigin: query.get("experimentalFnt5LineOrigin"),
		debugClip: query.get("debugFnt5Clip") === "1",
		debugSampling: query.get("debugFnt5Sampling") === "1",
		msdf: query.get("experimentalMsdf") === "1",
		msdfSmoothing: query.get("experimentalMsdfSmoothing") === "1",
		msdfStroke: query.get("experimentalMsdfStroke") === "1",
		fit: query.get("experimentalFnt5Fit")
	};
}

/**
 * Canvas/SDF modules evaluate this once at module initialization. Workspace
 * resource indexing evaluates it when indexing, preserving its old timing.
 */
export function ReadFnt5ResearchOptions(): Fnt5ResearchOptions {
	if (typeof window === "undefined")
		return ParseFnt5ResearchOptions("");
	return ParseFnt5ResearchOptions(window.location.search);
}
