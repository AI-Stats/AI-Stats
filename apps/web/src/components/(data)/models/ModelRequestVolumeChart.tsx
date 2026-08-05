"use client";

import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { ModelPerformancePoint } from "@/lib/fetchers/models/getModelPerformance";

export default function ModelRequestVolumeChart({
	data,
}: {
	data: ModelPerformancePoint[];
}) {
	const chartData = data.map((point) => ({
		bucket: point.bucket,
		requests: point.requests,
		label: new Date(point.bucket).toLocaleTimeString("en-GB", {
			hour: "2-digit",
			minute: "2-digit",
			timeZone: "UTC",
		}),
	}));

	return (
		<div className="space-y-3">
			<div className="flex items-start justify-between gap-3">
				<p className="text-lg font-medium leading-none text-foreground">Aggregate requests</p>
				<span className="text-[11px] text-muted-foreground">Last 24 hours (UTC)</span>
			</div>
			<div className="h-[180px] w-full">
				<ResponsiveContainer width="100%" height="100%">
					<AreaChart data={chartData} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
						<defs>
							<linearGradient id="request-volume-fill" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
								<stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
						<XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
						<YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
						<Tooltip
							formatter={(value) => [Number(value).toLocaleString(), "Requests"]}
							labelFormatter={(_, payload) => {
								const bucket = payload?.[0]?.payload?.bucket;
								return bucket ? new Date(bucket).toLocaleString("en-GB", { timeZone: "UTC" }) : "";
							}}
						/>
						<Area
							type="monotone"
							dataKey="requests"
							stroke="var(--chart-1)"
							fill="url(#request-volume-fill)"
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
