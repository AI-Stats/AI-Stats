import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import CodeBlock from "@/components/(data)/model/quickstart/CodeBlock";
import { AgentMigrationPrompt } from "@/components/(migrate)/AgentMigrationPrompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
	MigrationPost,
} from "@/lib/content/migrations";

export function MigrationPostView({ post }: { post: MigrationPost }) {
	return (
		<article className="container mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
			<nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
				<Link href="/migrate" className="inline-flex items-center gap-1 hover:text-foreground">
					<ArrowLeft className="h-4 w-4" />
					Back to all migration guides
				</Link>
			</nav>

			<header className="space-y-4">
				<div className="flex flex-wrap items-center gap-2">
					<Badge className="rounded-md" variant="secondary">{post.sourceLabel}</Badge>
					<Badge className="rounded-md" variant="outline">{post.readTimeMinutes} min read</Badge>
					<Badge className="rounded-md" variant="outline">Updated {post.updatedAt}</Badge>
				</div>
				<h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
					{post.title}
				</h1>
				<p className="max-w-3xl text-base leading-7 text-muted-foreground">
					{post.description}
				</p>
				<div className="flex flex-wrap gap-3 pt-2">
					<Button asChild className="rounded-md">
						<Link href="/sign-up">Try Phaseo <ArrowRight className="size-4" /></Link>
					</Button>
					{post.slug === "openrouter" ? (
						<Button asChild className="rounded-md" variant="outline">
							<Link href="/compare/openrouter">Compare Phaseo and OpenRouter</Link>
						</Button>
					) : null}
				</div>
			</header>

			{post.slug === "openrouter" ? <AgentMigrationPrompt /> : null}

			<section className="space-y-4">
				<h2 className="text-xl font-semibold">Prerequisites</h2>
				<ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
					{post.prerequisites.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>

			<div className="space-y-8">
				{post.sections.map((section) => (
					<section id={section.id} key={section.id} className="scroll-mt-24 space-y-4">
						<h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
						<div className="space-y-3">
							{section.paragraphs.map((paragraph) => (
								<p key={paragraph} className="text-sm leading-7 text-muted-foreground">
									{paragraph}
								</p>
							))}
						</div>

						{section.checklist?.length ? (
							<div className="rounded-md border border-border/60 p-4">
								<p className="text-sm font-semibold">Checklist</p>
								<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
									{section.checklist.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</div>
						) : null}

						{section.codeSnippets?.length ? (
							<div className="space-y-4">
								{section.codeSnippets.map((snippet) => (
									<div
										key={`${section.id}-${snippet.label}`}
										className="[&>div]:rounded-md [&_button]:rounded-md [&_pre]:rounded-b-md"
									>
										<CodeBlock
											label={snippet.label}
											lang={snippet.lang}
											code={snippet.code}
										/>
									</div>
								))}
							</div>
						) : null}

					</section>
				))}
			</div>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold">Validation steps</h2>
				<ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-muted-foreground">
					{post.validationSteps.map((step) => (
						<li key={step}>
							<code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
								{step}
							</code>
						</li>
					))}
				</ol>
			</section>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold">Frequently asked questions</h2>
				<div className="grid gap-3">
					{post.faq.map((faqItem) => (
						<Card className="gap-1 rounded-md" key={faqItem.question}>
							<CardHeader className="pb-0">
								<CardTitle className="text-base">{faqItem.question}</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 text-sm leading-7 text-muted-foreground">
								{faqItem.answer}
							</CardContent>
						</Card>
					))}
				</div>
			</section>

			{post.references?.length ? (
				<section className="space-y-4 border-t border-border pt-8">
					<h2 className="text-xl font-semibold">Migration resources</h2>
					<ul className="space-y-2 text-sm">
						{post.references.map((reference) => {
							const external = reference.href.startsWith("http");
							return (
								<li key={reference.href}>
									<Link
										href={reference.href}
										className="inline-flex items-center gap-1.5 underline underline-offset-4"
										target={external ? "_blank" : undefined}
										rel={external ? "noopener noreferrer" : undefined}
									>
										{reference.label}
										{external ? <ExternalLink className="size-3.5" /> : null}
									</Link>
								</li>
							);
						})}
					</ul>
				</section>
			) : null}

			<section className="rounded-md border border-border/60 p-5">
				<p className="text-sm font-semibold">Want us to handle your migration?</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Get in touch and we&apos;ll help move your OpenRouter integration to Phaseo
					for free, including the endpoint switch, model checks, and migration review.
				</p>
				<div className="mt-4">
					<Button asChild className="rounded-md">
						<Link href="/contact">Get Free Migration Help</Link>
					</Button>
				</div>
			</section>
		</article>
	);
}
