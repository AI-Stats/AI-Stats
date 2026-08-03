import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { DesktopFrame } from "./components/DesktopFrame";
import { Topbar } from "./components/Topbar";
import { usePersistedState } from "./lib/persistedState";
import type { ProductSurface, ThemePreference } from "./types";
import { PlatformHome } from "./views/PlatformHome";
import { SectionPlaceholder } from "./views/SectionPlaceholder";
import { WorkspaceHome } from "./views/WorkspaceHome";

const labels: Record<string, string> = {
	inbox: "Inbox",
	missions: "Missions",
	projects: "Projects",
	repositories: "Repositories",
	proposals: "Proposals",
	agents: "Agents",
	rooms: "Rooms",
	models: "Models",
	providers: "Providers",
	gateway: "Gateway",
	observability: "Observability",
};

export function App() {
	const [surface, setSurface] = usePersistedState<ProductSurface>("phaseo.desktop.surface", "workspace");
	const [workspaceItem, setWorkspaceItem] = usePersistedState("phaseo.desktop.workspace.item", "home");
	const [platformItem, setPlatformItem] = usePersistedState("phaseo.desktop.platform.item", "overview");
	const [collapsed, setCollapsed] = usePersistedState("phaseo.desktop.sidebar.collapsed", false);
	const [theme, setTheme] = usePersistedState<ThemePreference>("phaseo.desktop.theme", "system");
	const activeItem = surface === "workspace" ? workspaceItem : platformItem;

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const applyTheme = () => { document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme; };
		applyTheme();
		media.addEventListener("change", applyTheme);
		return () => media.removeEventListener("change", applyTheme);
	}, [theme]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey)) return;
			if (event.key === "1") {
				event.preventDefault();
				setSurface("workspace");
			}
			if (event.key === "2") {
				event.preventDefault();
				setSurface("platform");
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [setSurface]);

	const changeItem = (item: string) => {
		if (surface === "workspace") setWorkspaceItem(item);
		else setPlatformItem(item);
	};

	let content;
	if (surface === "workspace" && activeItem === "home") content = <WorkspaceHome />;
	else if (surface === "platform" && activeItem === "overview") content = <PlatformHome />;
	else content = <SectionPlaceholder title={labels[activeItem] ?? "Workspace"} />;

	return (
		<div className="desktop-root">
			<DesktopFrame
				theme={theme}
				onThemeChange={setTheme}
				onNavigate={(destination) => { setSurface("workspace"); setWorkspaceItem(destination); }}
			/>
			<div className="app-shell">
				<Sidebar
				surface={surface}
				activeItem={activeItem}
				collapsed={collapsed}
				onSurfaceChange={setSurface}
				onItemChange={changeItem}
				onCollapsedChange={setCollapsed}
				/>
				<div className="app-main">
					<Topbar surface={surface} theme={theme} onThemeChange={setTheme} />
					<main className="content-scroll">{content}</main>
				</div>
			</div>
		</div>
	);
}
