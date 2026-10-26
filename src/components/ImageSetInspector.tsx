import { useEffect, useMemo, useState } from "react";
import type { ImageSetDefinition, ImageSetImage } from "../project/ProjectTypes";
import { ParseImageSetSource } from "../project/ProjectWorkspace";

interface ImageSetInspectorProps {
	path: string;
	source: string;
	definition: ImageSetDefinition;
	atlasUrl: string | null;
	canSave: boolean;
	onClose: () => void;
	onSave: (source: string) => Promise<void>;
}

function FindMatchingBrace(source: string, open: number) {
	let depth = 0;
	let quoted = false;
	let escaped = false;
	for (let i = open; i < source.length; ++i) {
		const ch = source[i];
		if (quoted) {
			if (escaped)
				escaped = false;
			else if (ch === "\\")
				escaped = true;
			else if (ch === '"')
				quoted = false;
			continue;
		}
		if (ch === '"') {
			quoted = true;
			continue;
		}
		if (ch === "{")
			++depth;
		else if (ch === "}" && --depth === 0)
			return i;
	}
	return -1;
}

function EscapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function PatchProperty(block: string, name: string, value: string) {
	const escaped = EscapeRegExp(name);
	const re = new RegExp(`(^|\\n)(\\s*)${escaped}\\s+[^\\r\\n}]*`, "i");
	const match = block.match(re);
	if (match)
		return block.replace(re, `${match[1]}${match[2]}${name} ${value}`);
	const close = block.lastIndexOf("}");
	if (close < 0)
		return block;
	const indentMatch = block.match(/\n(\s+)[^\s}]/);
	const indent = indentMatch?.[1] ?? "\t";
	return `${block.slice(0, close)}${block.slice(0, close).endsWith("\n") ? "" : "\n"}${indent}${name} ${value}\n${block.slice(close)}`;
}

function PatchImageBlock(source: string, originalName: string, next: ImageSetImage) {
	const escaped = EscapeRegExp(originalName);
	const re = new RegExp(`ImageSetDefClass\\s+(?:"${escaped}"|${escaped})\\s*\\{`, "i");
	const match = re.exec(source);
	if (!match)
		throw new Error(`Could not locate ImageSetDefClass ${originalName}`);
	const open = source.indexOf("{", match.index);
	const close = FindMatchingBrace(source, open);
	if (open < 0 || close < 0)
		throw new Error(`Malformed ImageSetDefClass ${originalName}`);
	let block = source.slice(match.index, close + 1);
	block = block.replace(/^ImageSetDefClass\s+(?:"[^"]+"|[^\s{]+)/i, `ImageSetDefClass ${next.name}`);
	block = PatchProperty(block, "Name", `"${next.name.replace(/"/g, "")}"`);
	block = PatchProperty(block, "Pos", `${Math.round(next.x)} ${Math.round(next.y)}`);
	block = PatchProperty(block, "Size", `${Math.max(1, Math.round(next.width))} ${Math.max(1, Math.round(next.height))}`);
	block = PatchProperty(block, "Flags", String(next.flags | 0));
	return source.slice(0, match.index) + block + source.slice(close + 1);
}

export function ImageSetInspector({ path, source, definition, atlasUrl, canSave, onClose, onSave }: ImageSetInspectorProps) {
	const [draftSource, setDraftSource] = useState(source);
	const [draft, setDraft] = useState(definition);
	const [selectedKey, setSelectedKey] = useState(definition.images.keys().next().value ?? "");
	const [dirty, setDirty] = useState(false);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		setDraftSource(source);
		setDraft(definition);
		setSelectedKey(definition.images.keys().next().value ?? "");
		setDirty(false);
		setStatus(null);
	}, [source, definition, path]);

	const images = useMemo(() => [...draft.images.values()], [draft]);
	const selected = draft.images.get(selectedKey) ?? images[0] ?? null;

	function UpdateSelected(patch: Partial<ImageSetImage>) {
		if (!selected)
			return;
		try {
			const next = { ...selected, ...patch };
			const nextSource = PatchImageBlock(draftSource, selected.name, next);
			const parsed = ParseImageSetSource(path, nextSource);
			if (!parsed)
				throw new Error("Edited imageset did not parse");
			setDraftSource(nextSource);
			setDraft(parsed);
			setSelectedKey(next.name.toLowerCase());
			setDirty(true);
			setStatus(null);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : String(error));
		}
	}

	async function Save() {
		try {
			await onSave(draftSource);
			setDirty(false);
			setStatus("Saved and resource index refreshed");
		} catch (error) {
			setStatus(error instanceof Error ? error.message : String(error));
		}
	}

	const previewWidth = 720;
	const previewHeight = 460;
	const scale = Math.min(previewWidth / Math.max(1, draft.refWidth), previewHeight / Math.max(1, draft.refHeight), 1);
	const canvasWidth = Math.max(1, draft.refWidth * scale);
	const canvasHeight = Math.max(1, draft.refHeight * scale);

	return (
		<div className="modal-backdrop imageset-inspector-backdrop">
			<div className="imageset-inspector-modal">
				<div className="imageset-inspector-header">
					<div><strong>Imageset Inspector</strong><span>{path}</span></div>
					<div className="imageset-inspector-header-actions"><span>{draft.refWidth}×{draft.refHeight} · {images.length} sprites</span><button onClick={onClose}>×</button></div>
				</div>
				<div className="imageset-inspector-body">
					<div className="imageset-inspector-list">
						{images.map((image) => <button key={image.name.toLowerCase()} className={selected?.name === image.name ? "selected" : ""} onClick={() => setSelectedKey(image.name.toLowerCase())}><span>{image.name}</span><small>{image.width}×{image.height} · F{image.flags}</small></button>)}
					</div>
					<div className="imageset-inspector-preview-wrap">
						<div className="imageset-inspector-preview" style={{ width: canvasWidth, height: canvasHeight }}>
							{atlasUrl ? <img src={atlasUrl} draggable={false} /> : <div className="imageset-inspector-no-atlas">Atlas texture unavailable</div>}
							{images.map((image) => <button key={`box:${image.name}`} className={`imageset-sprite-box ${selected?.name === image.name ? "selected" : ""}`} style={{ left: image.x * scale, top: image.y * scale, width: Math.max(2, image.width * scale), height: Math.max(2, image.height * scale) }} title={image.name} onClick={() => setSelectedKey(image.name.toLowerCase())} />)}
						</div>
					</div>
					<div className="imageset-inspector-properties">
						{selected ? <>
							<label><span>Name</span><input value={selected.name} onChange={(event) => UpdateSelected({ name: event.target.value.replace(/[^A-Za-z0-9_.-]/g, "_") || "Image" })} /></label>
							<div className="imageset-inspector-grid"><label><span>X</span><input type="number" value={selected.x} onChange={(event) => UpdateSelected({ x: Number(event.target.value) || 0 })} /></label><label><span>Y</span><input type="number" value={selected.y} onChange={(event) => UpdateSelected({ y: Number(event.target.value) || 0 })} /></label><label><span>Width</span><input type="number" min="1" value={selected.width} onChange={(event) => UpdateSelected({ width: Math.max(1, Number(event.target.value) || 1) })} /></label><label><span>Height</span><input type="number" min="1" value={selected.height} onChange={(event) => UpdateSelected({ height: Math.max(1, Number(event.target.value) || 1) })} /></label></div>
							<label className="imageset-flag"><input type="checkbox" checked={(selected.flags & 1) !== 0} onChange={(event) => UpdateSelected({ flags: event.target.checked ? selected.flags | 1 : selected.flags & ~1 })} /><span>Horizontal Tile <small>ISHorizontalTile / bit 1</small></span></label>
							<label className="imageset-flag"><input type="checkbox" checked={(selected.flags & 2) !== 0} onChange={(event) => UpdateSelected({ flags: event.target.checked ? selected.flags | 2 : selected.flags & ~2 })} /><span>Vertical Tile <small>ISVerticalTile / bit 2</small></span></label>
							<div className="imageset-inspector-flags">Serialized Flags: <strong>{selected.flags}</strong></div>
						</> : <div>No sprites in this imageset.</div>}
						{status && <div className="texture-tool-status">{status}</div>}
					</div>
				</div>
				<div className="imageset-inspector-footer"><span>{dirty ? "Modified" : "No unsaved changes"}</span><div><button onClick={onClose}>Close</button><button className="primary" disabled={!dirty || !canSave} onClick={() => void Save()}>{canSave ? "Save Imageset" : "Read-only"}</button></div></div>
			</div>
		</div>
	);
}
