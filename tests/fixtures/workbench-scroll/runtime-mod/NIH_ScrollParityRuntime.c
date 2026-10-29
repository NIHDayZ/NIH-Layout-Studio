/**
 * TEST-ONLY DayZ client probe for NIH Layout Studio's ScrollWidget parity.
 *
 * Copy into a disposable client test mod's Scripts/5_Mission folder.
 * Requires gui/layouts/NIH_Scroll_Parity.layout copied from the fixture.
 * Do not ship this MissionGameplay injection in a production mod.
 *
 * This logs native API observations; it does not fabricate child viewports,
 * derive native DPI-context integers, or assert geometry parity.
 */
class NIHLayoutScrollRuntimeProbe {
	protected Widget m_Root;

	void Start() {
		if (g_Game.IsDedicatedServer())
			return;

		m_Root = g_Game.GetWorkspace().CreateWidgets("NIH_LayoutScrollProbe/gui/layouts/NIH_Scroll_Parity.layout");
		if (!m_Root) {
			Print("[NIH_LayoutStudio][ScrollProbe] ERROR: layout resource unavailable");
			return;
		}

		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 800, false, "initial");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(SetNormalized, 5000, false, 0.5);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 5300, false, "half");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(SetNormalized, 10000, false, 1.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 10300, false, "end");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(SetNormalized, 15000, false, 0.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 15300, false, "reset");
	}

	void SetNormalized(float position) {
		if (!m_Root)
			return;

		ScrollWidget vertical = ScrollWidget.Cast(m_Root.FindAnyWidget("ScrollVertical"));
		ScrollWidget both = ScrollWidget.Cast(m_Root.FindAnyWidget("ScrollBoth"));
		ScrollWidget left = ScrollWidget.Cast(m_Root.FindAnyWidget("ScrollLeft"));

		if (vertical)
			vertical.VScrollToPos01(position);
		if (both) {
			both.HScrollToPos01(position);
			both.VScrollToPos01(position);
		}
		if (left) {
			left.HScrollToPos01(position);
			left.VScrollToPos01(position);
		}
		Print(string.Format("[NIH_LayoutStudio][ScrollProbe] SET normalized=%1", position));
	}

	void CaptureAll(string phase) {
		if (!m_Root)
			return;

		CaptureOne(phase, "ScrollNone");
		CaptureOne(phase, "ScrollVertical");
		CaptureOne(phase, "ScrollBoth");
		CaptureOne(phase, "ScrollLeft");
	}

	protected void CaptureOne(string phase, string widgetName) {
		ScrollWidget scroll = ScrollWidget.Cast(m_Root.FindAnyWidget(widgetName));
		if (!scroll) {
			Print("[NIH_LayoutStudio][ScrollProbe] ERROR: missing " + widgetName);
			return;
		}

		float posX;
		float posY;
		float screenX;
		float screenY;
		float screenWidth;
		float screenHeight;
		scroll.GetPos(posX, posY);
		scroll.GetScreenPos(screenX, screenY);
		scroll.GetScreenSize(screenWidth, screenHeight);

		Print(string.Format("[NIH_LayoutStudio][ScrollProbe] phase=%1 widget=%2", phase, widgetName));
		Print(string.Format("[NIH_LayoutStudio][ScrollProbe] rectLocal=%1,%2 screenRect=%3,%4,%5,%6",
			posX, posY, screenX, screenY, screenWidth, screenHeight));
		Print(string.Format("[NIH_LayoutStudio][ScrollProbe] scrollbarWidth=%1 visible=%2 content=%3,%4",
			scroll.GetScrollbarWidth(), scroll.IsScrollbarVisible(),
			scroll.GetContentWidth(), scroll.GetContentHeight()));
		Print(string.Format("[NIH_LayoutStudio][ScrollProbe] scrollAbsolute=%1,%2 scroll01=%3,%4",
			scroll.GetHScrollPos(), scroll.GetVScrollPos(),
			scroll.GetHScrollPos01(), scroll.GetVScrollPos01()));

		CaptureChild(phase, widgetName + "_Origin");
		CaptureChild(phase, widgetName + "_Overhang");
	}

	protected void CaptureChild(string phase, string childName) {
		Widget child = m_Root.FindAnyWidget(childName);
		if (!child) {
			Print("[NIH_LayoutStudio][ScrollProbe] ERROR: missing " + childName);
			return;
		}

		float x;
		float y;
		float width;
		float height;
		child.GetScreenPos(x, y);
		child.GetScreenSize(width, height);
		Print(string.Format("[NIH_LayoutStudio][ScrollProbe] phase=%1 child=%2 screenRect=%3,%4,%5,%6",
			phase, childName, x, y, width, height));
	}
}

modded class MissionGameplay {
	protected ref NIHLayoutScrollRuntimeProbe m_NIH_LayoutScrollProbe;

	override void OnInit() {
		super.OnInit();
		if (g_Game.IsDedicatedServer())
			return;

		m_NIH_LayoutScrollProbe = new NIHLayoutScrollRuntimeProbe();
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(NIHLayoutScrollRuntimeProbeStart, 250, false);
	}

	protected void NIHLayoutScrollRuntimeProbeStart() {
		if (m_NIH_LayoutScrollProbe)
			m_NIH_LayoutScrollProbe.Start();
	}
}
