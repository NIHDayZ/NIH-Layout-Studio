import { useEffect, useMemo, useState } from "react";
import type { LayoutNode, LayoutProperty } from "../model/LayoutTypes";
import type { ResolvedImageResource } from "../project/ProjectTypes";
import { FindWidgetPropertySchema, GetWidgetSchema, type WidgetPropertySchema } from "../schema/WidgetSchema";

export interface FontResourceOption {
	value: string;
	label: string;
	source: "project" | "dependency" | "vanilla";
	sourceLabel?: string;
	aliases?: string[];
}

export interface StyleResourceOption {
	name: string;
	widgetType: string;
	source: "project" | "dependency" | "vanilla";
	sourceLabel?: string;
}

export interface ImageResourceOption {
	name: string;
	preview?: ResolvedImageResource;
}

export interface ImageSetResourceOption {
	setName: string;
	source: "project" | "dependency" | "vanilla";
	sourceLabel?: string;
	images: ImageResourceOption[];
}

interface PropertyInspectorProps {
	node: LayoutNode | null;
	onRename: (node: LayoutNode, name: string) => void;
	onPropertyChange: (node: LayoutNode, propertyName: string, rawValue: string) => void;
	onAddProperty: (node: LayoutNode, propertyName: string, rawValue: string) => void;
	onDeleteProperty: (node: LayoutNode, propertyName: string) => void;
	fontOptions: FontResourceOption[];
	imageSetOptions: ImageSetResourceOption[];
	styleOptions: StyleResourceOption[];
}

const groups: { title: string; properties: string[] }[] = [
	{ title: "Layout", properties: ["position", "size", "halign", "valign", "hexactpos", "vexactpos", "hexactsize", "vexactsize", "priority", "clipchildren"] },
	{ title: "Appearance", properties: ["visible", "color", "style", "image0", "image1", "image2", "image3", "image4", "image5", "image6", "image7", "imageTexture", "mode", "stretch", "stretch mode", "fixaspect"] },
	{ title: "Text", properties: ["text", "font", "exact text", "exact text size", "bold text", "text halign", "text valign", "shadow size", "shadow color", "shadow offset"] },
	{ title: "Behavior", properties: ["ignorepointer", "draggable", "scriptclass", "no focus"] },
	{ title: "Content Layout", properties: ["Padding", "Margin", "Size To Content H", "Size To Content V", "content_halign", "content_valign", "Columns", "Rows", "Spacing", "orientation"] }
];

function StripLayoutQuotes(rawValue: string) {
	const trimmed = rawValue.trim();
	if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"'))
		return trimmed.slice(1, -1);
	return trimmed;
}

function QuoteLayoutString(value: string) {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function NormalizeFontReference(value: string) {
	return StripLayoutQuotes(value)
		.replace(/^\{[0-9A-Fa-f]+\}/, "")
		.replace(/\\/g, "/")
		.replace(/^\.\//, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\.(fnt|ttf|otf|woff2?)$/i, "")
		.replace(/^\/+|\/+$/g, "")
		.toLowerCase();
}

function FontOptionMatches(option: FontResourceOption, value: string) {
	const wanted = NormalizeFontReference(value);
	if (!wanted)
		return false;
	const candidates = [option.value, ...(option.aliases ?? [])].map(NormalizeFontReference).filter(Boolean);
	return candidates.some((candidate) =>
		candidate === wanted ||
		candidate.endsWith(`/${wanted}`) ||
		wanted.endsWith(`/${candidate}`)
	);
}

function FontValueEditor({ property, options, onCommit }: { property: LayoutProperty; options: FontResourceOption[]; onCommit: (value: string) => void }) {
	const currentValue = StripLayoutQuotes(property.rawValue);
	const matchedOption = options.find((option) => FontOptionMatches(option, currentValue));
	const [manual, setManual] = useState(!matchedOption);
	const [manualValue, setManualValue] = useState(currentValue);

	useEffect(() => {
		const nextValue = StripLayoutQuotes(property.rawValue);
		const match = options.find((option) => FontOptionMatches(option, nextValue));
		setManual(!match);
		setManualValue(nextValue);
	}, [property.rawValue, property.name, options]);

	if (options.length === 0)
		return <EditableValue property={property} onCommit={onCommit} />;

	const selectedValue = manual ? "__custom__" : (matchedOption?.value ?? "__custom__");
	function CommitManual() {
		if (NormalizeFontReference(manualValue) !== NormalizeFontReference(property.rawValue))
			onCommit(QuoteLayoutString(manualValue));
	}

	return (
		<div className="font-property-editor">
			<select
				className="property-select font-property-select"
				value={selectedValue}
				onChange={(event) => {
					if (event.target.value === "__custom__") {
						setManual(true);
						setManualValue(currentValue);
						return;
					}
					setManual(false);
					onCommit(QuoteLayoutString(event.target.value));
				}}
			>
				{options.some((option) => option.source === "project") && (
					<optgroup label="Project fonts">
						{options.filter((option) => option.source === "project").map((option) => <option key={`project:${option.value}`} value={option.value}>{option.label.replace(/ — Project$/, "")}</option>)}
					</optgroup>
				)}
				{options.some((option) => option.source === "dependency") && (
					<optgroup label="Dependency mod fonts">
						{options.filter((option) => option.source === "dependency").map((option) => <option key={`dependency:${option.sourceLabel ?? "dependency"}:${option.value}`} value={option.value}>{option.label}</option>)}
					</optgroup>
				)}
				{options.some((option) => option.source === "vanilla") && (
					<optgroup label="Vanilla DayZ fonts">
						{options.filter((option) => option.source === "vanilla").map((option) => <option key={`vanilla:${option.value}`} value={option.value}>{option.label.replace(/ — Vanilla$/, "")}</option>)}
					</optgroup>
				)}
				<option value="__custom__">Custom / unresolved…</option>
			</select>
			{manual && (
				<input
					className="property-input font-manual-input"
					value={manualValue}
					placeholder="Custom font resource"
					onChange={(event) => setManualValue(event.target.value)}
					onBlur={CommitManual}
					onKeyDown={(event) => {
						if (event.key === "Enter")
							event.currentTarget.blur();
						else if (event.key === "Escape") {
							setManualValue(currentValue);
							event.currentTarget.blur();
						}
					}}
				/>
			)}
			<span className="font-option-hint">{options.length} resolved fonts</span>
		</div>
	);
}

function ParseImageReference(rawValue: string) {
	const value = StripLayoutQuotes(rawValue);
	const match = value.match(/^set:([^\s]+)\s+image:(.+)$/i);
	if (!match)
		return null;
	return { setName: match[1].trim(), imageName: match[2].trim().replace(/^"|"$/g, "") };
}

function ImagePreview({ preview }: { preview?: ResolvedImageResource }) {
	if (!preview)
		return <div className="image-resource-preview missing">?</div>;
	const width = Math.max(1, preview.width);
	const height = Math.max(1, preview.height);
	const atlasWidth = Math.max(width, preview.atlasWidth);
	const atlasHeight = Math.max(height, preview.atlasHeight);
	const xDenom = Math.max(1, atlasWidth - width);
	const yDenom = Math.max(1, atlasHeight - height);
	return (
		<div
			className="image-resource-preview"
			style={{
				backgroundImage: `url(${preview.url})`,
				backgroundSize: `${(atlasWidth / width) * 100}% ${(atlasHeight / height) * 100}%`,
				backgroundPosition: `${(preview.x / xDenom) * 100}% ${(preview.y / yDenom) * 100}%`
			}}
		/>
	);
}

function ImageSetValueEditor({ property, options, onCommit }: { property: LayoutProperty; options: ImageSetResourceOption[]; onCommit: (value: string) => void }) {
	const parsed = ParseImageReference(property.rawValue);
	const matchedSet = parsed ? options.find((option) => option.setName.toLowerCase() === parsed.setName.toLowerCase()) : undefined;
	const matchedImage = parsed && matchedSet ? matchedSet.images.find((image) => image.name.toLowerCase() === parsed.imageName.toLowerCase()) : undefined;
	const [manual, setManual] = useState(!matchedSet || !matchedImage);
	const [manualValue, setManualValue] = useState(StripLayoutQuotes(property.rawValue));
	const [setName, setSetName] = useState(matchedSet?.setName ?? "");
	const [imageName, setImageName] = useState(matchedImage?.name ?? "");

	useEffect(() => {
		const nextParsed = ParseImageReference(property.rawValue);
		const nextSet = nextParsed ? options.find((option) => option.setName.toLowerCase() === nextParsed.setName.toLowerCase()) : undefined;
		const nextImage = nextParsed && nextSet ? nextSet.images.find((image) => image.name.toLowerCase() === nextParsed.imageName.toLowerCase()) : undefined;
		setManual(!nextSet || !nextImage);
		setManualValue(StripLayoutQuotes(property.rawValue));
		setSetName(nextSet?.setName ?? "");
		setImageName(nextImage?.name ?? "");
	}, [property.rawValue, property.name, options]);

	if (options.length === 0)
		return <EditableValue property={property} onCommit={onCommit} />;

	const activeSet = options.find((option) => option.setName === setName);
	const activeImage = activeSet?.images.find((image) => image.name === imageName);
	function Commit(setValue: string, imageValue: string) {
		if (setValue && imageValue)
			onCommit(QuoteLayoutString(`set:${setValue} image:${imageValue}`));
	}

	return (
		<div className="image-property-editor">
			<div className="image-picker-top">
				<ImagePreview preview={activeImage?.preview} />
				<div className="image-picker-selects">
					<select
						className="property-select"
						value={manual ? "__custom__" : setName}
						onChange={(event) => {
							if (event.target.value === "__custom__") {
								setManual(true);
								return;
							}
							const nextSet = options.find((option) => option.setName === event.target.value);
							const nextImage = nextSet?.images[0]?.name ?? "";
							setManual(false);
							setSetName(event.target.value);
							setImageName(nextImage);
							Commit(event.target.value, nextImage);
						}}
					>
						{options.some((option) => option.source === "project") && <optgroup label="Project imagesets">{options.filter((option) => option.source === "project").map((option) => <option key={`project:${option.setName}`} value={option.setName}>{option.setName}</option>)}</optgroup>}
						{options.some((option) => option.source === "dependency") && <optgroup label="Dependency mod imagesets">{options.filter((option) => option.source === "dependency").map((option) => <option key={`dependency:${option.sourceLabel ?? "dependency"}:${option.setName}`} value={option.setName}>{option.setName} — {option.sourceLabel ?? "Dependency"}</option>)}</optgroup>}
						{options.some((option) => option.source === "vanilla") && <optgroup label="Vanilla DayZ imagesets">{options.filter((option) => option.source === "vanilla").map((option) => <option key={`vanilla:${option.setName}`} value={option.setName}>{option.setName}</option>)}</optgroup>}
						<option value="__custom__">Custom / unresolved…</option>
					</select>
					{!manual && activeSet && (
						<select
							className="property-select"
							value={imageName}
							onChange={(event) => {
								setImageName(event.target.value);
								Commit(setName, event.target.value);
							}}
						>
							{activeSet.images.map((image) => <option key={image.name} value={image.name}>{image.name}</option>)}
						</select>
					)}
				</div>
			</div>
			{manual && (
				<input
					className="property-input"
					value={manualValue}
					placeholder="set:ImageSet image:Image"
					onChange={(event) => setManualValue(event.target.value)}
					onBlur={() => {
						if (StripLayoutQuotes(property.rawValue) !== manualValue)
							onCommit(QuoteLayoutString(manualValue));
					}}
					onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
				/>
			)}
			<span className="font-option-hint">{activeSet ? `${activeSet.images.length} images · ${activeSet.source}` : `${options.length} imagesets`}</span>
		</div>
	);
}

function ParseNormalizedColor(rawValue: string) {
	const parts = rawValue.trim().split(/\s+/).map(Number);
	if ((parts.length !== 3 && parts.length !== 4) || parts.some((value) => !Number.isFinite(value) || value < 0 || value > 1))
		return null;
	if (parts.length === 3)
		parts.push(1);
	return parts.map((value) => Math.round(value * 255));
}

function FormatNormalizedByte(value: number) {
	const normalized = Math.max(0, Math.min(255, Math.round(value))) / 255;
	if (normalized === 0 || normalized === 1)
		return String(normalized);
	return normalized.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function ColorValueEditor({ property, onCommit }: { property: LayoutProperty; onCommit: (value: string) => void }) {
	const parsed = ParseNormalizedColor(property.rawValue);
	const [values, setValues] = useState<number[]>(parsed ?? [255, 255, 255, 255]);
	useEffect(() => setValues(ParseNormalizedColor(property.rawValue) ?? [255, 255, 255, 255]), [property.rawValue, property.name]);
	if (!parsed)
		return <EditableValue property={property} onCommit={onCommit} />;

	function Commit(next = values) {
		onCommit(next.map(FormatNormalizedByte).join(" "));
	}
	const hex = `#${values.slice(0, 3).map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
	return (
		<div className="color-property-editor">
			<div className="rgba-inputs">
				{["R", "G", "B", "A"].map((label, index) => (
					<label key={label}><span>{label}</span><input type="number" min={0} max={255} step={1} value={values[index]} onChange={(event) => {
						const next = [...values];
						next[index] = Math.max(0, Math.min(255, Number(event.target.value) || 0));
						setValues(next);
					}} onBlur={() => Commit()} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
				))}
			</div>
			<div className="color-swatch-row">
				<input type="color" value={hex} onChange={(event) => {
					const value = event.target.value;
					const next = [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16), values[3]];
					setValues(next);
					Commit(next);
				}} />
				<span>{values.join(", ")}</span>
			</div>
		</div>
	);
}

function EditableValue({ property, onCommit }: { property: LayoutProperty; onCommit: (value: string) => void }) {
	const [value, setValue] = useState(property.rawValue);
	useEffect(() => setValue(property.rawValue), [property.rawValue, property.name]);

	function Commit() {
		if (value !== property.rawValue)
			onCommit(value);
	}

	return (
		<input
			className="property-input"
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onBlur={Commit}
			onKeyDown={(event) => {
				if (event.key === "Enter")
					event.currentTarget.blur();
				else if (event.key === "Escape") {
					setValue(property.rawValue);
					event.currentTarget.blur();
				}
			}}
		/>
	);
}

function BooleanValueEditor({ property, onCommit }: { property: LayoutProperty; onCommit: (value: string) => void }) {
	const checked = property.rawValue.trim() !== "0" && property.rawValue.trim().toLowerCase() !== "false";
	return <label className="boolean-property-editor"><input type="checkbox" checked={checked} onChange={(event) => onCommit(event.target.checked ? "1" : "0")} /><span>{checked ? "On" : "Off"}</span></label>;
}

function NumberValueEditor({ property, schema, onCommit }: { property: LayoutProperty; schema: WidgetPropertySchema; onCommit: (value: string) => void }) {
	const [value, setValue] = useState(property.rawValue);
	useEffect(() => setValue(property.rawValue), [property.rawValue, property.name]);
	function Commit() {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) { setValue(property.rawValue); return; }
		let next = numeric;
		if (schema.min !== undefined) next = Math.max(schema.min, next);
		if (schema.max !== undefined) next = Math.min(schema.max, next);
		const text = String(next);
		setValue(text);
		if (text !== property.rawValue) onCommit(text);
	}
	return <input className="property-input" type="number" value={value} min={schema.min} max={schema.max} step={schema.step ?? "any"} onChange={(event) => setValue(event.target.value)} onBlur={Commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setValue(property.rawValue); event.currentTarget.blur(); } }} />;
}

function EnumValueEditor({ property, schema, onCommit }: { property: LayoutProperty; schema: WidgetPropertySchema; onCommit: (value: string) => void }) {
	const current = StripLayoutQuotes(property.rawValue);
	const options = schema.options ?? [];
	const known = options.some((value) => value.toLowerCase() === current.toLowerCase());
	return (
		<select className="property-select" value={known ? options.find((value) => value.toLowerCase() === current.toLowerCase()) : "__custom__"} onChange={(event) => { if (event.target.value !== "__custom__") onCommit(event.target.value); }}>
			{options.map((value) => <option key={value} value={value}>{value}</option>)}
			{!known && <option value="__custom__">{current || "Custom / unresolved"}</option>}
		</select>
	);
}


function StyleValueEditor({ property, widgetType, options, onCommit }: { property: LayoutProperty; widgetType: string; options: StyleResourceOption[]; onCommit: (value: string) => void }) {
	const current = StripLayoutQuotes(property.rawValue);
	const normalizedWidget = widgetType.replace(/Class$/i, "").toLowerCase();
	const compatible = options.filter((option) => option.widgetType.replace(/Class$/i, "").toLowerCase() === normalizedWidget);
	const matched = compatible.find((option) => option.name.toLowerCase() === current.toLowerCase());
	return (
		<select className="property-select" value={matched?.name ?? "__custom__"} onChange={(event) => { if (event.target.value !== "__custom__") onCommit(event.target.value); }}>
			{compatible.some((option) => option.source === "project") && <optgroup label="Project styles">{compatible.filter((option) => option.source === "project").map((option) => <option key={`project:${option.widgetType}:${option.name}`} value={option.name}>{option.name}</option>)}</optgroup>}
			{compatible.some((option) => option.source === "dependency") && <optgroup label="Dependency styles">{compatible.filter((option) => option.source === "dependency").map((option) => <option key={`dep:${option.sourceLabel ?? "dependency"}:${option.widgetType}:${option.name}`} value={option.name}>{option.name} — {option.sourceLabel ?? "Dependency"}</option>)}</optgroup>}
			{compatible.some((option) => option.source === "vanilla") && <optgroup label="Vanilla styles">{compatible.filter((option) => option.source === "vanilla").map((option) => <option key={`vanilla:${option.widgetType}:${option.name}`} value={option.name}>{option.name}</option>)}</optgroup>}
			<option value="__custom__">{matched ? "Custom / unresolved…" : (current || "Custom / unresolved…")}</option>
		</select>
	);
}

function PropertyValueEditor({ property, widgetType, fontOptions, imageSetOptions, styleOptions, onCommit }: { property: LayoutProperty; widgetType: string; fontOptions: FontResourceOption[]; imageSetOptions: ImageSetResourceOption[]; styleOptions: StyleResourceOption[]; onCommit: (value: string) => void }) {
	const name = property.name.toLowerCase();
	const schema = FindWidgetPropertySchema(widgetType, property.name);
	if (name === "style")
		return <StyleValueEditor property={property} widgetType={widgetType} options={styleOptions} onCommit={onCommit} />;
	if (name === "font")
		return <FontValueEditor property={property} options={fontOptions} onCommit={onCommit} />;
	if (/^image[0-7]$/.test(name))
		return <ImageSetValueEditor property={property} options={imageSetOptions} onCommit={onCommit} />;
	if (schema?.editor === "color" || name === "color" || name === "shadow color" || name === "outline color" || name === "text color")
		return <ColorValueEditor property={property} onCommit={onCommit} />;
	if (schema?.editor === "boolean")
		return <BooleanValueEditor property={property} onCommit={onCommit} />;
	if (schema?.editor === "number")
		return <NumberValueEditor property={property} schema={schema} onCommit={onCommit} />;
	if (schema?.editor === "enum")
		return <EnumValueEditor property={property} schema={schema} onCommit={onCommit} />;
	return <EditableValue property={property} onCommit={onCommit} />;
}


function PendingKnownPropertyValueEditor({
	propertyName,
	widgetType,
	value,
	onChange,
	fontOptions,
	styleOptions
}: {
	propertyName: string;
	widgetType: string;
	value: string;
	onChange: (value: string) => void;
	fontOptions: FontResourceOption[];
	styleOptions: StyleResourceOption[];
}) {
	const normalizedName = propertyName.toLowerCase();

	if (normalizedName === "style") {
		const normalizedWidget = widgetType.replace(/Class$/i, "").toLowerCase();
		const compatible = styleOptions.filter((option) => option.widgetType.replace(/Class$/i, "").toLowerCase() === normalizedWidget);
		if (compatible.length > 0) {
			const known = compatible.some((option) => option.name === value);
			return (
				<div className="known-property-resource-editor">
					<select className="property-select" value={known ? value : ""} onChange={(event) => onChange(event.target.value)}>
						<option value="" disabled>Choose style…</option>
						{compatible.some((option) => option.source === "project") && <optgroup label="Project styles">{compatible.filter((option) => option.source === "project").map((option) => <option key={`project:${option.widgetType}:${option.name}`} value={option.name}>{option.name}</option>)}</optgroup>}
						{compatible.some((option) => option.source === "dependency") && <optgroup label="Dependency styles">{compatible.filter((option) => option.source === "dependency").map((option) => <option key={`dep:${option.sourceLabel ?? "dependency"}:${option.widgetType}:${option.name}`} value={option.name}>{option.name} — {option.sourceLabel ?? "Dependency"}</option>)}</optgroup>}
						{compatible.some((option) => option.source === "vanilla") && <optgroup label="Vanilla styles">{compatible.filter((option) => option.source === "vanilla").map((option) => <option key={`vanilla:${option.widgetType}:${option.name}`} value={option.name}>{option.name}</option>)}</optgroup>}
					</select>
					<span className="font-option-hint">{compatible.length} compatible styles</span>
				</div>
			);
		}
		return <input placeholder="value" value={value} onChange={(event) => onChange(event.target.value)} title="No compatible style resources are currently loaded." />;
	}

	if (normalizedName === "font" && fontOptions.length > 0) {
		const known = fontOptions.some((option) => option.value === value);
		return (
			<div className="known-property-resource-editor">
				<select className="property-select" value={known ? value : ""} onChange={(event) => onChange(event.target.value)}>
					<option value="" disabled>Choose font…</option>
					{fontOptions.some((option) => option.source === "project") && <optgroup label="Project fonts">{fontOptions.filter((option) => option.source === "project").map((option) => <option key={`project:${option.value}`} value={option.value}>{option.label.replace(/ — Project$/, "")}</option>)}</optgroup>}
					{fontOptions.some((option) => option.source === "dependency") && <optgroup label="Dependency mod fonts">{fontOptions.filter((option) => option.source === "dependency").map((option) => <option key={`dependency:${option.sourceLabel ?? "dependency"}:${option.value}`} value={option.value}>{option.label}</option>)}</optgroup>}
					{fontOptions.some((option) => option.source === "vanilla") && <optgroup label="Vanilla DayZ fonts">{fontOptions.filter((option) => option.source === "vanilla").map((option) => <option key={`vanilla:${option.value}`} value={option.value}>{option.label.replace(/ — Vanilla$/, "")}</option>)}</optgroup>}
				</select>
				<span className="font-option-hint">{fontOptions.length} resolved fonts</span>
			</div>
		);
	}

	return <input placeholder="value" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function CustomPropertyAdder({ node, onAddProperty }: { node: LayoutNode; onAddProperty: (node: LayoutNode, propertyName: string, rawValue: string) => void }) {
	const [name, setName] = useState("");
	const [value, setValue] = useState("");
	return (
		<div className="add-property-row">
			<input placeholder="property" value={name} onChange={(event) => setName(event.target.value)} />
			<input placeholder="value" value={value} onChange={(event) => setValue(event.target.value)} />
			<button disabled={!name.trim()} onClick={() => { onAddProperty(node, name.trim(), value); setName(""); setValue(""); }}>Add</button>
		</div>
	);
}

export function PropertyInspector({ node, onRename, onPropertyChange, onAddProperty, onDeleteProperty, fontOptions, imageSetOptions, styleOptions }: PropertyInspectorProps) {
	const [editName, setEditName] = useState(node?.name ?? "");
	const [newName, setNewName] = useState("");
	const [newValue, setNewValue] = useState("");
	useEffect(() => setEditName(node?.name ?? ""), [node?.id, node?.name]);
	useEffect(() => {
		setNewName("");
		setNewValue("");
	}, [node?.id]);
	if (!node)
		return <div className="empty-panel">Select a widget.</div>;

	const schema = GetWidgetSchema(node.type);
	const existingNames = new Set(node.properties.map((property) => property.name.toLowerCase()));
	const availableProperties = schema.filter((property) => !existingNames.has(property.name.toLowerCase()));
	const Editor = (property: LayoutProperty) => <PropertyValueEditor property={property} widgetType={node.type} fontOptions={fontOptions} imageSetOptions={imageSetOptions} styleOptions={styleOptions} onCommit={(value) => onPropertyChange(node, property.name, value)} />;
	const Label = (property: LayoutProperty) => {
		const definition = FindWidgetPropertySchema(node.type, property.name);
		return <label title={definition?.description ?? property.name}>{definition?.label ?? property.name}{definition?.source !== "layout-studio" && <span className="schema-source-dot" title={definition?.source === "workbench" ? "Property metadata recovered from Workbench" : definition?.source === "api" ? "Property supported by Bohemia widget API / flags" : "Property verified in real DayZ ImageWidget layouts"}>●</span>}</label>;
	};
	return (
		<div className="inspector">
			<div className="inspector-heading">
				<input
					className="widget-name-input"
					value={editName}
					onChange={(event) => setEditName(event.target.value)}
					onBlur={() => onRename(node, editName)}
					onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setEditName(node.name); event.currentTarget.blur(); } }}
				/>
				<span>{node.type}</span>
				<span>line {node.line}</span>
			</div>
			{(() => {
				const categoryOrder = ["Common", "Layout", "Appearance", "Text", "Image", "Button", "Behavior", "Navigation", "Content Layout", "Scroll", "Slider", "Advanced"];
				const buckets = new Map<string, LayoutProperty[]>();
				for (const property of node.properties) {
					const definition = FindWidgetPropertySchema(node.type, property.name);
					let category = definition?.category;
					if (!category) {
						const legacyGroup = groups.find((group) => group.properties.some((name) => name.toLowerCase() === property.name.toLowerCase()));
						category = legacyGroup?.title ?? "Advanced";
					}
					const rows = buckets.get(category) ?? [];
					rows.push(property);
					buckets.set(category, rows);
				}
				return [...buckets.entries()].sort(([a], [b]) => {
					const ai = categoryOrder.indexOf(a);
					const bi = categoryOrder.indexOf(b);
					return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
				}).map(([category, rows]) => (
					<section className="property-group" key={category}>
						<div className="property-group-title">{category}</div>
						{rows.map((property, index) => (
							<div className="property-row" key={`${property.name}-${index}`}>
								{Label(property)}
								{Editor(property)}
								<button className="property-delete" title={`Delete ${property.name}`} onClick={() => onDeleteProperty(node, property.name)}>×</button>
							</div>
						))}
					</section>
				));
			})()}
			<section className="property-group add-property-group">
				<div className="property-group-title">Add known property <span className="schema-count">{schema.length} known for {node.type}</span></div>
				<div className="add-property-row schema-add-row">
					<select value={newName} onChange={(event) => {
						const name = event.target.value;
						setNewName(name);
						const definition = availableProperties.find((property) => property.name === name);
						setNewValue(definition?.defaultValue ?? (definition?.editor === "boolean" ? "0" : definition?.editor === "color" ? "1 1 1 1" : definition?.editor === "enum" ? (definition.options?.[0] ?? "") : ""));
					}}>
						<option value="">Choose property…</option>
						{Array.from(new Set(availableProperties.map((property) => property.category))).map((category) => (
							<optgroup key={category} label={category}>
								{availableProperties.filter((property) => property.category === category).map((property) => <option key={property.name} value={property.name}>{property.label ?? property.name}</option>)}
							</optgroup>
						))}
					</select>
					<PendingKnownPropertyValueEditor
						propertyName={newName}
						widgetType={node.type}
						value={newValue}
						onChange={setNewValue}
						fontOptions={fontOptions}
						styleOptions={styleOptions}
					/>
					<button disabled={!newName.trim() || ((newName.toLowerCase() === "style" || newName.toLowerCase() === "font") && !newValue.trim())} onClick={() => {
						const normalizedName = newName.toLowerCase();
						const rawValue = normalizedName === "font" ? QuoteLayoutString(StripLayoutQuotes(newValue)) : newValue;
						onAddProperty(node, newName.trim(), rawValue);
						setNewName("");
						setNewValue("");
					}}>Add</button>
				</div>
				<div className="property-group-title custom-property-title">Custom property</div>
				<CustomPropertyAdder node={node} onAddProperty={onAddProperty} />
			</section>
		</div>
	);
}
