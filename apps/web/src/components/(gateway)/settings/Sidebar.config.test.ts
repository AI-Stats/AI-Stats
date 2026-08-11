import { getActiveSettingsNav, getSettingsSidebar } from "./Sidebar.config";

describe("settings sidebar navigation", () => {
	it("keeps personal settings focused on the account", () => {
		const personalLabels = getSettingsSidebar()
			.filter((group) => group.scope === "personal")
			.flatMap((group) => group.items.map((item) => item.label));

		expect(personalLabels).toEqual([
			"Profile",
			"Account",
			"Privacy",
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

	it("orders workspace settings by task", () => {
		const workspaceGroups = getSettingsSidebar()
			.filter((group) => group.scope === "workspace")
			.map((group) => ({
				heading: group.heading,
				items: group.items.map((item) => item.label),
			}));

		expect(workspaceGroups).toEqual([
			{ heading: "Workspace", items: ["Settings"] },
			{ heading: "Observe", items: ["Usage", "Logs"] },
			{
				heading: "Gateway",
				items: [
					"API Keys",
					"Management Keys",
					"Broadcast",
					"Apps",
					"Routing",
					"Bring Your Own Key",
					"Presets",
					"Safety & privacy",
				],
			},
			{ heading: "Developer", items: ["OAuth Apps", "Webhooks"] },
		]);
	});
});
