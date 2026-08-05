"use client";

import { useSyncExternalStore } from "react";

import SettingsTopTabs from "./SettingsTopTabsServer";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function SettingsTopTabsClientOnly({
	isEnterpriseInvoiceMode,
	showBroadcast = true,
	showWebhooks = true,
}: {
	isEnterpriseInvoiceMode?: boolean;
	showBroadcast?: boolean;
	showWebhooks?: boolean;
}) {
	const isHydrated = useSyncExternalStore(
		subscribe,
		getClientSnapshot,
		getServerSnapshot,
	);

	if (!isHydrated) {
		return <div className="h-[52px]" aria-hidden="true" />;
	}

	return (
		<SettingsTopTabs
			isEnterpriseInvoiceMode={isEnterpriseInvoiceMode}
			showBroadcast={showBroadcast}
			showWebhooks={showWebhooks}
		/>
	);
}
