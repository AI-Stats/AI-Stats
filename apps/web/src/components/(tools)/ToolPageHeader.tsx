import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type ToolPageHeaderProps = {
	title: string;
	description: string;
	children?: ReactNode;
};

export function ToolPageHeader({ title, description, children }: ToolPageHeaderProps) {
	return (
		<header className="mb-8 sm:mb-10">
			<Link href="/tools" className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
				<ArrowLeft className="size-4" />
				Back to tools
			</Link>
			<div className="mx-auto mt-3 max-w-3xl text-center">
				<p className="mb-3 text-sm font-medium text-primary">AI &amp; API tools</p>
				<h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
				<p className="mx-auto mt-3 max-w-2xl text-pretty text-muted-foreground">{description}</p>
				{children ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
			</div>
		</header>
	);
}
