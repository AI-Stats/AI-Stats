import fs from "node:fs";
import path from "node:path";

const webRoot = process.cwd();

function readSource(relativePath: string): string {
	return fs.readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("settings UI contracts", () => {
	it("keeps the section navigation outside the scrollable settings pane", () => {
		const layoutSource = readSource("src/app/(dashboard)/settings/layout.tsx");
		const navigationPosition = layoutSource.indexOf("<SettingsTopTabsServer");
		const scrollPanePosition = layoutSource.indexOf("overflow-y-auto");

		expect(layoutSource).toContain(
			"fixed inset-x-0 bottom-0 top-[calc(var(--site-header-height,3.75rem)+var(--site-notice-height,0px))]",
		);
		expect(navigationPosition).toBeGreaterThan(-1);
		expect(scrollPanePosition).toBeGreaterThan(navigationPosition);
	});

	it("renders pages without sibling navigation as a single active tab", () => {
		const tabsSource = readSource(
			"src/components/(gateway)/settings/SettingsTopTabsServer.tsx",
		);

		expect(tabsSource).not.toContain("ChevronRight");
		expect(tabsSource).toContain('aria-current="page"');
		expect(tabsSource).toContain("border-b-2 border-muted-foreground");
	});

	it("uses stable mobile settings navigation without a floating menu", () => {
		const tabsSource = readSource(
			"src/components/(gateway)/settings/SettingsTopTabsServer.tsx",
		);

		expect(tabsSource).toContain("<select");
		expect(tabsSource).toContain("router.push(event.currentTarget.value)");
		expect(tabsSource).toContain("onClick={toggleSidebar}");
		expect(tabsSource).not.toContain("<DropdownMenu");
	});

	it("provides display-label collections for ID-backed settings selects", () => {
		const expectedItemCollections: Record<string, string[]> = {
			"src/components/(gateway)/settings/account/AccountSettingsClient.tsx": [
				"items={teams.map",
			],
			"src/components/(gateway)/settings/routing/DynamicRoutesStudio.tsx": [
				"items={options}",
				"items={items}",
			],
			"src/components/(gateway)/settings/routing/RoutingSettingsClient.tsx": [
				"items={ROUTING_OPTIONS}",
				"items={RESPONSE_HEALING_OPTIONS}",
			],
			"src/components/(gateway)/usage/UsageHeader/UsageHeader.tsx": [
				"items={RANGE_ITEMS}",
			],
			"src/components/(gateway)/usage/UsageTableFilters.tsx": [
				"items={modelFilterItems}",
				"items={providerFilterItems}",
				"items={keyFilterItems}",
				"items={STATUS_FILTER_ITEMS}",
			],
		};

		for (const [relativePath, collections] of Object.entries(
			expectedItemCollections,
		)) {
			const source = readSource(relativePath);
			for (const collection of collections) {
				expect(source).toContain(collection);
			}
		}
	});
});
