"use client";

import dynamic from "next/dynamic";

const SettingsTopTabs = dynamic(() => import("./SettingsTopTabsServer"), {
	ssr: false,
	loading: () => <div className="h-[52px]" aria-hidden="true" />,
});

export default function SettingsTopTabsClientOnly({
	isEnterpriseInvoiceMode,
	showBroadcast = true,
	showWebhooks = true,
}: {
	isEnterpriseInvoiceMode?: boolean;
	showBroadcast?: boolean;
	showWebhooks?: boolean;
}) {
	return (
		<SettingsTopTabs
			isEnterpriseInvoiceMode={isEnterpriseInvoiceMode}
			showBroadcast={showBroadcast}
			showWebhooks={showWebhooks}
		/>
	);
}
