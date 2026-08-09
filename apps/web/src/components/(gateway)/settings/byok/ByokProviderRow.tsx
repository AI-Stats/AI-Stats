"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import BYOKInputDialog from "@/components/(gateway)/settings/byok/BYOKInputDialog";
import DeleteKeyButton from "@/components/(gateway)/settings/byok/DeleteKeyButton";
import { reorderByokKeyAction } from "@/app/(dashboard)/settings/byok/actions";
import { MAX_BYOK_KEYS_PER_PROVIDER } from "@/lib/byok/constants";

type Entry = {
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

type ByokProviderRowProps = {
	provider: {
		id: string;
		name: string;
		logoId: string;
	};
	entries: Entry[];
};

function maskKey(prefix?: string, suffix?: string) {
	const p = prefix ?? "";
	const s = suffix ?? "";
	return `${p}${"*".repeat(6)}${s}`;
}

function formatLastUsed(value: string | null) {
	if (!value) return "Never used";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Never used";
	return `Last used ${new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date)}`;
}

function OrderButtons({ id, canMoveUp, canMoveDown }: {
	id: string;
	canMoveUp: boolean;
	canMoveDown: boolean;
}) {
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

export default function ByokProviderRow({ provider, entries }: ByokProviderRowProps) {
	const orderedEntries = [...entries].sort((left, right) => {
		if (left.routingMode !== right.routingMode) {
			return left.routingMode === "priority" ? -1 : 1;
		}
		return left.sortOrder - right.sortOrder;
	});
	return (
		<div className="px-3 py-2">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<Logo id={provider.logoId} alt={provider.name} width={24} height={24} className="h-6 w-6 object-contain" />
					<div className="truncate text-sm font-medium">{provider.name}</div>
				</div>
				<div className="flex items-center gap-2">
					{entries.length > 0 ? (
						<span className="text-xs tabular-nums text-muted-foreground">
							{entries.length}/{MAX_BYOK_KEYS_PER_PROVIDER}
						</span>
					) : null}
					<BYOKInputDialog
						providerId={provider.id}
						providerName={provider.name}
						triggerLabel={entries.length >= MAX_BYOK_KEYS_PER_PROVIDER ? "Key limit reached" : "Add key"}
						disabled={entries.length >= MAX_BYOK_KEYS_PER_PROVIDER}
					/>
				</div>
			</div>
			{orderedEntries.length > 0 ? (
				<div className="mt-2 space-y-1 pl-8">
					{orderedEntries.map((entry, index) => (
						<div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
							<BYOKInputDialog
								providerId={provider.id}
								providerName={provider.name}
								initial={{
									id: entry.id,
									providerId: entry.providerId,
									name: entry.name,
									prefix: entry.prefix,
									suffix: entry.suffix,
									enabled: entry.enabled,
									always_use: entry.alwaysUse,
								}}
								trigger={(
									<div
										role="button"
										tabIndex={0}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												event.currentTarget.click();
											}
										}}
										className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/30"
									>
										<div className="min-w-0">
											<div className="truncate text-xs font-medium">{entry.name}</div>
										<div className="truncate font-mono text-xs text-zinc-500">
											{maskKey(entry.prefix, entry.suffix)}
										</div>
										<div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
											<span>{formatLastUsed(entry.lastUsedAt)}</span>
											<span title={entry.errorMessage ?? undefined}>
												{entry.errorMessage
													? "Needs attention"
													: entry.verificationStatus?.startsWith("format_valid")
														? "Format checked only"
														: "Validation status unknown"}
											</span>
										</div>
										</div>
										<div className="flex items-center gap-2">
											<Badge variant="outline">
												{entry.routingMode === "priority" ? "Priority" : "Fallback"}
											</Badge>
											{!entry.enabled ? <Badge variant="secondary">Disabled</Badge> : null}
										</div>
									</div>
								)}
							/>
							<div className="flex items-center">
								<OrderButtons
									id={entry.id}
									canMoveUp={orderedEntries.slice(0, index).some((candidate) => candidate.routingMode === entry.routingMode)}
									canMoveDown={orderedEntries.slice(index + 1).some((candidate) => candidate.routingMode === entry.routingMode)}
								/>
								<DeleteKeyButton id={entry.id} />
							</div>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
