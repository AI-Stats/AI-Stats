import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { MAX_BYOK_KEYS_PER_PROVIDER } from "@/lib/byok/constants";

type Entry = {
	routingMode: "priority" | "fallback";
};

type ByokProviderRowProps = {
	provider: {
		id: string;
		name: string;
		logoId: string;
	};
	entries: Entry[];
};

export default function ByokProviderRow({ provider, entries }: ByokProviderRowProps) {
	const priorityCount = entries.filter((entry) => entry.routingMode === "priority").length;
	const fallbackCount = entries.length - priorityCount;

	return (
		<Link
			href={`/settings/byok/${encodeURIComponent(provider.id)}`}
			className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
		>
			<div className="flex min-w-0 items-center gap-3">
				<Logo id={provider.logoId} alt="" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" />
				<div className="min-w-0">
					<div className="truncate text-sm font-medium">{provider.name}</div>
					<div className="text-xs text-muted-foreground">
						{entries.length === 0
							? "No keys configured"
							: `${priorityCount} prioritized · ${fallbackCount} fallback`}
					</div>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
				<span className="tabular-nums">{entries.length}/{MAX_BYOK_KEYS_PER_PROVIDER}</span>
				<ChevronRight className="h-4 w-4" />
			</div>
		</Link>
	);
}
