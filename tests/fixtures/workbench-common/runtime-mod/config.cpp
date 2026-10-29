// Disposable client-only native geometry fixture. Never ship on production.
class CfgPatches {
	class NIH_CommonGeometryProbe {
		units[] = {};
		weapons[] = {};
		requiredVersion = 0.1;
		requiredAddons[] = {"DZ_Data"};
	};
};

class CfgMods {
	class NIH_CommonGeometryProbe {
		dir = "NIH_CommonGeometryProbe";
		name = "NIH Layout Studio Common Geometry Probe";
		type = "mod";
		dependencies[] = {"Mission"};

		class defs {
			class missionScriptModule {
				value = "";
				files[] = {"NIH_CommonGeometryProbe/Scripts/5_Mission"};
			};
		};
	};
};
