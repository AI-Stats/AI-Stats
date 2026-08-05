export const releaseStatuses = ["released", "added", "announced", "coming_soon", "rumoured", "internal_testing"] as const;
export type ReleaseStatus = typeof releaseStatuses[number];
export function canNotifyRelease(status: ReleaseStatus, rumoursEnabled = false) {
  return status !== "rumoured" || rumoursEnabled;
}
