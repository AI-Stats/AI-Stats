import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MigrationPostView } from "@/components/(migrate)/MigrationPostView";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { getMigrationPost, getMigrationPosts } from "@/lib/content/migrations";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

type PageProps = {
	params: Promise<{ slug: string }>;
};

export function generateStaticParams(): Array<{ slug: string }> {
	return getMigrationPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
	const { slug } = await props.params;
	const post = getMigrationPost(slug);
	const path = `/migrate/${slug}`;

	if (!post) {
		return buildMetadata({
			title: "AI Gateway Migration Guide",
			description:
				"Step-by-step migration guidance for moving from existing AI providers and gateways to Phaseo Gateway.",
			path,
		});
	}

	return buildMetadata({
		title: post.seoTitle,
		description: post.description,
		path,
		keywords: post.keywords,
	});
}

export default async function MigrationPostPage({ params }: PageProps) {
	const { slug } = await params;
	const post = getMigrationPost(slug);

	if (!post) {
		notFound();
	}

	const pageUrl = absoluteUrl(`/migrate/${post.slug}`);
	const howTo = {
		"@context": "https://schema.org",
		"@type": "HowTo",
		name: post.title,
		description: post.description,
		url: pageUrl,
		dateModified: post.updatedAt,
		step: post.sections
			.filter((section) => /^\d/.test(section.title))
			.map((section, index) => ({
				"@type": "HowToStep",
				position: index + 1,
				name: section.title,
				text: section.paragraphs.join(" "),
				url: `${pageUrl}#${section.id}`,
			})),
	};
	const faq = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: post.faq.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: { "@type": "Answer", text: item.answer },
		})),
	};
	const breadcrumbs = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
			{ "@type": "ListItem", position: 2, name: "Migration guides", item: absoluteUrl("/migrate") },
			{ "@type": "ListItem", position: 3, name: post.sourceLabel, item: pageUrl },
		],
	};

	return (
		<>
			<JsonLdScript id={`migration-howto-${post.slug}`} data={howTo} />
			<JsonLdScript id={`migration-faq-${post.slug}`} data={faq} />
			<JsonLdScript id={`migration-breadcrumbs-${post.slug}`} data={breadcrumbs} />
			<MigrationPostView post={post} />
		</>
	);
}
