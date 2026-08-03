import { app, autoUpdater, BrowserWindow, ipcMain, Menu, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DesktopAppAction, DesktopUpdateState, DesktopWindowAction } from "../shared/desktop";
import { isAllowedExternalUrl } from "../shared/desktop";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(currentDirectory, "../preload/index.cjs");
const rendererPath = path.join(currentDirectory, "../renderer/index.html");
const developmentUrl = process.env.PHASEO_DESKTOP_DEV_URL;
const updateFeedUrl = process.env.PHASEO_DESKTOP_UPDATE_URL;

function getWindowState(window: BrowserWindow) {
	return {
		isFocused: window.isFocused(),
		isFullScreen: window.isFullScreen(),
		isMaximized: window.isMaximized(),
	};
}

function broadcastWindowState(window: BrowserWindow) {
	window.webContents.send("desktop:window-state", getWindowState(window));
}

function broadcastUpdateState(state: DesktopUpdateState) {
	for (const window of BrowserWindow.getAllWindows()) window.webContents.send("desktop:update-state", state);
}

function createWindow(): BrowserWindow {
	const window = new BrowserWindow({
		width: 1440,
		height: 920,
		minWidth: 1040,
		minHeight: 680,
		show: false,
		backgroundColor: "#101112",
		title: "Phaseo",
		frame: process.platform === "darwin",
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
		trafficLightPosition: process.platform === "darwin" ? { x: 14, y: 13 } : undefined,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true,
		},
	});

	if (process.platform === "win32" && "setBackgroundMaterial" in window) {
		window.setBackgroundMaterial("mica");
	}

	window.once("ready-to-show", () => window.show());
	window.on("blur", () => broadcastWindowState(window));
	window.on("focus", () => broadcastWindowState(window));
	window.on("maximize", () => broadcastWindowState(window));
	window.on("unmaximize", () => broadcastWindowState(window));
	window.on("enter-full-screen", () => broadcastWindowState(window));
	window.on("leave-full-screen", () => broadcastWindowState(window));
	window.webContents.setWindowOpenHandler(({ url }) => {
		if (isAllowedExternalUrl(url)) void shell.openExternal(url);
		return { action: "deny" };
	});
	window.webContents.on("will-navigate", (event, url) => {
		const currentUrl = window.webContents.getURL();
		if (url !== currentUrl) event.preventDefault();
	});

	if (developmentUrl) {
		void window.loadURL(developmentUrl);
	} else {
		void window.loadFile(rendererPath);
	}

	return window;
}

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
	return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.handle("desktop:get-runtime-info", () => ({
	platform: process.platform,
	version: app.getVersion(),
	isPackaged: app.isPackaged,
}));

ipcMain.handle("desktop:get-window-state", (event) => {
	const window = senderWindow(event);
	return window ? getWindowState(window) : { isFocused: true, isFullScreen: false, isMaximized: false };
});

ipcMain.handle("desktop:window-action", (event, action: DesktopWindowAction) => {
	const window = senderWindow(event);
	if (!window) return;
	if (action === "close") window.close();
	else if (action === "minimize") window.minimize();
	else if (action === "toggle-maximize") {
		if (window.isMaximized()) window.unmaximize();
		else window.maximize();
	}
});

ipcMain.handle("desktop:app-action", (event, action: DesktopAppAction) => {
	const window = senderWindow(event);
	if (!window) return;
	const contents = window.webContents;
	const actions: Partial<Record<DesktopAppAction, () => void>> = {
		copy: () => contents.copy(), cut: () => contents.cut(), paste: () => contents.paste(),
		"select-all": () => contents.selectAll(), reload: () => contents.reload(),
		"toggle-full-screen": () => window.setFullScreen(!window.isFullScreen()),
		"zoom-in": () => contents.setZoomLevel(contents.getZoomLevel() + 0.5),
		"zoom-out": () => contents.setZoomLevel(contents.getZoomLevel() - 0.5),
		"zoom-reset": () => contents.setZoomLevel(0), quit: () => app.quit(),
	};
	actions[action]?.();
});

ipcMain.handle("desktop:check-for-updates", async (): Promise<DesktopUpdateState> => {
	if (!app.isPackaged || !updateFeedUrl) return { status: "unsupported", message: "Updates are configured in release builds." };
	broadcastUpdateState({ status: "checking" });
	try {
		autoUpdater.setFeedURL({ url: updateFeedUrl });
		await autoUpdater.checkForUpdates();
		return { status: "checking" };
	} catch (error) {
		const state = { status: "error", message: error instanceof Error ? error.message : "Update check failed." } as const;
		broadcastUpdateState(state);
		return state;
	}
});

ipcMain.handle("desktop:install-update", () => autoUpdater.quitAndInstall());

ipcMain.handle("desktop:open-external", async (_event, url: unknown) => {
	if (typeof url !== "string" || !isAllowedExternalUrl(url)) return false;
	await shell.openExternal(url);
	return true;
});

app.setAppUserModelId("app.phaseo.desktop");

autoUpdater.on("update-available", () => broadcastUpdateState({ status: "available" }));
autoUpdater.on("update-not-available", () => broadcastUpdateState({ status: "unavailable" }));
autoUpdater.on("update-downloaded", (_event, notes, name) => {
	void notes;
	broadcastUpdateState({ status: "ready", version: name });
});
autoUpdater.on("error", (error) => broadcastUpdateState({ status: "error", message: error.message }));

app.whenReady().then(() => {
	if (process.platform !== "darwin") Menu.setApplicationMenu(null);
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
