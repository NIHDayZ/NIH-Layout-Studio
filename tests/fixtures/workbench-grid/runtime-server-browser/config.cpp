class CfgPatches {
	class NIH_ServerBrowserGeometryProbe {
		units[] = {};
		weapons[] = {};
		requiredVersion = 0.1;
		requiredAddons[] = {"DZ_Data"};
	};
};
class CfgMods {
	class NIH_ServerBrowserGeometryProbe {
		dir = "NIH_ServerBrowserGeometryProbe";
		name = "NIH Layout Studio Server Browser Geometry Probe";
		type = "mod";
		dependencies[] = {"Mission"};
		class defs {
			class missionScriptModule {
				value = "";
				files[] = {"NIH_ServerBrowserGeometryProbe/Scripts/5_Mission"};
			};
		};
	};
};
