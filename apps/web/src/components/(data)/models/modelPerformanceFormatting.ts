const MINUTES_THRESHOLD_SECONDS = 1_000;

export function formatProviderDuration(valueMs: number | null): string {
	if (valueMs == null || !Number.isFinite(valueMs)) return "-";

	const seconds = Math.max(0, valueMs) / 1_000;
	if (seconds > MINUTES_THRESHOLD_SECONDS) {
		const minutes = seconds / 60;
		return `${minutes >= 100 ? Math.round(minutes) : minutes.toFixed(1)} min`;
	}

	const formattedSeconds =
		seconds >= 100
			? Math.round(seconds).toLocaleString("en-GB")
			: seconds >= 10
				? seconds.toFixed(1)
				: seconds.toFixed(2);
	return `${formattedSeconds} s`;
}
