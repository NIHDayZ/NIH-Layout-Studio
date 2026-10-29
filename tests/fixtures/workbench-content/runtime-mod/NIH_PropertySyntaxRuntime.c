/**
 * Disposable client-only native layout property syntax isolation.
 *
 * Each case lives in an independent .layout resource to prevent a malformed
 * or unsupported property in one file from swallowing the following cases.
 * This does not attempt to reconstruct the native C++ tokenizer.
 */
class NIHPropertySyntaxRuntimeProbe {
	void Start() {
		if (g_Game.IsDedicatedServer())
			return;
		Print("[NIH_LayoutStudio][SyntaxProbe] BEGIN");
		RunCase("FrameBase");
		RunCase("FrameContentBefore0");
		RunCase("FrameContentAfter0");
		RunCase("FrameUnknownBefore0");
		RunCase("FrameUnknownAfter0");
		RunCase("FrameClipBefore1");
		RunCase("FrameClipAfter1");
		RunCase("PanelBase");
		RunCase("PanelContentBefore0");
		RunCase("PanelContentAfter0");
		RunCase("PanelUnknownBefore0");
		RunCase("PanelUnknownAfter0");
		Print("[NIH_LayoutStudio][SyntaxProbe] END");
	}

	protected void RunCase(string caseId) {
		string path = "NIH_ContentSizingProbe/gui/layouts/syntax-matrix/" + caseId + ".layout";
		Widget root = g_Game.GetWorkspace().CreateWidgets(path);
		MeasureCase("after-create", caseId, root);
		if (root) {
			root.SetScreenPos(0, 0);
			root.SetScreenSize(1120.0, 720.0);
			root.Update();
		}
		MeasureCase("post-update", caseId, root);
	}

	protected void MeasureCase(string phase, string caseId, Widget root) {
		int rootPresent = 0;
		int parentPresent = 0;
		int childCount = 0;
		int topFound = 0;
		int bottomFound = 0;
		Widget parent;
		if (root) {
			rootPresent = 1;
			parent = root.FindAnyWidget(caseId);
			if (root.FindAnyWidget(caseId + "_Top"))
				topFound = 1;
			if (root.FindAnyWidget(caseId + "_Bottom"))
				bottomFound = 1;
		}
		if (parent) {
			parentPresent = 1;
			Widget child = parent.GetChildren();
			while (child) {
				++childCount;
				child = child.GetSibling();
			}
		}
		Print(string.Format("[NIH_LayoutStudio][SyntaxProbe] phase=%1 case=%2 rootPresent=%3 parentPresent=%4 childCount=%5 topFound=%6 bottomFound=%7",
			phase, caseId, rootPresent, parentPresent, childCount, topFound, bottomFound));
		if (!parent)
			return;
		float screenWidth;
		float screenHeight;
		float localWidth;
		float localHeight;
		parent.GetScreenSize(screenWidth, screenHeight);
		parent.GetSize(localWidth, localHeight);
		Print(string.Format("[NIH_LayoutStudio][SyntaxProbe] phase=%1 case=%2 screenSize=%3,%4 localSize=%5,%6",
			phase, caseId, screenWidth, screenHeight, localWidth, localHeight));
	}
}
