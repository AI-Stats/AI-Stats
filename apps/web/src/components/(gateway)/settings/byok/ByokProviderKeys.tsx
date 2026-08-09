"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BYOKInputDialog from "@/components/(gateway)/settings/byok/BYOKInputDialog";
import DeleteKeyButton from "@/components/(gateway)/settings/byok/DeleteKeyButton";
import { reorderByokKeyAction } from "@/app/(dashboard)/settings/byok/actions";
import { MAX_BYOK_KEYS_PER_MODE } from "@/lib/byok/constants";

export type ByokKeyEntry = {
	id: string;
	providerId: string;
	name: string;
	prefix?: string;
	suffix?: string;
	lastUsedAt: string | null;
	enabled: boolean;
	errorMessage: string | null;
	alwaysUse: boolean;
	routingMode: "priority" | "fallback";
	sortOrder: number;
	verificationStatus: string | null;
};

function maskKey(prefix?: string, suffix?: string) {
	return `${prefix ?? ""}${"*".repeat(6)}${suffix ?? ""}`;
}

function formatLastUsed(value: string | null) {
	if (!value) return "Never used";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Never used";
	return `Last used ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)}`;
}

function OrderButtons({ id, canMoveUp, canMoveDown }: { id: string; canMoveUp: boolean; canMoveDown: boolean }) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);

	async function move(direction: "up" | "down") {
		setSaving(true);
		try {
			await reorderByokKeyAction(id, direction);
			router.refresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to reorder key");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="flex items-center">
			<Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={saving || !canMoveUp} onClick={() => move("up")} aria-label="Move key up">
				<ArrowUp className="h-3.5 w-3.5" />
			</Button>
			<Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={saving || !canMoveDown} onClick={() => move("down")} aria-label="Move key down">
				<ArrowDown className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

function KeySection({ provider, mode, entries }: {
	provider: { id: string; name: string };
	mode: "priority" | "fallback";
	entries: ByokKeyEntry[];
}) {
	const isPriority = mode === "priority";
	const orderedEntries = entries.filter((entry) => entry.routingMode === mode).sort((a, b) => a.sortOrder - b.sortOrder);
	const atLimit = orderedEntries.length >= MAX_BYOK_KEYS_PER_MODE;

	return (
		<section className="space-y-3">
			<div className="flex items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<h2 className="text-base font-semibold">{isPriority ? "Prioritized" : "Fallback"}</h2>
						<span className="text-xs tabular-nums text-muted-foreground">{orderedEntries.length}/{MAX_BYOK_KEYS_PER_MODE}</span>
					</div>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{isPriority
							? "Attempted in order before Phaseo-managed provider routes."
							: "Attempted in order after Phaseo-managed provider routes are exhausted."}
					</p>
				</div>
				<BYOKInputDialog
					providerId={provider.id}
					providerName={provider.name}
					defaultAlwaysUse={isPriority}
					triggerLabel={atLimit ? "Key limit reached" : "Add key"}
					disabled={atLimit}
				/>
			</div>

			{orderedEntries.length === 0 ? (
				<div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border/70 px-4 py-6 text-center">
					<div>
						<KeyRound className="mx-auto h-4 w-4 text-muted-foreground" />
						<div className="mt-2 text-sm font-medium">No {isPriority ? "prioritized" : "fallback"} keys</div>
						<p className="mt-1 text-xs text-muted-foreground">Add a key to include it in this route order.</p>
					</div>
				</div>
			) : (
				<div className="divide-y rounded-xl border">
					{orderedEntries.map((entry, index) => (
						<div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2">
							<BYOKInputDialog
								providerId={provider.id}
								providerName={provider.name}
								initial={{ id: entry.id, providerId: entry.providerId, name: entry.name, prefix: entry.prefix, suffix: entry.suffix, enabled: entry.enabled, always_use: entry.alwaysUse }}
								trigger={(
									<div role="button" tabIndex={0} className="min-w-0 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/30" onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); }
									}}>
										<div className="flex min-w-0 items-center gap-2">
											<span className="truncate text-sm font-medium">{entry.name}</span>
											{!entry.enabled ? <Badge variant="secondary">Disabled</Badge> : null}
											{entry.errorMessage ? <Badge variant="destructive">Needs attention</Badge> : null}
										</div>
										<div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
											<span className="font-mono">{maskKey(entry.prefix, entry.suffix)}</span>
											<span>{formatLastUsed(entry.lastUsedAt)}</span>
										</div>
									</div>
								)}
							/>
							<div className="flex items-center">
								<OrderButtons id={entry.id} canMoveUp={index > 0} canMoveDown={index < orderedEntries.length - 1} />
								<DeleteKeyButton id={entry.id} />
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}

export default function ByokProviderKeys({ provider, entries }: {
	provider: { id: string; name: string };
	entries: ByokKeyEntry[];
}) {
	return (
		<div className="grid gap-8">
			<KeySection provider={provider} mode="priority" entries={entries} />
			<KeySection provider={provider} mode="fallback" entries={entries} />
		</div>
	);
}
