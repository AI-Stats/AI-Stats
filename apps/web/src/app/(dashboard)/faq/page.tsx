import type { Metadata } from "next";

import { FAQSection } from "@/components/(gateway)/sections/FAQSection";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "AI Model Database & Gateway FAQ",
	description:
		"Answers about comparing AI models, pricing, benchmarks, providers, data methodology, and using Phaseo Gateway.",
	path: "/faq",
	keywords: [
		"AI model comparison FAQ",
		"AI model pricing FAQ",
		"AI benchmarks FAQ",
		"AI gateway FAQ",
		"BYOK FAQ",
	],
});

export default function FAQPage() {
	return (
		<div className="container mx-auto pt-16 sm:pt-20">
			<div className="px-4 sm:px-6 lg:px-8">
				<FAQSection />
			</div>
		</div>
	);
}
