// Disposable, client-only native Grid measurement probe.
class CfgPatches {
	class NIH_GridMeasurementProbe {
		units[] = {};
		weapons[] = {};
		requiredVersion = 0.1;
		requiredAddons[] = {"DZ_Data"};
	};
};
class CfgMods {
	class NIH_GridMeasurementProbe {
		dir = "NIH_GridMeasurementProbe";
		name = "NIH Layout Studio Grid Measurement Probe";
		type = "mod";
		dependencies[] = {"Mission"};
		class defs {
			class missionScriptModule {
				value = "";
				files[] = {"NIH_GridMeasurementProbe/Scripts/5_Mission"};
			};
		};
	};
};
