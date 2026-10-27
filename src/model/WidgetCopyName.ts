// DayZ Workbench ID-backed widget declarations must remain valid when copied.
export function MakeCopiedWidgetNameFromNames(names: Set<string>, name: string): string {
	const match = name.match(/^"\{([0-9a-fA-F]+)\}"$/);
	if (!match) {
		const baseName = `${name}_Copy`;
		if (!names.has(baseName))
			return baseName;
		let suffix = 2;
		while (names.has(`${baseName}${suffix}`))
			++suffix;
		return `${baseName}${suffix}`;
	}
	const original = match[1];
	const width = original.length;
	const limit = 1n << BigInt(width * 4);
	let next = (BigInt(`0x${original}`) + 1n) % limit;
	const first = next;
	do {
		const candidate = `"{${next.toString(16).toUpperCase().padStart(width, "0")}}"`;
		if (!names.has(candidate))
			return candidate;
		next = (next + 1n) % limit;
	} while (next !== first);
	throw new Error("No available widget identifiers");
}
