import { getActiveSettingsNav, getSettingsSidebar } from "./Sidebar.config";

describe("settings sidebar navigation", () => {
	it("keeps personal settings focused on the account", () => {
		const personalLabels = getSettingsSidebar()
			.filter((group) => group.scope === "personal")
			.flatMap((group) => group.items.map((item) => item.label));

		expect(personalLabels).toEqual([
			"Profile",
			"Account",
			"Workspaces",
			"Billing",
			"Feature Preview",
		]);
	});

	it("separates workspace usage from request logs", () => {
		expect(getActiveSettingsNav("/settings/usage")?.item.label).toBe("Usage");
		expect(getActiveSettingsNav("/settings/usage/overview")?.item.label).toBe("Usage");
		expect(getActiveSettingsNav("/settings/usage/logs")?.item.label).toBe("Logs");
		expect(getActiveSettingsNav("/settings/usage/logs/request-1")?.item.label).toBe("Logs");
		expect(getActiveSettingsNav("/settings/usage/logs/videos")?.item.label).toBe("Logs");
		expect(getActiveSettingsNav("/settings/usage/logs/batches")?.item.label).toBe("Logs");
	});

	it("includes the workspace activity log under settings", () => {
		const settings = getActiveSettingsNav("/settings/workspaces/activity")?.item;
		expect(settings?.label).toBe("Settings");
		expect(settings?.children?.map((child) => child.label)).toContain("Activity");
	});

	it("orders workspace settings by task", () => {
		const workspaceGroups = getSettingsSidebar()
			.filter((group) => group.scope === "workspace")
			.map((group) => ({
				heading: group.heading,
				items: group.items.map((item) => item.label),
			}));

		expect(workspaceGroups).toEqual([{
			heading: undefined,
			items: [
				"Settings",
				"Enterprise",
				"API Keys",
				"Usage",
				"Logs",
				"Routing",
				"Guardrails",
				"Privacy",
				"Bring Your Own Key",
				"Presets",
				"Apps",
				"Management Keys",
				"Broadcast",
				"OAuth Apps",
				"Webhooks",
			],
		}]);
	});

	it("shows provider review only to internal users", () => {
		const labels = (showInternal: boolean) => getSettingsSidebar({ showInternal }).flatMap((group) => group.items.map((item) => item.label));
		expect(labels(false)).not.toContain("Provider review");
		expect(labels(true)).toContain("Provider review");
	});
});
