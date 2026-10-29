// Disposable native content sizing probe. Never ship on a production server.
class CfgPatches {
	class NIH_ContentSizingProbe {
		units[] = {};
		weapons[] = {};
		requiredVersion = 0.1;
		requiredAddons[] = {"DZ_Data"};
	};
};

class CfgMods {
	class NIH_ContentSizingProbe {
		dir = "NIH_ContentSizingProbe";
		name = "NIH Layout Studio Native Content Sizing Probe";
		type = "mod";
		dependencies[] = {"Mission"};

		class defs {
			class missionScriptModule {
				value = "";
				files[] = {"NIH_ContentSizingProbe/Scripts/5_Mission"};
			};
		};
	};
};
