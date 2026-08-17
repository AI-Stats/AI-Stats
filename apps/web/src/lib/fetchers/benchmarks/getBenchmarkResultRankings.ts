import { getPlanetScalePool } from "@/lib/database/planetscale";

export interface DerivedBenchmarkRankingRow {
	resultId: string;
	modelId: string;
	benchmarkId: string;
	score: string | number | null;
	scoreNumeric: number | null;
	isSelfReported: boolean;
	otherInfo: string | null;
	sourceLink: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	occurIndex: number | null;
	variant: string | null;
	resultKey: string | null;
	rank: number | null;
	totalRankedModels: number | null;
	isPrimaryResult: boolean;
	modelName: string;
	releaseDate: string | null;
	announcementDate: string | null;
	organisationId: string;
	organisationName: string | null;
	organisationColour: string | null;
}

interface RawDerivedBenchmarkRankingRow {
	result_id: string;
	model_id: string;
	benchmark_id: string;
	score: string | number | null;
	score_numeric: string | number | null;
	is_self_reported: boolean | null;
	other_info: string | null;
	source_link: string | null;
	created_at: string | null;
	updated_at: string | null;
	occur_idx: number | null;
	variant: string | null;
	result_key: string | null;
	benchmark_rank: string | number | null;
	total_ranked_models: string | number | null;
	is_primary_result: boolean | null;
	model_name: string | null;
	release_date: string | null;
	announcement_date: string | null;
	organisation_id: string | null;
	organisation_name: string | null;
	organisation_colour: string | null;
}

function finiteNumber(value: string | number | null): number | null {
	if (value == null) return null;
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: string | number | null): number | null {
	const parsed = finiteNumber(value);
	if (parsed == null || parsed < 1) return null;
	return Math.trunc(parsed);
}

export function mapDerivedBenchmarkRankingRow(
	row: RawDerivedBenchmarkRankingRow
): DerivedBenchmarkRankingRow {
	return {
		resultId: row.result_id,
		modelId: row.model_id,
		benchmarkId: row.benchmark_id,
		score: row.score,
		scoreNumeric: finiteNumber(row.score_numeric),
		isSelfReported: Boolean(row.is_self_reported),
		otherInfo: row.other_info ?? null,
		sourceLink: row.source_link ?? null,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null,
		occurIndex: row.occur_idx ?? null,
		variant: row.variant ?? null,
		resultKey: row.result_key ?? null,
		rank: positiveInteger(row.benchmark_rank),
		totalRankedModels: positiveInteger(row.total_ranked_models),
		isPrimaryResult: Boolean(row.is_primary_result),
		modelName: row.model_name ?? row.model_id,
		releaseDate: row.release_date ?? null,
		announcementDate: row.announcement_date ?? null,
		organisationId: row.organisation_id ?? "",
		organisationName: row.organisation_name ?? null,
		organisationColour: row.organisation_colour ?? null,
	};
}

export async function getBenchmarkResultRankings(args: {
	benchmarkIds: string[];
	modelId?: string | null;
	includeHidden: boolean;
	limitPerBenchmark?: number | null;
}): Promise<DerivedBenchmarkRankingRow[]> {
	const benchmarkIds = Array.from(
		new Set(args.benchmarkIds.map((id) => id.trim()).filter(Boolean))
	);
	if (!benchmarkIds.length) return [];

	const result = await getPlanetScalePool().query<RawDerivedBenchmarkRankingRow>(`
		with target_benchmarks as (
			select id,ascending_order,type from data_benchmarks
			where id=any($1::text[]) and ($2::text is null or exists (
				select 1 from data_benchmark_results requested
				where requested.benchmark_id=data_benchmarks.id and requested.model_id=$2
			))
		), scoped_results as (
			select result.*,model.name model_name,model.release_date,model.announcement_date,
				model.organisation_id,organisation.name organisation_name,organisation.colour organisation_colour,
				target.ascending_order,
				case when target.type='percentage' and abs(result.score_numeric)>0 and abs(result.score_numeric)<=1
					then result.score_numeric*100 else result.score_numeric end comparable_score
			from target_benchmarks target
			join data_benchmark_results result on result.benchmark_id=target.id
			join data_models model on model.model_id=result.model_id
			left join data_organisations organisation on organisation.organisation_id=model.organisation_id
			where $3::boolean or not coalesce(model.hidden,false)
		), model_scores as (
			select benchmark_id,model_id,bool_or(ascending_order is false) lower_is_better,
				case when bool_or(ascending_order is false) then min(comparable_score) else max(comparable_score) end primary_score
			from scoped_results where comparable_score is not null group by benchmark_id,model_id
		), ranked_models as (
			select benchmark_id,model_id,primary_score,
				rank() over (partition by benchmark_id order by
					case when lower_is_better then primary_score end asc nulls last,
					case when not lower_is_better then primary_score end desc nulls last) benchmark_rank,
				count(*) over (partition by benchmark_id) total_ranked_models
			from model_scores
		), selected_models as (
			select roster.benchmark_id,roster.model_id,ranked.primary_score,ranked.benchmark_rank,ranked.total_ranked_models
			from (select distinct benchmark_id,model_id from scoped_results) roster
			left join ranked_models ranked using (benchmark_id,model_id)
			where ($2::text is null or roster.model_id=$2)
				and ($4::integer is null or ranked.benchmark_rank>=1 and ranked.benchmark_rank<=greatest($4,1))
		)
		select scoped.id result_id,scoped.model_id,scoped.benchmark_id,scoped.score,scoped.score_numeric,
			scoped.is_self_reported,scoped.other_info,scoped.source_link,scoped.created_at,scoped.updated_at,
			scoped.occur_idx,scoped.variant,scoped.result_key,ranked.benchmark_rank,ranked.total_ranked_models,
			ranked.primary_score is not null and scoped.comparable_score is not distinct from ranked.primary_score is_primary_result,
			scoped.model_name,scoped.release_date,scoped.announcement_date,scoped.organisation_id,
			scoped.organisation_name,scoped.organisation_colour
		from scoped_results scoped join selected_models ranked using (benchmark_id,model_id)
		order by scoped.benchmark_id,ranked.benchmark_rank,scoped.model_id,scoped.occur_idx,scoped.id
	`, [benchmarkIds, args.modelId ?? null, args.includeHidden, args.limitPerBenchmark ?? null]);
	return result.rows.map(mapDerivedBenchmarkRankingRow);
}
