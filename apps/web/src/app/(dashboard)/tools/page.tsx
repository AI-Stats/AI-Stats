import { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import ToolsGrid from "@/components/(tools)/ToolsGrid";

export const metadata: Metadata = buildMetadata({
	title: "AI & Developer Tools",
	description:
		"Browse free Phaseo tools for checking AI content provenance, estimating model costs, building API requests, and working with JSON and Markdown.",
	path: "/tools",
	keywords: [
		"AI tools",
		"developer tools",
		"LLM tools",
		"content provenance checker",
		"request builder",
		"JSON formatter",
		"Phaseo",
	],
});

export default function ToolsPage() {
	return (
		<main className="flex min-h-screen flex-col">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold mb-2">AI &amp; Developer Tools</h1>
					<p className="text-muted-foreground">
						Focused utilities for working with AI models, APIs, and data.
					</p>
				</div>
				<ToolsGrid />
			</div>
		</main>
	);
}
