import * as React from "react";

import { cn } from "@/lib/utils";

export default function SettingsPageHeader(props: {
	title: string;
	description?: string | null;
	meta?: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
}) {
	const { title, description, meta, actions, className } = props;

	return (
		<div className={cn("space-y-4", className)}>
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
					{meta ? <div className="shrink-0">{meta}</div> : null}
				</div>
				{description ? (
					<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
			{actions ? <div className="w-full">{actions}</div> : null}
		</div>
	);
}
