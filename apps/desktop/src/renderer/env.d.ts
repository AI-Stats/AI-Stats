import type { PhaseoDesktopApi } from "../shared/desktop";

declare global {
	interface Window {
		phaseoDesktop?: PhaseoDesktopApi;
	}
}

export {};
