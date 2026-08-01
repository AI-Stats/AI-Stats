import fs from "node:fs";
import path from "node:path";

const webRoot = process.cwd();

function readSource(relativePath: string): string {
	return fs.readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("settings UI contracts", () => {
	it("keeps the section navigation outside the scrollable settings pane", () => {
		const layoutSource = readSource("src/app/(dashboard)/settings/layout.tsx");
		const navigationPosition = layoutSource.indexOf("<SettingsTopTabsClientOnly");
		const scrollPanePosition = layoutSource.indexOf("<ScrollArea");

		expect(layoutSource).toContain(
			"fixed inset-x-0 bottom-0 top-[calc(var(--site-header-height,3.75rem)+var(--site-notice-height,0px))]",
		);
		expect(navigationPosition).toBeGreaterThan(-1);
		expect(scrollPanePosition).toBeGreaterThan(navigationPosition);
		expect(layoutSource).toContain(
			'import { ScrollArea } from "@/components/ui/scroll-area";',
		);
		expect(layoutSource).toContain('viewportClassName="pb-4 pt-3"');
		const clientOnlySource = readSource(
			"src/components/(gateway)/settings/SettingsTopTabsClientOnly.tsx",
		);
		expect(clientOnlySource).toContain("useSyncExternalStore");
		expect(clientOnlySource).toContain("getServerSnapshot");
		expect(clientOnlySource).not.toContain("ssr: false");
		expect(clientOnlySource).toContain('<div className="h-[52px]" aria-hidden="true" />');
	});

	it("renders pages without sibling navigation as a single active tab", () => {
		const tabsSource = readSource(
			"src/components/(gateway)/settings/SettingsTopTabsServer.tsx",
		);

		expect(tabsSource).not.toContain("ChevronRight");
		expect(tabsSource).toContain('aria-current="page"');
		expect(tabsSource).toContain("border-b-2");
		expect(tabsSource).toContain("border-muted-foreground");
	});

	it("keeps the complete mobile settings navigation on Base UI", () => {
		const headerSource = readSource("src/components/header/header.tsx");
		const searchSource = readSource("src/components/header/Search/Search.tsx");
		const tabsSource = readSource(
			"src/components/(gateway)/settings/SettingsTopTabsServer.tsx",
		);
		const menuSource = readSource(
			"src/components/(gateway)/settings/SettingsSidebarTrigger.tsx",
		);
		const pageHeaderSource = readSource(
			"src/components/(gateway)/settings/SettingsPageHeader.tsx",
		);
		const keysPageSource = readSource("src/app/(dashboard)/settings/keys/page.tsx");

		expect(headerSource).toContain("<SettingsSidebarTrigger");
		expect(headerSource.indexOf("<SettingsSidebarTrigger")).toBeLessThan(
			headerSource.indexOf('aria-label="Phaseo home"'),
		);
		expect(headerSource.match(/<SearchWrapper/g)).toHaveLength(1);
		expect(headerSource.indexOf("<SearchWrapper")).toBeLessThan(
			headerSource.indexOf('<AuthControls variant="mobile"'),
		);
		expect(headerSource).toContain("mobileGhost");
		expect(headerSource).toContain('className="size-9');
		expect(searchSource).toContain("mobileGhost &&");
		expect(searchSource).toContain("border-transparent bg-transparent");
		expect(searchSource).toContain("lg:border-zinc-200/80");
		expect(tabsSource).not.toContain("<SettingsSidebarTrigger");
		expect(tabsSource).not.toContain("<DropdownMenu");
		expect(tabsSource).toContain("overflow-x-auto");
		expect(tabsSource).toContain("overscroll-x-contain");
		expect(tabsSource).toContain("shrink-0 whitespace-nowrap");
		expect(menuSource).not.toContain("asChild");
		expect(menuSource).toContain('open={open}');
		expect(menuSource).toContain('onOpenChange={handleOpenChange}');
		expect(menuSource).toContain("const [visibleScope, setVisibleScope]");
		expect(menuSource).toContain("group.scope === visibleScope");
		expect(menuSource).toContain("<DropdownMenuRadioGroup");
		expect(menuSource).toContain("<DropdownMenuRadioItem");
		expect(menuSource).toContain('value="personal"');
		expect(menuSource).toContain('value="workspace"');
		expect(menuSource.match(/closeOnClick=\{false\}/g)).toHaveLength(2);
		expect(menuSource).not.toContain('<Link href="/settings/profile"');
		expect(menuSource).not.toContain('<Link href="/settings/workspaces/settings"');
		expect(menuSource).toContain('"Close settings menu"');
		expect(menuSource).toContain('"Open settings menu"');
		expect(menuSource).toContain("<MenuIcon");
		expect(menuSource).toContain("<X");
		expect(menuSource).toContain("transition-[opacity,transform]");
		expect(menuSource).not.toContain("uppercase");
		expect(menuSource).not.toContain("tracking-wide");
		expect(menuSource).toContain('className="flex items-center lg:hidden"');
		expect(menuSource).toContain("const Icon = item.icon");
		expect(menuSource).toContain("<Icon className=");
		expect(menuSource).toContain("My account");
		expect(menuSource).toContain("Workspace");
		expect(menuSource).toContain("visibleGroups.map");
		expect(menuSource).toContain("<DropdownMenuGroup key=");
		expect(menuSource).toContain("<DropdownMenuLabel");
		expect(menuSource.indexOf("<DropdownMenuGroup key=")).toBeLessThan(
			menuSource.indexOf("<DropdownMenuLabel"),
		);
		expect(pageHeaderSource).toContain('className={cn("space-y-4", className)}');
		expect(pageHeaderSource.indexOf("{actions ?")).toBeGreaterThan(
			pageHeaderSource.indexOf("{description ?"),
		);
		expect(keysPageSource).toContain("flex flex-wrap items-center gap-2");
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
