/**
 * Shared decoded SpacerWidget spacing properties. Both Grid and Wrap use
 * the compiled SpacerWidget property-loader defaults; subclasses only
 * interpret those settings within their own native arrangement strategies.
 */
export interface NativeSpacerSpacing {
	padding: number;
	margin: number;
}

export function ReadFirstIntegerProperty(
	properties: readonly { name: string; value: string }[],
	key: string,
	fallback: number
): number {
	const needle = key.toLowerCase();
	for (const property of properties) {
		if (property.name.toLowerCase() !== needle)
			continue;
		const raw = property.value.trim();
		if (!raw)
			return fallback;
		const number = Number(raw);
		return Number.isFinite(number) ? Math.trunc(number) : fallback;
	}
	return fallback;
}

/** Recovered shared SpacerWidget defaults: both values are 2. */
export function DecodeNativeSpacerSpacing(
	properties: readonly { name: string; value: string }[]
): NativeSpacerSpacing {
	return {
		padding: Math.max(0, ReadFirstIntegerProperty(properties, "padding", 2)),
		margin: Math.max(0, ReadFirstIntegerProperty(properties, "margin", 2))
	};
}
