import type { Metadata } from "next";
import ContentProvenanceTool from "@/components/(tools)/ContentProvenanceTool";
import { ToolPageHeader } from "@/components/(tools)/ToolPageHeader";
import { buildMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = buildMetadata({
	title: "Content Provenance Checker",
	description: "Check images and audio for known OpenAI C2PA and SynthID provenance signals without storing your upload on Phaseo.",
	path: "/tools/content-provenance",
	keywords: ["content provenance", "C2PA checker", "SynthID checker", "AI image verification", "AI audio verification", "OpenAI provenance"],
});

export default async function ContentProvenancePage() {
	const t = await getTranslations("Product.tools.provenance");
	return (
		<main className="min-h-screen">
			<div className="container mx-auto px-4 py-8 sm:py-12">
				<div className="mx-auto max-w-5xl">
					<ToolPageHeader title={t("checkFile")} description={t("description")} />
				</div>
				<ContentProvenanceTool />
			</div>
		</main>
	);
}
