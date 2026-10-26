export type PropertyEditorKind = "text" | "boolean" | "number" | "enum" | "color" | "font" | "image";

export interface WidgetPropertySchema {
	name: string;
	label?: string;
	description?: string;
	category: string;
	editor: PropertyEditorKind;
	options?: string[];
	min?: number;
	max?: number;
	step?: number;
	defaultValue?: string;
	source: "workbench" | "api" | "verified-layout" | "layout-studio";
}

const Common: WidgetPropertySchema[] = [
	{ name: "visible", label: "Visible", category: "Common", editor: "boolean", defaultValue: "1", source: "workbench" },
	{ name: "disabled", label: "Disabled", category: "Common", editor: "boolean", defaultValue: "0", source: "api" },
	{ name: "clipchildren", label: "Clip children", category: "Common", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "inheritalpha", label: "Inherits alpha from parent", category: "Common", editor: "boolean", defaultValue: "1", source: "workbench" },
	{ name: "ignorepointer", label: "Ignore mouse pointer", category: "Common", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "ignoregloballv", label: "Ignore global LV", category: "Common", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "keepsafezone", label: "Keep aligned in safe zone", category: "Layout", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "position", label: "Position", category: "Layout", editor: "text", defaultValue: "0 0", source: "workbench" },
	{ name: "size", label: "Size", category: "Layout", editor: "text", defaultValue: "1 1", source: "layout-studio" },
	{ name: "halign", label: "Horizontal alignment", category: "Layout", editor: "enum", options: ["left_ref", "center_ref", "right_ref"], source: "workbench" },
	{ name: "valign", label: "Vertical alignment", category: "Layout", editor: "enum", options: ["top_ref", "center_ref", "bottom_ref"], source: "workbench" },
	{ name: "hexactpos", label: "Use physical coordinates (horizontal)", category: "Layout", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "vexactpos", label: "Use physical coordinates (vertical)", category: "Layout", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "hexactsize", label: "Use physical extents (horizontal)", category: "Layout", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "vexactsize", label: "Use physical extents (vertical)", category: "Layout", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "scaled", label: "Recalculate dimensions to relative resolution", category: "Layout", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "fixaspect", label: "Keep the same aspect", category: "Layout", editor: "enum", options: ["inside", "outside", "fixwidth"], source: "workbench" },
	{ name: "priority", label: "Priority", category: "Common", editor: "number", step: 1, source: "workbench" },
	{ name: "userID", label: "User ID", category: "Common", editor: "number", step: 1, source: "workbench" },
	{ name: "draggable", label: "Can be dragged", category: "Behavior", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "scriptclass", label: "User script class", category: "Behavior", editor: "text", source: "workbench" },
	{ name: "style", label: "Style", category: "Appearance", editor: "text", source: "workbench" },
	{ name: "color", label: "Color", category: "Appearance", editor: "color", defaultValue: "1 1 1 1", source: "layout-studio" }
];

const Text: WidgetPropertySchema[] = [
	{ name: "text", label: "Text", category: "Text", editor: "text", source: "layout-studio" },
	{ name: "font", label: "Font", category: "Text", editor: "font", source: "workbench" },
	{ name: "text color", label: "Text color", category: "Text", editor: "color", source: "workbench" },
	{ name: "text offset", label: "Text offset", category: "Text", editor: "text", source: "workbench" },
	{ name: "text spacing", label: "Text spacing", category: "Text", editor: "text", source: "workbench" },
	{ name: "outline size", label: "Outline size", category: "Text", editor: "number", min: 0, step: 1, source: "workbench" },
	{ name: "outline color", label: "Outline color", category: "Text", editor: "color", source: "workbench" },
	{ name: "shadow size", label: "Shadow size", category: "Text", editor: "number", min: 0, step: 1, source: "workbench" },
	{ name: "shadow color", label: "Shadow color", category: "Text", editor: "color", source: "workbench" },
	{ name: "shadow offset", label: "Shadow offset", category: "Text", editor: "text", source: "workbench" },
	{ name: "shadow opacity", label: "Shadow opacity", category: "Text", editor: "number", min: 0, max: 1, step: 0.01, source: "workbench" },
	{ name: "italic text", label: "Italic text", category: "Text", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "bold text", label: "Bold text", category: "Text", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "text sharpness", label: "Text sharpness", category: "Text", editor: "number", min: 0, max: 3, step: 0.01, source: "workbench" },
	{ name: "exact text", label: "Disable text scaling", category: "Text", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "exact text size", label: "Text size", description: "0 equals original size", category: "Text", editor: "number", min: 0, max: 1000, step: 1, source: "workbench" },
	{ name: "text_proportion", label: "Text proportion of height", category: "Text", editor: "number", source: "workbench" },
	{ name: "size to text h", label: "Size to text horizontally", category: "Text", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "size to text v", label: "Size to text vertically", category: "Text", editor: "boolean", defaultValue: "0", source: "workbench" },
	{ name: "text halign", label: "Text horizontal alignment", category: "Text", editor: "enum", options: ["left", "center", "right"], source: "api" },
	{ name: "text valign", label: "Text vertical alignment", category: "Text", editor: "enum", options: ["top", "center", "bottom"], source: "api" }
];

const Multiline: WidgetPropertySchema[] = [
	{ name: "wrap", label: "Wrap text at the end of line", category: "Text", editor: "boolean", source: "workbench" },
	{ name: "condense whitespace", label: "Condense whitespace", category: "Text", editor: "boolean", source: "workbench" },
	{ name: "strip newlines", label: "Strip new lines", category: "Text", editor: "boolean", source: "workbench" },
	{ name: "lines", label: "Line count", category: "Text", editor: "number", min: 0, step: 1, source: "workbench" },
	{ name: "limit visible", label: "Limit text to visible area", category: "Text", editor: "boolean", source: "workbench" },
	{ name: "content offset", label: "Content offset", category: "Text", editor: "number", min: -9999, max: 9999, step: 1, source: "workbench" }
];

const Image: WidgetPropertySchema[] = [
	...Array.from({ length: 8 }, (_, index): WidgetPropertySchema => ({ name: `image${index}`, label: `Image ${index}`, category: "Image", editor: "image", source: index === 0 ? "workbench" : "layout-studio" })),
	{ name: "imageTexture", label: "Image texture", category: "Image", editor: "text", source: "workbench" },
	{ name: "nocache", label: "No cache", category: "Image", editor: "boolean", source: "workbench" },
	{ name: "mode", label: "Render mode", description: "Verified on ImageWidget layouts; values align with texture blend behavior.", category: "Image Rendering", editor: "enum", options: ["blend", "additive", "opaque"], source: "verified-layout" },
	{ name: "src alpha", label: "Source alpha", description: "Backed by Bohemia WidgetFlags.SOURCEALPHA and verified ImageWidget layout usage.", category: "Image Rendering", editor: "boolean", source: "api" },
	{ name: "no wrap", label: "No texture wrapping", description: "Backed by Bohemia WidgetFlags.NOWRAP and verified ImageWidget layout usage.", category: "Image Rendering", editor: "boolean", source: "api" },
	{ name: "clamp mode", label: "UV edge behaviour", description: "Verified on ImageWidget layouts.", category: "Image Rendering", editor: "enum", options: ["wrap", "clamp", "border"], source: "verified-layout" },
	{ name: "stretch", label: "Stretch", description: "Backed by Bohemia WidgetFlags.STRETCH and verified ImageWidget layout usage.", category: "Image Rendering", editor: "boolean", source: "api" },
	{ name: "stretch mode", label: "Stretch mode", description: "Verified on ImageWidget layouts; option strings are also present in Workbench metadata.", category: "Image Rendering", editor: "enum", options: ["stretch_w_h", "stretch_w", "stretch_h", "stretch_w_center", "stretch_h_center", "fit_w", "fit_h", "fit_w_center", "fit_h_center"], source: "verified-layout" },
	{ name: "flip u", label: "Flip U", description: "Backed by Bohemia WidgetFlags.FLIPU.", category: "Image Rendering", editor: "boolean", source: "api" },
	{ name: "flip v", label: "Flip V", description: "Backed by Bohemia WidgetFlags.FLIPV.", category: "Image Rendering", editor: "boolean", source: "api" },
	{ name: "filter", label: "Texture filtering", description: "Verified on ImageWidget layouts. Bohemia exposes the complementary WidgetFlags.NOFILTER flag.", category: "Image Rendering", editor: "boolean", source: "verified-layout" },
	{ name: "Rotation", label: "Rotation", category: "Image", editor: "text", defaultValue: "0 0 0", source: "workbench" },
	{ name: "pivot", label: "Pivot", category: "Image", editor: "text", defaultValue: "0.5 0.5", source: "workbench" },
	{ name: "Mask", label: "Mask texture", description: "Mask texture for alpha masking. Data in red channel.", category: "Image", editor: "text", source: "workbench" },
	{ name: "Transition width", label: "Transition width", description: "Softness of the transition", category: "Image", editor: "number", source: "workbench" },
	{ name: "Progress", label: "Progress", description: "Progress of the alpha masking", category: "Image", editor: "number", source: "workbench" }
];

const Button: WidgetPropertySchema[] = [
	{ name: "text_offset", label: "Caption text offset", category: "Button", editor: "text", source: "workbench" },
	{ name: "text_halign", label: "Caption horizontal alignment", category: "Button", editor: "enum", options: ["left", "center", "right"], source: "api" },
	{ name: "text_valign", label: "Caption vertical alignment", category: "Button", editor: "enum", options: ["top", "center", "bottom"], source: "api" },
	{ name: "switch", label: "Switch type", category: "Button", editor: "enum", options: ["normal", "once", "toggle"], source: "workbench" }
];

const Spacer: WidgetPropertySchema[] = [
	{ name: "Padding", label: "Outer margin", category: "Content Layout", editor: "number", min: 0, max: 10000, step: 1, source: "workbench" },
	{ name: "Margin", label: "Padding between elements", category: "Content Layout", editor: "number", min: 0, max: 10000, step: 1, source: "workbench" },
	{ name: "Size To Content H", label: "Size to content horizontally", category: "Content Layout", editor: "boolean", source: "workbench" },
	{ name: "Size To Content V", label: "Size to content vertically", category: "Content Layout", editor: "boolean", source: "workbench" },
	{ name: "content_halign", label: "Horizontal content alignment", category: "Content Layout", editor: "enum", options: ["left", "center", "right"], source: "api" },
	{ name: "content_valign", label: "Vertical content alignment", category: "Content Layout", editor: "enum", options: ["top", "center", "bottom"], source: "api" },
	{ name: "Ignore invisible", label: "Spacing ignores invisible widgets", category: "Content Layout", editor: "boolean", source: "workbench" }
];

const GridSpacer: WidgetPropertySchema[] = [
	{ name: "Columns", label: "Number of columns", category: "Content Layout", editor: "number", min: 1, max: 100, step: 1, source: "workbench" },
	{ name: "Rows", label: "Number of rows", category: "Content Layout", editor: "number", min: 1, max: 100, step: 1, source: "workbench" }
];

const Scroll: WidgetPropertySchema[] = [
	{ name: "Scrollbar H", label: "Show horizontal scrollbar", category: "Scroll", editor: "boolean", source: "workbench" },
	{ name: "Scrollbar V", label: "Show vertical scrollbar", category: "Scroll", editor: "boolean", source: "workbench" },
	{ name: "Scrollbar V Left", label: "Show vertical scrollbar on left", category: "Scroll", editor: "boolean", source: "workbench" }
];

const CheckBox: WidgetPropertySchema[] = [
	{ name: "no focus", label: "Won't get focus", category: "Behavior", editor: "boolean", source: "workbench" },
	{ name: "next left", label: "Left neighbor", category: "Navigation", editor: "text", source: "workbench" },
	{ name: "next right", label: "Right neighbor", category: "Navigation", editor: "text", source: "workbench" },
	{ name: "next up", label: "Up neighbor", category: "Navigation", editor: "text", source: "workbench" },
	{ name: "next down", label: "Down neighbor", category: "Navigation", editor: "text", source: "workbench" }
];



const TextListbox: WidgetPropertySchema[] = [
	{ name: "font", label: "Font", category: "Listbox Text", editor: "font", source: "workbench" },
	{ name: "Title", label: "Title", category: "Listbox", editor: "text", source: "workbench" },
	{ name: "title visible", label: "Title visibility", category: "Listbox", editor: "boolean", source: "workbench" },
	{ name: "title proportion", label: "Title text size proportion", category: "Listbox", editor: "number", min: 0, max: 1, step: 0.1, source: "workbench" },
	{ name: "disabled text color", label: "Disabled text color", category: "Listbox Text", editor: "color", source: "workbench" },
	{ name: "text outline size", label: "Text outline size", category: "Listbox Text", editor: "number", min: 0, step: 1, source: "workbench" },
	{ name: "text outline color", label: "Text outline color", category: "Listbox Text", editor: "color", source: "workbench" },
	{ name: "text shadow size", label: "Text shadow size", category: "Listbox Text", editor: "number", min: 0, step: 1, source: "workbench" },
	{ name: "text shadow color", label: "Text shadow color", category: "Listbox Text", editor: "color", source: "workbench" },
	{ name: "text shadow offset", label: "Text shadow offset", category: "Listbox Text", editor: "text", source: "workbench" },
	{ name: "text shadow opacity", label: "Text shadow opacity", category: "Listbox Text", editor: "number", min: 0, max: 1, step: 0.01, source: "workbench" },
	{ name: "colums", label: "Column titles and widths", description: "Workbench serializes this property as 'colums' (sic). Format: Title1;100;Title2;200", category: "Listbox", editor: "text", source: "workbench" },
	{ name: "highlight row", label: "Highlight full row", category: "Listbox", editor: "boolean", source: "workbench" }
];

const Video: WidgetPropertySchema[] = [
	{ name: "mode", label: "Render mode", category: "Video", editor: "enum", options: ["opaque", "additive"], source: "workbench" },
	{ name: "src alpha", label: "Alpha from texture", category: "Video", editor: "boolean", source: "workbench" },
	{ name: "no wrap", label: "No UV wrap", category: "Video", editor: "number", min: -1, max: 1, step: 1, source: "workbench" },
	{ name: "clamp mode", label: "UV edge behaviour", category: "Video", editor: "enum", options: ["wrap", "clamp", "border"], source: "workbench" },
	{ name: "stretch", label: "Stretch", category: "Video", editor: "boolean", source: "workbench" },
	{ name: "stretch mode", label: "Stretch mode", category: "Video", editor: "enum", options: ["stretch_w_h", "stretch_w", "stretch_h", "stretch_w_center", "stretch_h_center", "fit_w", "fit_h", "fit_w_center", "fit_h_center"], source: "workbench" },
	{ name: "flip u", label: "Flip U", category: "Video", editor: "boolean", source: "workbench" },
	{ name: "flip v", label: "Flip V", category: "Video", editor: "boolean", source: "workbench" }
];

const RTTexture: WidgetPropertySchema[] = [
	{ name: "render always", label: "Render always", category: "Render Target", editor: "boolean", source: "workbench" },
	{ name: "noclear", label: "Do not clear", category: "Render Target", editor: "boolean", source: "workbench" },
	{ name: "sRGB", label: "sRGB", category: "Render Target", editor: "boolean", source: "workbench" }
];

const RenderTarget: WidgetPropertySchema[] = [
	{ name: "camera", label: "Camera", category: "Render Target", editor: "number", step: 1, source: "workbench" },
	{ name: "refresh", label: "Refresh", category: "Render Target", editor: "text", source: "workbench" },
	{ name: "xscale", label: "Resolution scale X", category: "Render Target", editor: "number", source: "api" },
	{ name: "yscale", label: "Resolution scale Y", category: "Render Target", editor: "number", source: "api" }
];

const VideoSubtitles: WidgetPropertySchema[] = [
	{ name: "font", label: "Subtitle font", category: "Video Subtitles", editor: "font", source: "workbench" },
	{ name: "text color", label: "Subtitle text color", category: "Video Subtitles", editor: "color", source: "workbench" },
	{ name: "outline size", label: "Subtitle outline size", category: "Video Subtitles", editor: "number", min: 0, step: 1, source: "workbench" },
	{ name: "outline color", label: "Subtitle outline color", category: "Video Subtitles", editor: "color", source: "workbench" },
	{ name: "text offset", label: "Subtitle text offset", category: "Video Subtitles", editor: "text", source: "workbench" },
	{ name: "text background", label: "Subtitle text background", category: "Video Subtitles", editor: "boolean", source: "workbench" },
	{ name: "background color", label: "Subtitle background color", category: "Video Subtitles", editor: "color", source: "workbench" }
];

const ButtonItems: WidgetPropertySchema[] = [
	{ name: "itemspacer", label: "Item spacer", category: "Button", editor: "number", source: "workbench" },
	{ name: "itemoffsetleft", label: "Item offset left", category: "Button", editor: "number", source: "workbench" },
	{ name: "itemoffsettop", label: "Item offset top", category: "Button", editor: "number", source: "workbench" }
];

const ProgressBar: WidgetPropertySchema[] = [
	{ name: "minimum", label: "Minimum", category: "Progress", editor: "number", source: "workbench" },
	{ name: "maximum", label: "Maximum", category: "Progress", editor: "number", source: "workbench" },
	{ name: "current", label: "Current", category: "Progress", editor: "number", source: "workbench" },
	{ name: "vertical", label: "Vertical orientation", category: "Progress", editor: "boolean", source: "workbench" },
	{ name: "flipped", label: "Flipped direction", category: "Progress", editor: "boolean", source: "workbench" }
];

const Slider: WidgetPropertySchema[] = [
	{ name: "minimum", label: "Minimum", category: "Slider", editor: "number", source: "workbench" },
	{ name: "maximum", label: "Maximum", category: "Slider", editor: "number", source: "workbench" },
	{ name: "current", label: "Current", category: "Slider", editor: "number", source: "workbench" },
	{ name: "step", label: "Step", category: "Slider", editor: "number", source: "workbench" },
	{ name: "flipped", label: "Flipped direction", category: "Slider", editor: "boolean", source: "workbench" },
	{ name: "marker thickness", label: "Marker thickness", description: "Percent of total slider length", category: "Slider", editor: "number", source: "workbench" },
	{ name: "fill in", label: "Fill in", category: "Slider", editor: "boolean", source: "workbench" },
	{ name: "draw marker", label: "Draw marker", category: "Slider", editor: "boolean", source: "workbench" },
	{ name: "listen to input", label: "Listen to user input", category: "Slider", editor: "boolean", source: "workbench" }
];

function Merge(...sets: WidgetPropertySchema[][]) {
	const result = new Map<string, WidgetPropertySchema>();
	for (const set of sets)
		for (const property of set)
			result.set(property.name.toLowerCase(), property);
	return [...result.values()];
}

export function GetWidgetSchema(widgetType: string): WidgetPropertySchema[] {
	const type = widgetType.toLowerCase();
	const sets: WidgetPropertySchema[][] = [Common];
	if (type.includes("textwidget") || type.includes("editboxwidget") || type.includes("buttonwidget") || type.includes("checkboxwidget"))
		sets.push(Text);
	if (type.includes("multilinetextwidget") || type.includes("multilineeditboxwidget") || type.includes("richtextwidget"))
		sets.push(Multiline);
	if (type.includes("imagewidget"))
		sets.push(Image);
	if (type.includes("textlistboxwidget"))
		sets.push(TextListbox);
	if (type.includes("videowidget"))
		sets.push(Video, VideoSubtitles);
	if (type.includes("buttonwidget"))
		sets.push(Button, ButtonItems);
	if (type.includes("spacerwidget") || type.includes("scrollwidget"))
		sets.push(Spacer);
	if (type.includes("gridspacerwidget"))
		sets.push(GridSpacer);
	if (type.includes("scrollwidget"))
		sets.push(Scroll);
	if (type.includes("checkboxwidget"))
		sets.push(CheckBox);
	if (type.includes("sliderwidget"))
		sets.push(Slider);
	if (type.includes("progressbarwidget"))
		sets.push(ProgressBar);
	if (type.includes("rttexturewidget"))
		sets.push(RTTexture);
	if (type.includes("rendertargetwidget"))
		sets.push(RenderTarget);
	return Merge(...sets);
}

export function FindWidgetPropertySchema(widgetType: string, propertyName: string) {
	return GetWidgetSchema(widgetType).find((property) => property.name.toLowerCase() === propertyName.toLowerCase());
}


export function FindPropertyOwners(propertyName: string): string[] {
	const normalized = propertyName.toLowerCase();
	const candidates = [
		"FrameWidgetClass", "PanelWidgetClass", "TextWidgetClass", "RichTextWidgetClass",
		"MultilineTextWidgetClass", "ButtonWidgetClass", "ImageWidgetClass", "EditBoxWidgetClass",
		"MultilineEditBoxWidgetClass", "PasswordEditBoxWidgetClass", "XComboBoxWidgetClass",
		"ComboBoxWidgetClass", "CheckBoxWidgetClass", "SliderWidgetClass",
		"SimpleProgressBarWidgetClass", "ProgressBarWidgetClass", "BaseListboxWidgetClass",
		"SimpleListboxWidgetClass", "TextListboxWidgetClass", "GenericListboxWidgetClass",
		"VideoWidgetClass", "RTTextureWidgetClass", "RenderTargetWidgetClass", "CanvasWidgetClass", "ConsoleWidgetClass", "ContentWidgetClass", "UniversalListboxWidgetClass", "SpacerWidgetClass", "GridSpacerWidgetClass", "WrapSpacerWidgetClass", "ScrollWidgetClass"
	];
	return candidates.filter((type) => GetWidgetSchema(type).some((property) => property.name.toLowerCase() === normalized));
}
