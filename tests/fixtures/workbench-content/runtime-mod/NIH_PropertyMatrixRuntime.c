/**
 * Disposable test-only native parser/property matrix. Every case differs
 * from a same-class control in a single authored sizing property. Capture
 * immediate native tree construction separately from later UI updates.
 * This is NOT an engine widget-class dispatch implementation.
 */
class NIHPropertyMatrixRuntimeProbe {
	protected Widget m_Root;

	void Start() {
		if (g_Game.IsDedicatedServer())
			return;

		m_Root = g_Game.GetWorkspace().CreateWidgets("NIH_ContentSizingProbe/gui/layouts/NIH_ContentProperty_Matrix.layout");
		if (!m_Root) {
			Print("[NIH_LayoutStudio][PropertyProbe] ERROR: matrix layout resource unavailable");
			return;
		}
		Capture("after-create");
		ApplyViewport(1120.0, 720.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(Capture, 700, false, "post-update");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ApplyViewport, 1500, false, 1120.0, 620.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(Capture, 2100, false, "after-resize");
	}

	void ApplyViewport(float width, float height) {
		if (!m_Root)
			return;
		m_Root.SetScreenPos(0, 0);
		m_Root.SetScreenSize(width, height);
		m_Root.Update();
		Print(string.Format("[NIH_LayoutStudio][PropertyProbe] REQUEST viewport=%1,%2", width, height));
	}

	void Capture(string phase) {
		if (!m_Root)
			return;
		Print("[NIH_LayoutStudio][PropertyProbe] BEGIN " + phase);
		float rootWidth;
		float rootHeight;
		m_Root.GetScreenSize(rootWidth, rootHeight);
		Print(string.Format("[NIH_LayoutStudio][PropertyProbe] phase=%1 rootScreenSize=%2,%3", phase, rootWidth, rootHeight));
		CheckCase(phase, "PFrameNoFlag");
		CheckCase(phase, "PFrameFlagZero");
		CheckCase(phase, "PFrameFlagOne");
		CheckCase(phase, "PFrameHorizontalOne");
		CheckCase(phase, "PFrameBothOne");
		CheckCase(phase, "PFrameTextOne");
		CheckCase(phase, "PFrameClipped");
		CheckCase(phase, "PPanelNoFlag");
		CheckCase(phase, "PPanelFlagZero");
		CheckCase(phase, "PPanelFlagOne");
		CheckCase(phase, "PPanelHorizontalOne");
		CheckCase(phase, "PWrapNoFlag");
		CheckCase(phase, "PWrapFlagZero");
		CheckCase(phase, "PWrapFlagOne");
		Print("[NIH_LayoutStudio][PropertyProbe] END " + phase);
	}

	protected void CheckCase(string phase, string name) {
		Widget parent = m_Root.FindAnyWidget(name);
		int present = 0;
		int count = 0;
		if (parent) {
			present = 1;
			Widget child = parent.GetChildren();
			while (child) {
				++count;
				child = child.GetSibling();
			}
		}
		int topFound = 0;
		int bottomFound = 0;
		if (m_Root.FindAnyWidget(name + "_Top"))
			topFound = 1;
		if (m_Root.FindAnyWidget(name + "_Bottom"))
			bottomFound = 1;
		Print(string.Format("[NIH_LayoutStudio][PropertyProbe] phase=%1 case=%2 parentPresent=%3 childCount=%4 topFound=%5 bottomFound=%6",
			phase, name, present, count, topFound, bottomFound));
		if (!parent)
			return;
		float width;
		float height;
		float localWidth;
		float localHeight;
		parent.GetScreenSize(width, height);
		parent.GetSize(localWidth, localHeight);
		Print(string.Format("[NIH_LayoutStudio][PropertyProbe] phase=%1 case=%2 screenSize=%3,%4 localSize=%5,%6",
			phase, name, width, height, localWidth, localHeight));
	}
}
