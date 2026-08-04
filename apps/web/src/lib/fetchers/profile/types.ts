import type { DailyActivityPoint, HeatmapDay } from "@/lib/profile";

export type ProfileUsageSummary = {
	requestSeries: DailyActivityPoint[];
	tokenSeries: DailyActivityPoint[];
	activitySeries30: DailyActivityPoint[];
	requestChange: number | null;
	tokenChange: number | null;
	totalRequests: number;
	totalTokens: number;
	avgPerDay: number;
	avgPerWeek: number;
	currentStreak: number;
	longestStreak: number;
	activeDays: number;
	topModels: Array<{ id: string; name: string; requests: number; tokens: number; spendNanos: number }>;
	heatmapDays: HeatmapDay[];
	creditsUsage: { today: string; week: string; month: string };
	byokUsage: { today: string; week: string; month: string };
	usageWorkspaceCount: number;
};

export type ProfileSnapshot = ProfileUsageSummary & {
	userId: string;
	displayName: string;
	email: string | null;
	avatarUrl: string | null;
	memberSince: string;
	workspaceName: string | null;
	publicProfileEnabled: boolean;
	publicProfileSlug: string;
	shareUrl: string;
};

export type SettingsProfileInitialData = {
	obfuscateInfo: boolean;
	profile: ProfileSnapshot | null;
};

export type SettingsProfileUsageData = {
	usage: ProfileUsageSummary | null;
};
