// Disposable DayZ client diagnostic mod only. Not for production deployment.
class CfgPatches {
	class NIH_LayoutScrollProbe {
		units[] = {};
		weapons[] = {};
		requiredVersion = 0.1;
		requiredAddons[] = {"DZ_Data"};
	};
};

class CfgMods {
	class NIH_LayoutScrollProbe {
		dir = "NIH_LayoutScrollProbe";
		name = "NIH Layout Studio Scroll Runtime Probe";
		type = "mod";
		dependencies[] = {"Mission"};

		class defs {
			class missionScriptModule {
				value = "";
				files[] = {"NIH_LayoutScrollProbe/Scripts/5_Mission"};
			};
		};
	};
};
