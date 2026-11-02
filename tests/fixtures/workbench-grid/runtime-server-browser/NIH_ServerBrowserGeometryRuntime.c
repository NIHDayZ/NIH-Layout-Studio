/**
 * Disposable client-only native rectangle capture for the vanilla server browser.
 * Records native widget state; never changes layout positions, sizes or visibility.
 * Native widget IDs are optional, so all identity here uses stable source names
 * plus direct-child ordinal and native parent names.
 */
class NIHServerBrowserGeometryProbe {
	protected Widget m_Root;

	void Start() {
		if (g_Game.IsDedicatedServer())
			return;

		m_Root = g_Game.GetWorkspace().CreateWidgets(
			"NIH_ServerBrowserGeometryProbe/gui/layouts/server_browser_tab_pages.layout");
		if (!m_Root) {
			Print("[NIH_LayoutStudio][ServerBrowserProbe] ERROR vanilla layout resource unavailable");
			return;
		}

		CapturePhase("after-create");
		m_Root.Update();
		CapturePhase("post-update");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureSettled, 900, false);
	}

	protected void CaptureSettled() {
		if (!m_Root)
			return;

		m_Root.Update();
		CapturePhase("post-settle");
	}

	protected void CapturePhase(string phase) {
		if (!m_Root)
			return;

		Print("[NIH_LayoutStudio][ServerBrowserProbe] BEGIN " + phase);
		CaptureWidget(m_Root, phase, "root", -1);
		CaptureTarget("server_list_root", phase);
		CaptureTarget("server_list_content_root", phase);
		CaptureTarget("basic_infoserver_list_content_header", phase);
		CaptureTarget("server_list_scroller", phase);
		CaptureTarget("servers_navigation_panel", phase);
		CaptureTarget("right_area_root", phase);
		CaptureTarget("details_description_container", phase);
		CaptureTarget("details_description_content", phase);
		CaptureTarget("details_description_panel", phase);
		CaptureTarget("filters_root", phase);
		CaptureTarget("filters_content", phase);
		CaptureTarget("filters_button_wrapper", phase);
		Print("[NIH_LayoutStudio][ServerBrowserProbe] END " + phase);
	}

	protected void CaptureTarget(string widgetName, string phase) {
		Widget widget = m_Root.FindAnyWidget(widgetName);
		if (!widget) {
			string missingLine = "[NIH_LayoutStudio][ServerBrowserProbe] MISSING phase=";
			missingLine += phase;
			missingLine += " name=";
			missingLine += widgetName;
			Print(missingLine);
			return;
		}

		int ordinal = FindChildOrdinal(widget);
		CaptureWidget(widget, phase, "target", ordinal);

		Widget child = widget.GetChildren();
		int childOrdinal = 0;
		while (child) {
			CaptureWidget(child, phase, "child-of-" + widgetName, childOrdinal);
			++childOrdinal;
			child = child.GetSibling();
		}
	}

	protected int FindChildOrdinal(Widget widget) {
		if (!widget)
			return -1;

		Widget parent = widget.GetParent();
		if (!parent)
			return -1;

		Widget child = parent.GetChildren();
		int ordinal = 0;
		while (child) {
			if (child == widget)
				return ordinal;

			++ordinal;
			child = child.GetSibling();
		}

		return -1;
	}

	protected void CaptureWidget(Widget widget, string phase, string role, int ordinal) {
		if (!widget)
			return;

		float localX;
		float localY;
		float localWidth;
		float localHeight;
		float screenX;
		float screenY;
		float screenWidth;
		float screenHeight;

		widget.GetPos(localX, localY);
		widget.GetSize(localWidth, localHeight);
		widget.GetScreenPos(screenX, screenY);
		widget.GetScreenSize(screenWidth, screenHeight);

		int childCount = 0;
		Widget child = widget.GetChildren();
		while (child) {
			++childCount;
			child = child.GetSibling();
		}

		Widget parent = widget.GetParent();
		string parentName = "<none>";
		if (parent)
			parentName = parent.GetName();

		string widgetName = widget.GetName();
		if (widgetName == "")
			widgetName = "<unnamed>";

		string localRect = string.Format("%1,%2,%3,%4",
			localX, localY, localWidth, localHeight);
		string screenRect = string.Format("%1,%2,%3,%4",
			screenX, screenY, screenWidth, screenHeight);

		string line = "[NIH_LayoutStudio][ServerBrowserProbe] phase=" + phase;
		line += " role=" + role;
		line += " ordinal=" + ordinal.ToString();
		line += " name=" + widgetName;
		line += " parent=" + parentName;
		line += " type=" + widget.GetTypeName();
		line += " localRect=" + localRect;
		line += " screenRect=" + screenRect;
		line += " childCount=" + childCount.ToString();
		line += " visible=" + widget.IsVisible().ToString();
		Print(line);
	}
}

modded class MissionGameplay {
	protected ref NIHServerBrowserGeometryProbe m_NIH_ServerBrowserGeometryProbe;

	override void OnInit() {
		super.OnInit();
		if (g_Game.IsDedicatedServer())
			return;

		m_NIH_ServerBrowserGeometryProbe = new NIHServerBrowserGeometryProbe();
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(NIHStartServerBrowserGeometryProbe, 400, false);
	}

	protected void NIHStartServerBrowserGeometryProbe() {
		if (m_NIH_ServerBrowserGeometryProbe)
			m_NIH_ServerBrowserGeometryProbe.Start();
	}
}
