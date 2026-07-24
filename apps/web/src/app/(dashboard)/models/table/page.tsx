import type { Metadata } from "next";
import ModelsTablePageClient from "@/components/(data)/models/Models/ModelsTablePageClient";
import { isAdminViewer } from "@/lib/auth/getViewerRole";
import { modelsCatalogueV2Flag } from "@/lib/flags";

export const metadata: Metadata = {
	title: "Models table view",
	description:
		"Internal table layout for browsing Phaseo model records in bulk with dense columns, sortable metadata, and quick cross-provider comparisons.",
	robots: {
		index: false,
		follow: true,
	},
};

export default async function ModelsTablePage() {
	const isAdmin = await isAdminViewer();
	const catalogueVersion =
		isAdmin && (await modelsCatalogueV2Flag()) ? "v2" : "v1";

	return <ModelsTablePageClient catalogueVersion={catalogueVersion} />;
}

