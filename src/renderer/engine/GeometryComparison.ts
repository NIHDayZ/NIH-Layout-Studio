import type { LayoutNode } from "../../model/LayoutTypes";
import { GetFlag, GetNodeProperty, ResolveRect, type Rect } from "../LayoutMath";
import { MeasureLayoutTree } from "./LayoutMeasurement";
import { ArrangeMeasuredGeometry } from "./GeometrySnapshot";
import { PlanLiveManagedChildren, PlanLiveGridContent, type LiveManagedOptions } from "./LiveManagedGeometry";

export interface GeometryDifference {
	id: string;
	name: string;
	type: string;
	parentId: string | null;
	origin: "ordinary" | "managed" | "managed-descendant";
	liveLocal: Rect;
	snapshotLocal: Rect;
	liveAbsolute: Rect;
	snapshotAbsolute: Rect;
	delta: { x: number; y: number; width: number; height: number };
	classification: "local-placement" | "inherited-offset" | "local-and-inherited";
	rootCauseId: string;
}

export interface GeometryComparison {
	total: number;
	matched: number;
	differences: readonly GeometryDifference[];
	localPlacementDifferences: number;
	inheritedOffsetDifferences: number;
	rootCauses: readonly { id: string; name: string; type: string; affectedWidgets: number; localDelta: GeometryDifference["delta"] }[];
	unresolved: readonly { id: string; code: string; detail: string }[];
	duplicateIds: readonly string[];
}

function SameRect(a: Rect, b: Rect, tolerance: number): boolean {
	return Math.abs(a.x-b.x)<=tolerance && Math.abs(a.y-b.y)<=tolerance &&
		Math.abs(a.width-b.width)<=tolerance && Math.abs(a.height-b.height)<=tolerance;
}

/**
 * Independent, read-only reconstruction of the existing live placement path.
 * This deliberately mirrors the transitional Canvas rules rather than using
 * the snapshot to produce its own comparison data.
 */
export function CompareLiveToSnapshot(
	nodes: readonly LayoutNode[], root: Rect, options: LiveManagedOptions,
	tolerance=0.01
): GeometryComparison {
	const snapshot=ArrangeMeasuredGeometry(MeasureLayoutTree(nodes),root);
	const differences: GeometryDifference[]=[];
	const ids=new Set<string>();
	const duplicateIds: string[]=[];
	const originatingDifferences = new Map<string, GeometryDifference>();
	const causeCounts = new Map<string, number>();
	let total=0;
	let matched=0;
	function Visit(node: LayoutNode,parent: Rect,absoluteParent: Rect,parentId: string | null,managedAncestor: boolean,assigned?: Rect): void {
		if (!node.type.toLowerCase().includes("widgetclass") || GetNodeProperty(node,"visible")==="0")
			return;
		if (ids.has(node.id)) {
			duplicateIds.push(node.id);
			return;
		}
		ids.add(node.id);
		let live=assigned ?? ResolveRect(node,parent);
		const isGrid=node.type.toLowerCase()==="gridspacerwidgetclass";
		if (isGrid && options.gridLayout) {
			const content=PlanLiveGridContent(node,{x:0,y:0,width:live.width,height:live.height},options.nativeConstrainedGrid);
			const width=GetFlag(node,"Size To Content H")?Math.max(live.width,content.contentWidth):live.width;
			const height=GetFlag(node,"Size To Content V")?Math.max(live.height,content.contentHeight):live.height;
			const h=(GetNodeProperty(node,"halign")??"").toLowerCase();
			const v=(GetNodeProperty(node,"valign")??"").toLowerCase();
			let x=live.x,y=live.y;
			if(h==="right_ref")x-=width-live.width;
			else if(h==="center_ref")x-=(width-live.width)/2;
			if(v==="bottom_ref")y-=height-live.height;
			else if(v==="center_ref")y-=(height-live.height)/2;
			live={x,y,width,height};
		}
		const absolute={x:absoluteParent.x+live.x,y:absoluteParent.y+live.y,width:live.width,height:live.height};
		const arranged=snapshot.byId.get(node.id);
		++total;
		if(arranged && SameRect(live,arranged.localRect,tolerance) && SameRect(absolute,arranged.absoluteRect,tolerance)) {
			++matched;
		} else if(arranged) {
			const localChanged=!SameRect(live,arranged.localRect,tolerance);
			const ancestorCause=parentId ? originatingDifferences.get(parentId) : undefined;
			const rootCauseId=localChanged ? node.id : ancestorCause?.rootCauseId ?? node.id;
			const parentLocalChanged=!!ancestorCause && ancestorCause.classification!=="inherited-offset";
			const classification=localChanged
				? (parentLocalChanged ? "local-and-inherited" : "local-placement")
				: "inherited-offset";
			const diff: GeometryDifference={
				id:node.id,name:node.name,type:node.type,parentId,
				classification,rootCauseId,
				origin:managedAncestor?"managed-descendant":assigned?"managed":"ordinary",
				liveLocal:live,snapshotLocal:arranged.localRect,liveAbsolute:absolute,snapshotAbsolute:arranged.absoluteRect,
				delta:{x:live.x-arranged.localRect.x,y:live.y-arranged.localRect.y,
					width:live.width-arranged.localRect.width,height:live.height-arranged.localRect.height}
			};
			differences.push(diff);
			originatingDifferences.set(node.id,diff);
			causeCounts.set(rootCauseId,(causeCounts.get(rootCauseId)??0)+1);
		}
		const childParent={x:0,y:0,width:Math.max(0,live.width),height:Math.max(0,live.height)};
		const managed=node.type.toLowerCase().includes("spacerwidget");
		const plan=managed?PlanLiveManagedChildren(node,childParent,options):null;
		for(let i=0;i<node.children.length;++i)
			Visit(node.children[i],childParent,absolute,node.id,managedAncestor||managed,plan?.rects[i]);
	}
	for(const node of nodes)
		Visit(node,root,root,null,false);
	const rootCauses=[...causeCounts.entries()].map(([id,affectedWidgets])=>{
		const first=differences.find(d=>d.id===id);
		return first ? {id,name:first.name,type:first.type,affectedWidgets,localDelta:first.delta} : null;
	}).filter((x): x is NonNullable<typeof x>=>x!==null)
		.sort((a,b)=>b.affectedWidgets-a.affectedWidgets);
	return {total,matched,differences,duplicateIds,
		localPlacementDifferences:differences.filter(d=>d.classification!=="inherited-offset").length,
		inheritedOffsetDifferences:differences.filter(d=>d.classification==="inherited-offset").length,
		rootCauses,
		unresolved:snapshot.issues.map(issue=>({id:issue.id,code:issue.code,detail:issue.detail}))};
}
