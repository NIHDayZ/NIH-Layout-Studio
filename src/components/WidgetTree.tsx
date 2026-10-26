import { useState, type DragEvent, type MouseEvent } from "react";
import type { LayoutNode } from "../model/LayoutTypes";

interface WidgetTreeProps {
	nodes: LayoutNode[];
	selected: LayoutNode | null;
	selectedIds: string[];
	onSelect: (node: LayoutNode, additive?: boolean) => void;
	onReparent: (nodeId: string, targetId: string) => void;
	onMove: (nodeId: string, direction: -1 | 1) => void;
	onCopy: (node: LayoutNode) => void;
	onPasteChild: (node: LayoutNode) => void;
	onDuplicate: (node: LayoutNode) => void;
	onDelete: (node: LayoutNode) => void;
}

interface TreeNodeProps extends Omit<WidgetTreeProps, "nodes"> {
	node: LayoutNode;
}

function TreeNode({ node, selected, selectedIds, onSelect, onReparent, onMove, onCopy, onPasteChild, onDuplicate, onDelete }: TreeNodeProps) {
	const [dragOver, setDragOver] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const isPrimary = selected?.id === node.id;
	const isSelected = selectedIds.includes(node.id);

	function Drop(event: DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		setDragOver(false);
		const nodeId = event.dataTransfer.getData("text/nih-layout-node");
		if (nodeId && nodeId !== node.id)
			onReparent(nodeId, node.id);
	}

	function Select(event: MouseEvent<HTMLButtonElement>) {
		onSelect(node, event.ctrlKey || event.metaKey);
	}

	return (
		<div className="tree-node">
			<div className={`${isPrimary ? "tree-row selected" : isSelected ? "tree-row multi-selected" : "tree-row"}${dragOver ? " drag-over" : ""}`}>
				<button
					className="tree-row-main"
					draggable
					onClick={Select}
					onDragStart={(event) => { event.dataTransfer.setData("text/nih-layout-node", node.id); event.dataTransfer.effectAllowed = "move"; }}
					onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOver(true); }}
					onDragLeave={() => setDragOver(false)}
					onDrop={Drop}
					title="Ctrl-click for multi-select. Drag onto another widget to reparent."
				>
					<span className="tree-type">{node.type.replace(/Class$/, "")}</span>
					<span className="tree-name">{node.name}</span>
				</button>
				<div className="tree-row-actions">
					<button
						className="tree-order-menu-button"
						title="Widget actions"
						onClick={(event) => { event.stopPropagation(); onSelect(node); setMenuOpen((open) => !open); }}
					>☰</button>
					{menuOpen && (
						<div className="tree-order-menu" onMouseLeave={() => setMenuOpen(false)}>
							<button onClick={() => { onMove(node.id, -1); setMenuOpen(false); }}>Move Up</button>
							<button onClick={() => { onMove(node.id, 1); setMenuOpen(false); }}>Move Down</button>
							<div className="tree-menu-separator" />
							<button onClick={() => { onCopy(node); setMenuOpen(false); }}>Copy</button>
							<button onClick={() => { onPasteChild(node); setMenuOpen(false); }}>Paste Child</button>
							<button onClick={() => { onDuplicate(node); setMenuOpen(false); }}>Duplicate</button>
							<button className="danger" onClick={() => { onDelete(node); setMenuOpen(false); }}>Delete</button>
						</div>
					)}
				</div>
			</div>
			{node.children.length > 0 && (
				<div className="tree-children">
					{node.children.map((child) => (
						<TreeNode key={child.id} node={child} selected={selected} selectedIds={selectedIds} onSelect={onSelect} onReparent={onReparent} onMove={onMove} onCopy={onCopy} onPasteChild={onPasteChild} onDuplicate={onDuplicate} onDelete={onDelete} />
					))}
				</div>
			)}
		</div>
	);
}

export function WidgetTree(props: WidgetTreeProps) {
	return <div>{props.nodes.map((node) => <TreeNode key={node.id} node={node} selected={props.selected} selectedIds={props.selectedIds} onSelect={props.onSelect} onReparent={props.onReparent} onMove={props.onMove} onCopy={props.onCopy} onPasteChild={props.onPasteChild} onDuplicate={props.onDuplicate} onDelete={props.onDelete} />)}</div>;
}
