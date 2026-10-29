/**
 * Preserve two distinct authored sizing request families. The native
 * Workbench path for "size to text" is NOT assumed to be equivalent to
 * "size to content", nor to SDF-preview GetTextSize measurements.
 *
 * This is a passive decoder; no widget is resized based on these flags.
 */
export type ContentAxisMode = "none" | "text" | "content" | "ambiguous" | "invalid";

export interface ContentAxisRequest {
	readonly mode: ContentAxisMode;
	readonly sizeToText: boolean | null;
	readonly sizeToContent: boolean | null;
}

export interface ContentSizingRequests {
	readonly horizontal: ContentAxisRequest;
	readonly vertical: ContentAxisRequest;
	readonly evidence: "authored-sizing-flags-only";
}

interface SizingProperty {
	readonly name: string;
	readonly value: string;
}

function ReadFlag(values: ReadonlyMap<string, string>, name: string): boolean | null {
	const raw = values.get(name);
	if (raw === undefined || raw.trim() === "0")
		return false;
	if (raw.trim() === "1")
		return true;
	return null;
}

function Axis(
	values: ReadonlyMap<string, string>,
	textName: string,
	contentName: string
): ContentAxisRequest {
	const sizeToText = ReadFlag(values, textName);
	const sizeToContent = ReadFlag(values, contentName);
	let mode: ContentAxisMode = "none";
	if (sizeToText === null || sizeToContent === null)
		mode = "invalid";
	else if (sizeToText && sizeToContent)
		mode = "ambiguous";
	else if (sizeToText)
		mode = "text";
	else if (sizeToContent)
		mode = "content";
	return { mode, sizeToText, sizeToContent };
}

/** First property wins, matching the authored geometry decoder. */
export function DecodeContentSizingRequests(
	properties: readonly SizingProperty[]
): ContentSizingRequests {
	const values = new Map<string, string>();
	for (const property of properties) {
		const key = property.name.trim().toLowerCase();
		if (!values.has(key))
			values.set(key, property.value);
	}
	return {
		horizontal: Axis(values, "size to text h", "size to content h"),
		vertical: Axis(values, "size to text v", "size to content v"),
		evidence: "authored-sizing-flags-only"
	};
}
