import type { LayoutDocument, LayoutNode, LayoutProperty, LayoutProblem } from "../model/LayoutTypes";

interface LineToken {
	text: string;
	raw: string;
	line: number;
}

interface LexToken {
	text: string;
	start: number;
	end: number;
	quoted: boolean;
}

// Property names used by DayZ/Enfusion layouts. The first property on a physical
// line may still be unknown; this set is primarily used to find additional
// properties that Workbench has compacted onto the same physical line.
const s_KnownPropertyNames = new Set([
	"visible", "ignorepointer", "color", "position", "size", "halign", "valign",
	"hexactpos", "vexactpos", "hexactsize", "vexactsize", "style", "priority",
	"clipchildren", "draggable", "keepsafezone", "scaled", "fixaspect", "text",
	"font", "exact text", "exact text size", "size to text h", "size to text v",
	"text halign", "text valign", "bold text", "italic text", "shadow size", "shadow color",
	"shadow offset", "outline size", "outline color", "text offset", "text spacing",
	"image0", "image1", "image2", "image3", "image4", "image5", "image6", "image7",
	"imagetexture", "mode", "src alpha", "no wrap", "stretch", "stretch mode",
	"clamp mode", "filter", "nocache", "pivot", "transition width", "progress",
	"scrollbar v", "scrollbar h", "padding", "margin", "size to content h",
	"size to content v", "content_halign", "content_valign", "columns", "rows",
	"scriptclass", "default text color", "use default text", "text color",
	"disabled text color", "no focus", "aspectratio", "wrap", "disabled",
	"flip u", "flip v", "rotation", "mask", "current", "minimum", "maximum", "vertical", "flipped",
	"title", "title visible", "title proportion", "text outline size", "text outline color",
	"text shadow size", "text shadow color", "text shadow offset", "text shadow opacity", "colums", "highlight row",
	"render always", "noclear", "srgb", "camera", "refresh", "xscale", "yscale",
	"text background", "background color", "itemspacer", "itemoffsetleft", "itemoffsettop",
	"next left", "next right", "next up", "next down"
].map((value) => value.toLowerCase()));

export class LayoutParser {
	private m_NextNodeId = 1;

	Parse(source: string): LayoutDocument {
		this.m_NextNodeId = 1;
		const tokens = this.Tokenize(source);
		const roots: LayoutNode[] = [];
		let index = 0;

		while (index < tokens.length) {
			const token = tokens[index];
			if (!token.text || token.text.startsWith("//")) {
				++index;
				continue;
			}

			const declaration = this.TryParseDeclaration(token.text);
			if (!declaration) {
				++index;
				continue;
			}

			const result = this.ParseNode(tokens, index, declaration.type, declaration.name);
			roots.push(result.node);
			index = result.nextIndex;
		}

		return { roots, source };
	}

	/** Optionally reuse a previously parsed copy of the same source text. */
	AnalyzeFormatting(source: string, parsedDocument?: LayoutDocument): LayoutProblem[] {
		const problems: LayoutProblem[] = [];
		const lines = source.replace(/\r\n/g, "\n").split("\n");
		for (let i = 0; i < lines.length; ++i) {
			const properties = this.ParseProperties(lines[i], i + 1);
			if (properties.length > 1) {
				problems.push({
					type: "format", severity: "warning", line: i + 1, canNormalize: true,
					message: `Multiple properties on one line (${properties.length})`,
					detail: properties.map((property) => `${property.rawName} ${property.rawValue}`).join(" | ")
				});
			}
		}

		const document = parsedDocument?.source === source ? parsedDocument : this.Parse(source);
		const walk = (nodes: LayoutNode[]) => {
			for (const node of nodes) {
				const seen = new Map<string, LayoutProperty>();
				for (const property of node.properties) {
					const key = property.name.toLowerCase();
					const previous = seen.get(key);
					if (previous) problems.push({ type: "duplicate", severity: "warning", line: property.line, message: `Duplicate property '${property.name}' in ${node.name}`, detail: `First occurrence: line ${previous.line}` });
					else seen.set(key, property);
				}
				walk(node.children);
			}
		};
		walk(document.roots);
		return problems.sort((a, b) => a.line - b.line);
	}

	NormalizePropertyLine(source: string, lineNumber: number): string {
		const eol = source.includes("\r\n") ? "\r\n" : "\n";
		const lines = source.replace(/\r\n/g, "\n").split("\n");
		const index = lineNumber - 1;
		if (index < 0 || index >= lines.length) return source;
		const line = lines[index];
		const properties = this.ParseProperties(line, lineNumber);
		if (properties.length <= 1) return source;
		const indent = line.match(/^\s*/)?.[0] ?? "";
		const commentStart = this.FindCommentStart(line);
		const comment = commentStart >= 0 ? line.slice(commentStart).trimStart() : "";
		const replacement = properties.map((property, propertyIndex) => `${indent}${property.rawName} ${property.rawValue}${propertyIndex === properties.length - 1 && comment ? ` ${comment}` : ""}`);
		lines.splice(index, 1, ...replacement);
		return lines.join(eol);
	}

	NormalizeFormatting(source: string): string {
		let result = source;
		const problems = this.AnalyzeFormatting(source).filter((problem) => problem.canNormalize).sort((a, b) => b.line - a.line);
		for (const problem of problems) result = this.NormalizePropertyLine(result, problem.line);
		return result;
	}

	Serialize(document: LayoutDocument): string {
		return document.roots.map((root) => this.SerializeNode(root, 0)).join("\n\n") + "\n";
	}

	private ParseNode(tokens: LineToken[], startIndex: number, type: string, name: string): { node: LayoutNode; nextIndex: number } {
		const node: LayoutNode = {
			id: `node-${this.m_NextNodeId++}`,
			type,
			name,
			properties: [],
			children: [],
			line: tokens[startIndex].line
		};

		let index = startIndex;
		let opened = tokens[index].text.endsWith("{");
		++index;

		if (!opened && index < tokens.length && tokens[index].text === "{") {
			opened = true;
			++index;
		}

		if (!opened)
			return { node, nextIndex: index };

		while (index < tokens.length) {
			const token = tokens[index];
			const text = token.text;

			if (!text || text.startsWith("//")) {
				++index;
				continue;
			}

			if (text === "}") {
				++index;
				break;
			}

			if (text === "{") {
				const childGroupLine = token.line;
				++index;
				while (index < tokens.length && tokens[index].text !== "}") {
					const childDecl = this.TryParseDeclaration(tokens[index].text);
					if (!childDecl) {
						++index;
						continue;
					}
					const child = this.ParseNode(tokens, index, childDecl.type, childDecl.name);
					child.node.sourceGroupLine = childGroupLine;
					child.node.sourceGroupParentId = node.id;
					node.children.push(child.node);
					index = child.nextIndex;
				}
				if (index < tokens.length && tokens[index].text === "}")
					++index;
				continue;
			}

			const declaration = this.TryParseDeclaration(text);
			if (declaration) {
				const child = this.ParseNode(tokens, index, declaration.type, declaration.name);
				child.node.sourceGroupLine = token.line;
				child.node.sourceGroupParentId = node.id;
				node.children.push(child.node);
				index = child.nextIndex;
				continue;
			}

			const properties = this.ParseProperties(token.raw, token.line);
			for (const property of properties)
				node.properties.push(property);
			++index;
		}

		return { node, nextIndex: index };
	}

	private SerializeNode(node: LayoutNode, depth: number): string {
		const indent = "\t".repeat(depth);
		const propertyIndent = "\t".repeat(depth + 1);
		let output = `${indent}${node.type} ${node.name} {\n`;

		// Keep the original property / child-group order when source provenance
		// exists. This is syntax preservation, not a widget-family exception.
		const entries: Array<{
			line: number;
			order: number;
			property?: LayoutProperty;
			children?: LayoutNode[];
		}> = [];
		for (let i = 0; i < node.properties.length; ++i) {
			const property = node.properties[i];
			let line = Number.MAX_SAFE_INTEGER - 1;
			if (Number.isSafeInteger(property.line) && property.line > 0)
				line = property.line;
			entries.push({ line, order: i, property });
		}

		const grouped = new Map<number, LayoutNode[]>();
		const synthesized: LayoutNode[] = [];
		for (const child of node.children) {
			const groupLine = child.sourceGroupLine;
			if (child.sourceGroupParentId !== node.id ||
				groupLine === undefined || !Number.isSafeInteger(groupLine) || groupLine <= 0) {
				synthesized.push(child);
				continue;
			}
			let group = grouped.get(groupLine);
			if (!group) {
				group = [];
				grouped.set(groupLine, group);
			}
			group.push(child);
		}

		// New/reparented children have no trustworthy original group line.
		// Join the last known child group rather than placing children after
		// a source-authored trailing property that native DayZ may reject.
		if (synthesized.length > 0 && grouped.size > 0) {
			const lastGroup = Array.from(grouped.values()).at(-1);
			if (lastGroup)
				lastGroup.push(...synthesized);
		}

		let groupIndex = 0;
		for (const [line, children] of grouped)
			entries.push({ line, order: node.properties.length + groupIndex++, children });
		if (synthesized.length > 0 && grouped.size === 0)
			entries.push({ line: Number.MAX_SAFE_INTEGER, order: node.properties.length + groupIndex, children: synthesized });

		entries.sort((left, right) => {
			if (left.line !== right.line)
				return left.line - right.line;
			return left.order - right.order;
		});
		for (const entry of entries) {
			if (entry.property) {
				output += `${propertyIndent}${entry.property.rawName} ${entry.property.rawValue}\n`;
				continue;
			}
			if (entry.children && entry.children.length > 0) {
				output += `${propertyIndent}{\n`;
				for (const child of entry.children)
					output += this.SerializeNode(child, depth + 2) + "\n";
				output += `${propertyIndent}}\n`;
			}
		}

		output += `${indent}}`;
		return output;
	}

	private ParseProperties(rawLine: string, line: number): LayoutProperty[] {
		const commentStart = this.FindCommentStart(rawLine);
		const contentEnd = commentStart >= 0 ? commentStart : rawLine.length;
		const tokens = this.LexLine(rawLine.slice(0, contentEnd));
		if (tokens.length < 2)
			return [];

		const starts: number[] = [0];
		for (let i = 1; i < tokens.length; ++i) {
			const normalized = this.NormalizePropertyNameToken(tokens[i]);
			if (s_KnownPropertyNames.has(normalized))
				starts.push(i);
		}

		const result: LayoutProperty[] = [];
		for (let s = 0; s < starts.length; ++s) {
			const tokenIndex = starts[s];
			const nextTokenIndex = s + 1 < starts.length ? starts[s + 1] : tokens.length;
			if (nextTokenIndex <= tokenIndex + 1)
				continue;

			const nameToken = tokens[tokenIndex];
			const firstValueToken = tokens[tokenIndex + 1];
			const lastValueToken = tokens[nextTokenIndex - 1];
			const rawName = nameToken.text;
			const rawValue = rawLine.slice(firstValueToken.start, lastValueToken.end).trim();
			if (!rawValue)
				continue;

			result.push({
				name: this.Unquote(rawName),
				value: this.UnquoteWholeValue(rawValue),
				rawName,
				rawValue,
				line,
				startColumn: nameToken.start,
				endColumn: lastValueToken.end,
				valueStartColumn: firstValueToken.start,
				valueEndColumn: lastValueToken.end
			});
		}

		return result;
	}

	private LexLine(line: string): LexToken[] {
		const tokens: LexToken[] = [];
		let i = 0;
		while (i < line.length) {
			while (i < line.length && /\s/.test(line[i]))
				++i;
			if (i >= line.length)
				break;

			const start = i;
			if (line[i] === '"') {
				++i;
				let escaped = false;
				while (i < line.length) {
					const char = line[i++];
					if (escaped) {
						escaped = false;
						continue;
					}
					if (char === "\\") {
						escaped = true;
						continue;
					}
					if (char === '"')
						break;
				}
				tokens.push({ text: line.slice(start, i), start, end: i, quoted: true });
				continue;
			}

			while (i < line.length && !/\s/.test(line[i]))
				++i;
			tokens.push({ text: line.slice(start, i), start, end: i, quoted: false });
		}
		return tokens;
	}

	private NormalizePropertyNameToken(token: LexToken): string {
		return this.Unquote(token.text).toLowerCase();
	}

	private Unquote(value: string): string {
		return value.replace(/^"|"$/g, "");
	}

	private UnquoteWholeValue(value: string): string {
		const trimmed = value.trim();
		if (trimmed.startsWith('"') && this.FindClosingQuote(trimmed, 1) === trimmed.length - 1)
			return trimmed.slice(1, -1);
		return trimmed;
	}

	private TryParseDeclaration(text: string): { type: string; name: string } | null {
		const trimmed = text.trim();
		if (!trimmed || trimmed === "{" || trimmed === "}" || trimmed.startsWith("//"))
			return null;

		const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+("(?:\\.|[^"\\])*"|[^\s{]+)\s*(?:\{)?$/);
		if (!match)
			return null;

		const type = match[1];
		const name = match[2];
		if (!type.endsWith("Class"))
			return null;

		return { type, name };
	}

	private FindCommentStart(text: string): number {
		let quoted = false;
		let escaped = false;
		for (let i = 0; i < text.length - 1; ++i) {
			const char = text[i];
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\" && quoted) {
				escaped = true;
				continue;
			}
			if (char === '"') {
				quoted = !quoted;
				continue;
			}
			if (!quoted && char === "/" && text[i + 1] === "/")
				return i;
		}
		return -1;
	}

	private FindClosingQuote(text: string, start: number): number {
		let escaped = false;
		for (let i = start; i < text.length; ++i) {
			const char = text[i];
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === '"')
				return i;
		}
		return -1;
	}

	private Tokenize(source: string): LineToken[] {
		return source.replace(/\r\n/g, "\n").split("\n").map((raw, index) => ({
			text: raw.trim(),
			raw,
			line: index + 1
		}));
	}
}
