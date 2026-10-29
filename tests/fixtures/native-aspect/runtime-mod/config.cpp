// Disposable client-only native aspect geometry fixture. Never ship on production.
class CfgPatches {
	class NIH_NativeAspectProbe {
		units[] = {};
		weapons[] = {};
		requiredVersion = 0.1;
		requiredAddons[] = {"DZ_Data"};
	};
};

class CfgMods {
	class NIH_NativeAspectProbe {
		dir = "NIH_NativeAspectProbe";
		name = "NIH Layout Studio Native Aspect Probe";
		type = "mod";
		dependencies[] = {"Mission"};

		class defs {
			class missionScriptModule {
				value = "";
				files[] = {"NIH_NativeAspectProbe/Scripts/5_Mission"};
			};
		};
	};
};
