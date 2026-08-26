import { cn } from "@/lib/utils";

export function formatRoomResponseTimestamp(value: string): string | null {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	const now = new Date();
	const time = new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
	const isSameDay =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	if (isSameDay) return time;

	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();
	const startOfResponseDay = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	).getTime();
	const daysAgo = Math.round((startOfToday - startOfResponseDay) / 86_400_000);
	if (daysAgo > 0 && daysAgo < 7) {
		const dayName = new Intl.DateTimeFormat("en-GB", {
			weekday: "long",
		}).format(date);
		return `${dayName} ${time}`;
	}

	const dateLabel = new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		...(date.getFullYear() === now.getFullYear()
			? {}
			: { year: "numeric" as const }),
	}).format(date);
	return `${dateLabel}, ${time}`;
}

export function RoomResponseTimestamp({
	createdAt,
	className,
}: {
	createdAt: string;
	className?: string;
}) {
	const label = formatRoomResponseTimestamp(createdAt);
	if (!label) return null;

	return (
		<time
			dateTime={createdAt}
			className={cn(
				"select-none whitespace-nowrap text-xs text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/response:opacity-100 group-focus-within/response:opacity-100",
				className,
			)}
		>
			{label}
		</time>
	);
}
