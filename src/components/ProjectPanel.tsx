import { useMemo, useState } from "react";
import type { ProjectFile, ProjectWorkspaceModel } from "../project/ProjectTypes";

interface ProjectPanelProps {
	project: ProjectWorkspaceModel | null;
	activePath: string | null;
	onOpenFile: (file: ProjectFile) => void;
	onConvertTexture?: (file: ProjectFile) => void;
}

interface TreeItem {
	name: string;
	path: string;
	children: TreeItem[];
	file?: ProjectFile;
}

function BuildTree(files: ProjectFile[]): TreeItem[] {
	const root: TreeItem = { name: "", path: "", children: [] };
	for (const file of files) {
		const parts = file.path.split("/").filter(Boolean);
		let current = root;
		let path = "";
		for (let i = 0; i < parts.length; ++i) {
			const part = parts[i];
			path = path ? `${path}/${part}` : part;
			let child = current.children.find((item) => item.name === part);
			if (!child) {
				child = { name: part, path, children: [] };
				current.children.push(child);
			}
			current = child;
			if (i === parts.length - 1)
				current.file = file;
		}
	}
	const Sort = (items: TreeItem[]) => {
		items.sort((a, b) => {
			const aFolder = !a.file;
			const bFolder = !b.file;
			if (aFolder !== bFolder)
				return aFolder ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
		for (const item of items)
			Sort(item.children);
	};
	Sort(root.children);
	return root.children;
}

function IconFor(item: TreeItem) {
	if (!item.file)
		return "▸";
	switch (item.file.extension) {
		case ".layout": return "◇";
		case ".imageset": return "▧";
		case ".styles": return "◫";
		case ".edds": return "▩";
		case ".ttf": case ".otf": case ".woff": case ".woff2": return "T";
		default: return "·";
	}
}

function ProjectTreeItem({ item, activePath, onOpenFile, onConvertTexture }: { item: TreeItem; activePath: string | null; onOpenFile: (file: ProjectFile) => void; onConvertTexture?: (file: ProjectFile) => void }) {
	const isFolder = !item.file;
	const [expanded, setExpanded] = useState(item.path.split("/").length <= 2);
	const isActive = item.file?.path === activePath;
	return (
		<div className="project-node">
			<button
				className={isActive ? "project-row selected" : "project-row"}
				onClick={() => {
					if (isFolder)
						setExpanded((value) => !value);
					else if (item.file)
						onOpenFile(item.file);
				}}
				onContextMenu={(event) => {
					if (!item.file || ![".png", ".tga"].includes(item.file.extension) || !onConvertTexture)
						return;
					event.preventDefault();
					onConvertTexture(item.file);
				}}
				title={item.file && [".png", ".tga"].includes(item.file.extension) ? `${item.path} · Right-click to convert to EDDS` : item.path}
			>
				<span className={`project-icon ${isFolder && expanded ? "expanded" : ""}`}>{isFolder ? "▸" : IconFor(item)}</span>
				<span className="project-name">{item.name}</span>
			</button>
			{isFolder && expanded && item.children.length > 0 && (
				<div className="project-children">
					{item.children.map((child) => <ProjectTreeItem key={child.path} item={child} activePath={activePath} onOpenFile={onOpenFile} onConvertTexture={onConvertTexture} />)}
				</div>
			)}
		</div>
	);
}

export function ProjectPanel({ project, activePath, onOpenFile, onConvertTexture }: ProjectPanelProps) {
	const tree = useMemo(() => BuildTree(project?.files ?? []), [project]);
	if (!project)
		return <div className="empty-panel project-empty">Open a project folder to index layouts, imagesets, textures, fonts, and styles.</div>;
	return (
		<div className="project-tree">
			<div className="project-root-row"><span className="project-root-icon">◆</span><strong>{project.name}</strong></div>
			{tree.map((item) => <ProjectTreeItem key={item.path} item={item} activePath={activePath} onOpenFile={onOpenFile} onConvertTexture={onConvertTexture} />)}
		</div>
	);
}
