import { apiApps, gatewayAsyncOperations, gatewayRequests, keys, v2Labs, v2ModelProviderRoutes, v2Models, v2Providers, v2WebPrivateUsageDaily } from "@phaseo/db/schema";
import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function getUsageMetadata(env: Env, args: { models?: string[]; providers?: string[]; apps?: string[] }) {
	const modelIds=[...new Set(args.models??[])].filter(Boolean);const providerIds=[...new Set(args.providers??[])].filter(Boolean);const appIds=[...new Set(args.apps??[])].filter(Boolean);
	const {db,client}=createDatabase(env);try{
		const models=modelIds.length?await db.select({model:v2Models,lab:v2Labs}).from(v2Models).leftJoin(v2Labs,eq(v2Labs.labSlug,v2Models.labSlug)).where(inArray(v2Models.modelSlug,modelIds)):[];
		const mappings=modelIds.length?await db.select({apiModelId:v2ModelProviderRoutes.modelSlug,modelId:v2ModelProviderRoutes.modelSlug}).from(v2ModelProviderRoutes).where(inArray(v2ModelProviderRoutes.modelSlug,modelIds)):[];
		const providers=providerIds.length?await db.select().from(v2Providers).where(inArray(v2Providers.providerSlug,providerIds)):[];
		const apps=appIds.length?await db.select().from(apiApps).where(inArray(apiApps.id,appIds)):[];
		const modelMetadata=new Map<string,Record<string,unknown>>();for(const {model,lab} of models)modelMetadata.set(model.modelSlug,{organisationId:model.labSlug,organisationName:lab?.name??model.labSlug,organisationColour:lab?.metadata&&typeof lab.metadata==="object"?(lab.metadata as Record<string,unknown>).colour??null:null,modelName:model.name});for(const mapping of mappings){const value=modelMetadata.get(mapping.modelId);if(value)modelMetadata.set(mapping.apiModelId,value);}
		const providerNames=new Map<string,string>();const providerMetadata=new Map<string,Record<string,unknown>>();for(const provider of providers){providerNames.set(provider.providerSlug,provider.name);providerMetadata.set(provider.providerSlug,{id:provider.providerSlug,name:provider.name,colour:provider.metadata&&typeof provider.metadata==="object"?(provider.metadata as Record<string,unknown>).colour??null:null,providerFamilyId:provider.providerFamilySlug,offerLabel:provider.offerLabel,offerScope:provider.offerScope,promptTrainingPolicy:provider.promptTrainingPolicy});}
		const appMetadata=new Map<string,Record<string,unknown>>();const appNames=new Map<string,string>();for(const app of apps){const title=app.title??app.appKey??app.id;appMetadata.set(app.id,{id:app.id,title,appKey:app.appKey,imageUrl:app.imageUrl});appNames.set(app.id,title);}
		return{modelMetadataEntries:[...modelMetadata.entries()],providerNameEntries:[...providerNames.entries()],providerMetadataEntries:[...providerMetadata.entries()],appMetadataEntries:[...appMetadata.entries()],appNameEntries:[...appNames.entries()]};
	}finally{await client.end({timeout:1});}
}

export async function loadRequestInvestigation(env: Env, input: { workspaceId: string; requestId: string }) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.execute<Record<string, unknown>>(sql`
			select request.*, app.title as app_title, app.app_key, app.image_url
			from ${gatewayRequests} request
			left join ${apiApps} app on app.id=request.app_id
			where request.workspace_id=${input.workspaceId}::uuid and request.request_id=${input.requestId}
			order by request.created_at desc limit 1
		`);
		if (!rows[0]) return null;
		const ioLogs = await db.execute<Record<string, unknown>>(sql`
			select * from observability.gateway_io_logs
			where workspace_id=${input.workspaceId}::uuid and request_id=${input.requestId}
			order by created_at desc limit 1
		`);
		return { request: rows[0], ioLog: ioLogs[0] ?? null };
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadSessionRequests(env: Env, input: { workspaceId: string; sessionId: string; from?: string | null; to?: string | null }) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.execute<Record<string, unknown>>(sql`
			select request.* from ${gatewayRequests} request
			where request.workspace_id=${input.workspaceId}::uuid and request.session_id=${input.sessionId}
				and (${input.from ?? null}::timestamptz is null or request.created_at>=${input.from ?? null}::timestamptz)
				and (${input.to ?? null}::timestamptz is null or request.created_at<=${input.to ?? null}::timestamptz)
			order by request.created_at asc limit 1000
		`);
		return [...rows];
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadFunStatsRows(env: Env, input: { workspaceId: string; from: string; to: string }) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			modelId: v2WebPrivateUsageDaily.canonicalModelId,
			provider: v2WebPrivateUsageDaily.provider,
			requests: v2WebPrivateUsageDaily.requests,
			costNanos: v2WebPrivateUsageDaily.totalCostNanos,
			latencySumMs: v2WebPrivateUsageDaily.latencySumMs,
			latencySamples: v2WebPrivateUsageDaily.latencySamples,
		}).from(v2WebPrivateUsageDaily).where(and(
			eq(v2WebPrivateUsageDaily.workspaceId, input.workspaceId),
			gte(v2WebPrivateUsageDaily.bucket15M, input.from),
			lte(v2WebPrivateUsageDaily.bucket15M, input.to),
		));
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadAsyncJobDetail(env: Env, input: { workspaceId: string; kind: string; internalId: string }) {
	const { db, client } = createDatabase(env);
	try {
		const [operation] = await db.select().from(gatewayAsyncOperations).where(and(
			eq(gatewayAsyncOperations.workspaceId, input.workspaceId),
			eq(gatewayAsyncOperations.kind, input.kind),
			eq(gatewayAsyncOperations.internalId, input.internalId),
		)).limit(1);
		if (!operation) return null;
		const requests = operation.requestId ? await db.execute<Record<string, unknown>>(sql`
			select * from ${gatewayRequests}
			where workspace_id=${input.workspaceId}::uuid and request_id=${operation.requestId}
			order by created_at desc limit 1
		`) : [];
		return { operation, request: requests[0] ?? null };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getAvailableUsageKeys(env:Env,workspaceId:string){const{db,client}=createDatabase(env);try{return await db.select({id:keys.id,name:keys.name,prefix:keys.prefix}).from(keys).where(and(eq(keys.workspaceId,workspaceId),ne(keys.status,"deleted"),ne(keys.name,"__chat_route_managed_key__"))).orderBy(asc(keys.createdAt));}finally{await client.end({timeout:1});}}

export async function loadRecentJobs(env:Env,input:{workspaceId:string;from:string;to:string;kind?:string|null;status?:string|null;provider?:string|null}){const{db,client}=createDatabase(env);try{const rows=await db.select().from(gatewayAsyncOperations).where(and(eq(gatewayAsyncOperations.workspaceId,input.workspaceId),inArray(gatewayAsyncOperations.kind,["video","batch"]),sql`${gatewayAsyncOperations.internalId} not like '__file__:%'`,gte(gatewayAsyncOperations.createdAt,input.from),lte(gatewayAsyncOperations.createdAt,input.to),input.kind?eq(gatewayAsyncOperations.kind,input.kind):undefined,input.status?eq(gatewayAsyncOperations.status,input.status):undefined,input.provider?eq(gatewayAsyncOperations.provider,input.provider):undefined)).orderBy(desc(gatewayAsyncOperations.updatedAt)).limit(50);return rows.map((row)=>{const meta=row.meta&&typeof row.meta==="object"&&!Array.isArray(row.meta)?row.meta as Record<string,unknown>:{};return{kind:row.kind,internal_id:row.internalId,request_id:row.requestId,session_id:row.sessionId,app_id:row.appId,provider:row.provider,model:row.model,status:row.status,billed_at:row.billedAt,created_at:row.createdAt,updated_at:row.updatedAt,meta,...meta,webhook:meta.webhook??null};});}finally{await client.end({timeout:1});}}

export async function loadUpstreamAttempts(env:Env,input:{workspaceId:string;from:string;to:string}){const{db,client}=createDatabase(env);try{const rows=await db.execute<Record<string,unknown>>(sql`
	select attempt.attempt_id id,coalesce(attempt.started_at,fact.occurred_at) created_at,fact.request_event_id gateway_request_id,fact.request_id,
		attempt.attempt_number sequence,1 round_number,attempt.attempt_number,attempt.attempt_number attempt_count,null::int internal_attempt_number,'upstream' stage,fact.endpoint,
		coalesce(fact.routed_model_slug,fact.requested_model_slug,fact.requested_model_input) model_id,
		coalesce(nullif(attempt.safe_metadata->>'provider',''),route.provider_slug,split_part(coalesce(attempt.provider_model_id,fact.provider_model_id),':',1)) provider,
		nullif(regexp_replace(coalesce(attempt.provider_model_id,fact.provider_model_id),'^[^:]+:',''),'') api_model_id,
		nullif(regexp_replace(coalesce(attempt.provider_model_id,fact.provider_model_id),'^[^:]+:',''),'') provider_model_slug,
		attempt.status_code,null::text status_text,attempt.success,case when attempt.success then 'success' else coalesce(attempt.failure_class,'error') end outcome,
		case when jsonb_typeof(attempt.safe_metadata->'retryable')='boolean' then (attempt.safe_metadata->>'retryable')::boolean end retryable,
		attempt.attempt_number>1 fallback_attempted,coalesce((attempt.safe_metadata->>'was_probe')::boolean,false) was_probe,
		case when attempt.safe_metadata->>'key_source'='byok' or fact.byok then 'byok' else 'gateway' end key_source,fact.key_id,attempt.upstream_response_id native_response_id,
		null::text provider_finish_reason,null::text finish_reason,attempt.latency_ms duration_ms,attempt.latency_ms,fact.generation_ms,fact.gateway_total_ms total_ms,
		'{}'::jsonb usage,fact.cost_nanos,fact.currency,coalesce(attempt.error_code,fact.error_code) error_code,attempt.failure_class error_type,null::text error_message,
		null::jsonb request_payload,null::jsonb response_payload,coalesce(attempt.safe_metadata,'{}'::jsonb)||jsonb_build_object('throughput',fact.throughput) metadata
	from observability.v2_request_facts fact join observability.v2_request_attempts attempt on attempt.request_event_id=fact.request_event_id
	left join catalog.v2_model_provider_routes route on route.provider_model_id=coalesce(attempt.provider_model_id,fact.provider_model_id)
	where fact.workspace_id=${input.workspaceId}::uuid and fact.occurred_at>=${input.from}::timestamptz and fact.occurred_at<=${input.to}::timestamptz
	order by fact.occurred_at desc,attempt.attempt_number asc limit 500
`);return[...rows];}finally{await client.end({timeout:1});}}

type RequestStringColumn="model"|"provider"|"app"|"endpoint"|"finishReason"|"errorCode"|"statusCode"|"key"|"requestId"|"session"|"source";
export async function loadUsageRequestPage(env:Env,input:{workspaceId:string;from:string;to:string;limit:number;stringFilters:Array<{column:RequestStringColumn;value:string;negate:boolean}>;success?:{value:boolean;negate:boolean};stream?:{value:boolean;negate:boolean};tokenFilters:Array<{column:"input"|"output"|"total";operator:"eq"|"lte"|"gte"|"between";value:number;max?:number}>}){
	const{db,client}=createDatabase(env);try{const columns={model:gatewayRequests.modelId,provider:gatewayRequests.provider,app:gatewayRequests.appId,endpoint:gatewayRequests.endpoint,finishReason:gatewayRequests.finishReason,errorCode:gatewayRequests.errorCode,statusCode:gatewayRequests.statusCode,key:gatewayRequests.keyId,requestId:gatewayRequests.requestId,session:gatewayRequests.sessionId,source:gatewayRequests.clientSourceId} as const;const conditions:any[]=[eq(gatewayRequests.workspaceId,input.workspaceId),gte(gatewayRequests.createdAt,input.from),lte(gatewayRequests.createdAt,input.to),sql`${gatewayRequests.endpoint} not in ('video.generation','batch','music.generate')`];for(const filter of input.stringFilters){const column=columns[filter.column];conditions.push(filter.negate?ne(column as any,filter.value as any):eq(column as any,filter.value as any));}if(input.success)conditions.push(input.success.negate?ne(gatewayRequests.success,input.success.value):eq(gatewayRequests.success,input.success.value));if(input.stream)conditions.push(input.stream.negate?ne(gatewayRequests.stream,input.stream.value):eq(gatewayRequests.stream,input.stream.value));const tokenColumns={input:gatewayRequests.usageInputTokens,output:gatewayRequests.usageOutputTokens,total:gatewayRequests.usageTotalTokens};for(const filter of input.tokenFilters){const column=tokenColumns[filter.column];if(filter.operator==="eq")conditions.push(eq(column,filter.value));else if(filter.operator==="lte")conditions.push(lte(column,filter.value));else if(filter.operator==="between"&&filter.max!=null)conditions.push(and(gte(column,filter.value),lte(column,filter.max)));else conditions.push(gte(column,filter.value));}
		const rows=await db.select().from(gatewayRequests).where(and(...conditions)).orderBy(desc(gatewayRequests.createdAt),desc(gatewayRequests.id)).limit(input.limit+1);return rows.map((row)=>({id:row.id,request_id:row.requestId,created_at:row.createdAt,endpoint:row.endpoint,model_id:row.modelId,requested_model_id:row.requestedModelId,routed_model_id:row.routedModelId,provider:row.provider,native_response_id:row.nativeResponseId,stream:row.stream,session_id:row.sessionId,app_id:row.appId,usage:row.usage,usage_input_tokens:row.usageInputTokens,usage_output_tokens:row.usageOutputTokens,usage_total_tokens:row.usageTotalTokens,cost_nanos:row.costNanos,generation_ms:row.generationMs,latency_ms:row.latencyMs,finish_reason:row.finishReason,success:row.success,status_code:row.statusCode,error_code:row.errorCode,client_source_id:row.clientSourceId,client_source_name:row.clientSourceName,client_source_kind:row.clientSourceKind,client_source_version:row.clientSourceVersion,client_source_detection:row.clientSourceDetection,key_id:row.keyId,throughput:row.throughput}));
	}finally{await client.end({timeout:1});}
}

export async function loadObservabilityWindow(env:Env,input:{workspaceId:string;from:string;to:string;limit:number}){const{db,client}=createDatabase(env);try{const rows=await db.execute<Record<string,unknown>>(sql`select created_at,model_id,provider,app_id,key_id,usage,cost_nanos,success,error_payload,error_message,pricing_lines from ${gatewayRequests} where workspace_id=${input.workspaceId}::uuid and created_at>=${input.from}::timestamptz and created_at<=${input.to}::timestamptz and endpoint not in ('video.generation','batch','music.generate') order by created_at asc limit ${input.limit+1}`);return{rows:[...rows].slice(0,input.limit),isSampled:rows.length>input.limit,limit:input.limit};}finally{await client.end({timeout:1});}}

export async function getUsageRollupDimensions(env:Env,input:{workspaceId:string;from:string;to:string}){const{db,client}=createDatabase(env);try{return await db.select({canonical_model_id:v2WebPrivateUsageDaily.canonicalModelId,provider:v2WebPrivateUsageDaily.provider,app_id:v2WebPrivateUsageDaily.appId}).from(v2WebPrivateUsageDaily).where(and(eq(v2WebPrivateUsageDaily.workspaceId,input.workspaceId),gte(v2WebPrivateUsageDaily.bucket15M,input.from),lte(v2WebPrivateUsageDaily.bucket15M,input.to)));}finally{await client.end({timeout:1});}}

export async function getLifecycleModels(env:Env,input:{windowStart:string;windowEnd:string}){const{db,client}=createDatabase(env);try{const rows=await db.select().from(v2Models).where(and(eq(v2Models.hidden,false),or(and(gte(v2Models.retiredAt,input.windowStart),lte(v2Models.retiredAt,input.windowEnd)),and(gte(v2Models.deprecatedAt,input.windowStart),lte(v2Models.deprecatedAt,input.windowEnd)))));return rows.map((row)=>({model_id:row.modelSlug,name:row.name,organisation_id:row.labSlug,deprecation_date:row.deprecatedAt,retirement_date:row.retiredAt,previous_model_id:row.previousModelSlug}));}finally{await client.end({timeout:1});}}

export async function getLifecycleIdMappings(env:Env,usedIds:string[]){if(!usedIds.length)return new Map<string,string>();const{db,client}=createDatabase(env);try{const rows=await db.select({providerModelId:v2ModelProviderRoutes.providerModelId,modelSlug:v2ModelProviderRoutes.modelSlug}).from(v2ModelProviderRoutes).where(or(inArray(v2ModelProviderRoutes.modelSlug,usedIds),inArray(v2ModelProviderRoutes.providerModelId,usedIds)));const map=new Map<string,string>();for(const row of rows){map.set(row.modelSlug,row.modelSlug);map.set(row.providerModelId,row.modelSlug);}return map;}finally{await client.end({timeout:1});}}

export async function getReplacementModels(env:Env,previousIds:string[]){if(!previousIds.length)return new Map<string,string>();const{db,client}=createDatabase(env);try{const rows=await db.select({modelId:v2Models.modelSlug,previousId:v2Models.previousModelSlug}).from(v2Models).where(and(eq(v2Models.hidden,false),inArray(v2Models.previousModelSlug,previousIds)));const map=new Map<string,string>();for(const row of rows)if(row.previousId&&!map.has(row.previousId))map.set(row.previousId,row.modelId);return map;}finally{await client.end({timeout:1});}}
