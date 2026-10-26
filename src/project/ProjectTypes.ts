import type { BitmapFontDefinition } from "./FntParser";

export interface ProjectFile {
	path: string;
	name: string;
	extension: string;
	file: File;
}

export interface ImageSetImage {
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	flags: number;
}

export interface ImageSetDefinition {
	name: string;
	path: string;
	texturePath: string | null;
	refWidth: number;
	refHeight: number;
	images: Map<string, ImageSetImage>;
}

export interface WidgetStyleDefinition {
	name: string;
	widgetType: string;
	font: string | null;
	imageSet: string | null;
	color: number | null;
	/** All style states keyed by lower-case state name (normal, focus, disabled, etc.). */
	states: Map<string, Map<string, string>>;
	/** Compatibility alias for the Normal state used by older renderer paths. */
	normalItems: Map<string, string>;
	sourcePath: string;
}

export interface ProjectWorkspaceModel {
	name: string;
	files: ProjectFile[];
	filesByPath: Map<string, ProjectFile>;
	imageSets: Map<string, ImageSetDefinition>;
	imageSetAliases: Map<string, ImageSetDefinition>;
	widgetStyles: Map<string, WidgetStyleDefinition[]>;
	fontFamilies: Map<string, string>;
	bitmapFonts: Map<string, BitmapFontDefinition>;
	fontObjectUrls: string[];
	resourceObjectUrls: Map<string, string>;
	eddsDecoded: Set<string>;
	eddsFailed: Map<string, string>;
}

export interface ResolvedImageResource {
	url: string;
	x: number;
	y: number;
	width: number;
	height: number;
	atlasWidth: number;
	atlasHeight: number;
}
