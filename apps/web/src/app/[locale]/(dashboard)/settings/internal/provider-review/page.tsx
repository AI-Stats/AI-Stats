import { requireInternalAdmin } from "@/lib/auth/requireInternalAdmin";
import SettingsPageHeader from "@/components/(gateway)/settings/SettingsPageHeader";
import ProviderReviewClient from "@/components/(gateway)/settings/internal/ProviderReviewClient";
import { fetchInternalProviderCatalogReviews } from "@/lib/fetchers/internal/fetchInternalProviderCatalogReviews";

export const metadata = { title: "Provider review - Settings" };

export default async function ProviderReviewPage() {
	await requireInternalAdmin("/settings/account/providers");
	const reviews = await fetchInternalProviderCatalogReviews();
	return <div className="space-y-6"><SettingsPageHeader title="Provider review" description="Review provider model claims before they can become routable." /><ProviderReviewClient initialReviews={reviews} /></div>;
}
