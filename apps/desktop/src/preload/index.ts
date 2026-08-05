import { contextBridge, ipcRenderer } from "electron";
import type { PhaseoDesktopApi } from "../shared/desktop";

const desktopApi: PhaseoDesktopApi = {
	getRuntimeInfo: () => ipcRenderer.invoke("desktop:get-runtime-info"),
	getWindowState: () => ipcRenderer.invoke("desktop:get-window-state"),
	performWindowAction: (action) => ipcRenderer.invoke("desktop:window-action", action),
	performAppAction: (action) => ipcRenderer.invoke("desktop:app-action", action),
	checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
	installUpdate: () => ipcRenderer.invoke("desktop:install-update"),
	onWindowStateChange: (listener) => {
		const subscription = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state);
		ipcRenderer.on("desktop:window-state", subscription);
		return () => ipcRenderer.removeListener("desktop:window-state", subscription);
	},
	onUpdateStateChange: (listener) => {
		const subscription = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state);
		ipcRenderer.on("desktop:update-state", subscription);
		return () => ipcRenderer.removeListener("desktop:update-state", subscription);
	},
	openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
};

contextBridge.exposeInMainWorld("phaseoDesktop", desktopApi);
