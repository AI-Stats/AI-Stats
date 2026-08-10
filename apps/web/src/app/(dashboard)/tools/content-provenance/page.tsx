import type { Metadata } from "next";
import ContentProvenanceTool from "@/components/(tools)/ContentProvenanceTool";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Content Provenance Checker",
	description: "Check images and audio for known OpenAI C2PA and SynthID provenance signals without storing your upload on Phaseo.",
	path: "/tools/content-provenance",
	keywords: ["content provenance", "C2PA checker", "SynthID checker", "AI image verification", "AI audio verification", "OpenAI provenance"],
});

export default function ContentProvenancePage() {
	return (
		<main className="min-h-screen">
			<div className="container mx-auto px-4 py-8 sm:py-12">
				<div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
					<p className="mb-3 text-sm font-medium text-primary">AI &amp; API tools</p>
					<h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">Content Provenance Checker</h1>
					<p className="mx-auto mt-3 max-w-2xl text-pretty text-muted-foreground">Check an image or audio file for known provenance signals embedded by supported OpenAI generation systems.</p>
				</div>
				<ContentProvenanceTool />
			</div>
		</main>
	);
}
