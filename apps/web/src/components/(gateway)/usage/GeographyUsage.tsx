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
	if (publicView) {
		if (rows.length === 0) {
			return (
				<p className="border-y border-border py-8 text-sm text-muted-foreground">
					Country usage will appear after gateway requests include sufficient geographic metadata.
				</p>
			);
		}

		const split = Math.ceil(rows.length / 2);
		const columns = [rows.slice(0, split), rows.slice(split)].filter((column) => column.length);
		return (
			<div className="grid gap-x-16 gap-y-1 border-y border-border py-4 md:grid-cols-2">
				{columns.map((column, columnIndex) => (
					<div key={`country-column-${columnIndex}`} className="space-y-1">
						{column.map((row, rowIndex) => {
							const position = columnIndex * split + rowIndex + 1;
							const isCountry = /^[A-Z]{2}$/.test(row.countryCode);
							const content = (
								<>
									<span className="relative flex size-7 items-center justify-center overflow-hidden rounded-md border bg-background">
										{isCountry ? (
											<Image src={`/flags/${row.countryCode.toLowerCase()}.svg`} alt="" fill className="object-cover" />
										) : (
											<Globe2 className="size-4 text-muted-foreground" />
										)}
									</span>
									<div className="min-w-0">
										<p className="truncate font-semibold underline decoration-transparent underline-offset-2 group-hover:decoration-current">
											{countryName(row.countryCode)}
										</p>
										<p className="text-xs text-muted-foreground">{compact(row.requests)} requests</p>
									</div>
									<div className="text-right">
										<p className="font-medium tabular-nums">{compact(row.tokens)} tokens</p>
										<p className="text-xs tabular-nums text-muted-foreground">{(row.sharePercent ?? 0).toFixed(1)}%</p>
									</div>
								</>
							);
							return (
								<div key={row.countryCode} className="grid min-h-14 grid-cols-[2rem_2rem_minmax(0,1fr)_auto] items-center gap-3 py-1.5">
									<span className="tabular-nums text-muted-foreground">{position}.</span>
									{isCountry ? (
										<Link href={`/countries/${row.countryCode.toLowerCase()}`} className="group contents">
											{content}
										</Link>
									) : content}
								</div>
							);
						})}
					</div>
				))}
			</div>
		);
	}

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
										<span>Spend: {((row.spendNanos ?? 0) / 1e9).toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 4 })}</span>
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
import Image from "next/image";
import Link from "next/link";
import { Globe2 } from "lucide-react";
