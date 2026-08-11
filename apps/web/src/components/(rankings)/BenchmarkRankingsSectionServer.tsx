import { BenchmarkRankingsSection } from "@/components/(rankings)/BenchmarkRankingsSection";
import { fetchFrontendRankingIntelligenceIndex } from "@/lib/fetchers/frontend/fetchRankingSections";

export async function BenchmarkRankingsSectionServer() {
	const result = await fetchFrontendRankingIntelligenceIndex(20).catch(() => ({ benchmark: null }));
	return result.benchmark ? <BenchmarkRankingsSection benchmark={result.benchmark} /> : null;
}
