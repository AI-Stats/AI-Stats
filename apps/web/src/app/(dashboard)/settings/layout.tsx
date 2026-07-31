import SettingsPageSkeleton from "@/components/(gateway)/settings/SettingsPageSkeleton";
import SettingsSidebar from "@/components/(gateway)/settings/Sidebar";
import SettingsTopTabsServer from "@/components/(gateway)/settings/SettingsTopTabsServer";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { fetchSettingsLayoutInitialData } from "@/lib/fetchers/internal/fetchSettingsLayoutInitialData";
import {
	Sidebar,
	SidebarInset,
	SidebarProvider,
} from "@/components/ui/sidebar";
import { Suspense } from "react";
import NoFooterStyle from "@/components/layout/NoFooterStyle";
import { batchApiFlag } from "@/lib/flags";

export const metadata = {
	title: "Settings",
	robots: {
		index: false,
		follow: false,
	},
};

export default async function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const initialData = await fetchSettingsLayoutInitialData();
	if (!initialData.signedIn) {
		const headerStore = await headers();
		const requestedPath =
			headerStore.get("x-invoke-path") ??
			headerStore.get("next-url") ??
			"/settings";
		const safeReturnUrl = requestedPath.startsWith("/")
			? requestedPath
			: "/settings";
		redirect(`/sign-in?returnUrl=${encodeURIComponent(safeReturnUrl)}`);
	}
	const showBroadcast = initialData.showBroadcast;
	let showWebhooks = false;
	const isEnterpriseInvoiceMode = initialData.isEnterpriseInvoiceMode;
	showWebhooks = await batchApiFlag();

	return (
		<>
			<NoFooterStyle />

			<SidebarProvider defaultOpen className="fixed inset-x-0 bottom-0 top-[calc(var(--site-header-height,3.75rem)+var(--site-notice-height,0px))] flex min-h-0 overflow-hidden [&_button:not([data-settings-segment])]:!rounded-lg [&_[data-slot=button]]:!rounded-lg">
				<Sidebar
					collapsible="icon"
					desktopClassName="hidden lg:block"
					// Keep desktop sidebar fixed under sticky chrome (notice + header).
					className="top-[calc(var(--site-header-height,3.75rem)+var(--site-notice-height,0px))] bottom-0 h-auto bg-white dark:bg-zinc-950"
				>
					<SettingsSidebar showBroadcast={showBroadcast} showWebhooks={showWebhooks} workspaceName={initialData.workspaceName} />
				</Sidebar>
				<SidebarInset className="flex w-0 min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950">
					<div className="container mx-auto flex h-full min-h-0 w-full flex-col px-4 pt-0 sm:px-5 lg:px-6 xl:px-8">
						<div className="relative z-20 shrink-0 bg-background">
							<SettingsTopTabsServer
								isEnterpriseInvoiceMode={isEnterpriseInvoiceMode}
								showBroadcast={showBroadcast}
								showWebhooks={showWebhooks}
							/>
						</div>
						<div className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pb-4 pt-3">
							<Suspense fallback={<SettingsPageSkeleton />}>
								{children}
							</Suspense>
						</div>
					</div>
				</SidebarInset>
			</SidebarProvider>
		</>
	);
}
