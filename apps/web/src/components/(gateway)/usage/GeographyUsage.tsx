type GeographyRow = {
	countryCode: string;
	requests: number;
	tokens: number;
	sharePercent?: number;
	spendNanos?: number;
	successes?: number;
	averageLatencyMs?: number | null;
};

function countryName(code: string) {
	if (code === "OTHER") return "Other";
	try {
		return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code) ?? code;
	} catch {
		return code;
	}
}

function compact(value: number) {
	return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function GeographyUsage({
	rows,
	publicView = false,
}: {
	rows: GeographyRow[];
	publicView?: boolean;
}) {
	const maxRequests = Math.max(1, ...rows.map((row) => row.requests));
	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			{rows.length === 0 ? (
				<p className="p-6 text-sm text-muted-foreground">
					Country usage will appear after gateway requests include geographic metadata.
				</p>
			) : (
				<div className="divide-y">
					{rows.map((row) => {
						const successRate = row.requests > 0 && row.successes != null
							? (row.successes / row.requests) * 100
							: null;
						return (
							<div key={row.countryCode} className="relative grid gap-3 px-4 py-4 sm:grid-cols-[minmax(10rem,1fr)_repeat(3,minmax(5rem,auto))] sm:items-center sm:px-5">
								<div className="absolute inset-y-0 left-0 bg-primary/5" style={{ width: `${(row.requests / maxRequests) * 100}%` }} aria-hidden="true" />
								<div className="relative min-w-0">
									<p className="truncate font-medium">{countryName(row.countryCode)}</p>
									<p className="text-xs uppercase tracking-wide text-muted-foreground">{row.countryCode}</p>
								</div>
								<div className="relative">
									<p className="text-xs text-muted-foreground">Requests</p>
									<p className="font-medium tabular-nums">{compact(row.requests)}</p>
								</div>
								<div className="relative">
									<p className="text-xs text-muted-foreground">Tokens</p>
									<p className="font-medium tabular-nums">{compact(row.tokens)}</p>
								</div>
								<div className="relative">
									<p className="text-xs text-muted-foreground">{publicView ? "Share" : "Success"}</p>
									<p className="font-medium tabular-nums">
										{publicView
											? `${(row.sharePercent ?? 0).toFixed(1)}%`
											: successRate == null ? "—" : `${successRate.toFixed(1)}%`}
									</p>
								</div>
								{!publicView ? (
									<div className="relative sm:col-start-2 sm:col-span-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
										<span>Spend: ${((row.spendNanos ?? 0) / 1e9).toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 4 })}</span>
										<span>Average latency: {row.averageLatencyMs == null ? "—" : `${Math.round(row.averageLatencyMs)} ms`}</span>
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
