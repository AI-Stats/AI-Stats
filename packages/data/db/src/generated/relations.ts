import { relations } from "drizzle-orm/relations";
import { users, byokKeys, workspaces, creditGrants, creditGrantRedemptions, usersInAuth, creditLedger, dataContributionConsentEvents, dataContributions, emailOutbox, apiApps, gatewayAsyncOperations, gatewayBatchRequests, gatewayDynamicRouteVersions, gatewayDynamicRoutes, gatewayIoLogs, presets, gatewayObservabilityEvents, gatewayPresetTestRuns, gatewayFeedback, gatewayPresetTestRunItems, gatewayProviderEvents, keys, gatewayRealtimeSessions, v2Models, v2Labs, broadcastDestinationRuleGroups, broadcastDestinationRules, gatewayWebhookEndpoints, managementKeys, monitorHistoryCommits, monitorHistoryEvents, oauthAppMetadata, oauthAuthorizationCodes, oauthAuthorizations, oauthDeviceCodes, oauthRefreshTokens, workspaceBroadcastDestinations, otelExportOutbox, user, passkey, presetVersions, workspaceClassifiers, requestClassifications, securityKeyReports, session, twoFactor, v2RequestFacts, v2AnalyticsOutbox, v2Benchmarks, v2BenchmarkResults, v2ModelProviderRoutes, v2CapabilityConstraints, v2Providers, v2CapabilityEvidence, v2CatalogueAdminChanges, v2ControlPlaneReleases, v2CreditReservations, v2RouteCapabilities, v2ExecutionPlans, v2RouteVariants, v2ModelAliases, v2ModelFamilies, v2ModelPageNotices, v2MeterDefinitions, v2PricingSkuMeters, v2PricingSkus, v2ServiceTiers, v2PrivateUsageDaily, v2AdapterPrimitives, v2ProviderAuthProfiles, v2CapabilityAdapters, v2ProviderCapabilityAdapters, v2ProviderEndpoints, v2ProviderCountryRestrictions, v2ProviderRegions, wallets, webCacheGenerations, webCachePurgeEvents, workspaceGuardrails, workspaceInvites, workspaceJoinRequests, ssoProvider, v2CreditLedger, v2PublicUsageDaily, v2PublicUsageHourly, v2RequestAttempts, v2RequestArtifacts, gatewayRequests, gatewayRequests202603, gatewayRequests202604, gatewayRequests202605, gatewayRequests202606, gatewayRequests202607, gatewayRequests202608, gatewayRequests202609, gatewayRequestsDefault, v2RequestFeedback, v2RequestPricingLines, v2RequestRoutingDecisions, v2RequestUsage, account, accountGuardrailSettings, workspacePublisherHandleAliases, workspaceSettings, keyGuardrails, presetLineage, gatewayDynamicRouteKeys, broadcastDestinationKeys, workspaceMemberGuardrails, workspaceMembers, v2SubscriptionPlans, v2SubscriptionPlanFeatures, v2LabLinks, v2SubscriptionPlanModels, workspaceByokMonthlyUsage, v2CatalogueSourceOverrides, v2ModelDetails, gatewayBatchFileUploads, v2ModelLinks, v2PrivateUsageDailyMeters, v2PublicUsageDailyMeters, v2PublicUsageHourlyMeters, v2CapabilityParameters, v2RouteParameterSupport, gatewayRequestCharges, modelDiscoveryRuns, modelDiscoverySeenModels, catalogueInteractionPuzzles, catalogueGameResults, requestClassificationDaily, gatewayBatchKeyUsageRecords, v2PublicProviderHealthDaily, gatewayWalletReservations, gatewayUpstreamRequests202607, gatewayUpstreamRequests202608, gatewayUpstreamRequests202609, gatewayUpstreamRequestsDefault } from "./schema";

export const byokKeysRelations = relations(byokKeys, ({one}) => ({
	user: one(users, {
		fields: [byokKeys.createdBy],
		references: [users.userId]
	}),
	workspace: one(workspaces, {
		fields: [byokKeys.workspaceId],
		references: [workspaces.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	byokKeys: many(byokKeys),
	keys: many(keys),
	managementKeys: many(managementKeys),
	presetVersions: many(presetVersions),
	presets: many(presets),
	securityKeyReports: many(securityKeyReports),
	workspace: one(workspaces, {
		fields: [users.defaultWorkspaceId],
		references: [workspaces.id],
		relationName: "users_defaultWorkspaceId_workspaces_id"
	}),
	usersInAuth: one(usersInAuth, {
		fields: [users.userId],
		references: [usersInAuth.id]
	}),
	workspaceInvites: many(workspaceInvites),
	workspaceJoinRequests_decidedBy: many(workspaceJoinRequests, {
		relationName: "workspaceJoinRequests_decidedBy_users_userId"
	}),
	workspaceJoinRequests_requesterUserId: many(workspaceJoinRequests, {
		relationName: "workspaceJoinRequests_requesterUserId_users_userId"
	}),
	accountGuardrailSettings: many(accountGuardrailSettings),
	workspaces: many(workspaces, {
		relationName: "workspaces_ownerUserId_users_userId"
	}),
	workspaceMemberGuardrails: many(workspaceMemberGuardrails),
	workspaceMembers: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({one, many}) => ({
	byokKeys: many(byokKeys),
	creditGrantRedemptions: many(creditGrantRedemptions),
	creditLedgers: many(creditLedger),
	dataContributionConsentEvents: many(dataContributionConsentEvents),
	dataContributions: many(dataContributions),
	emailOutboxes: many(emailOutbox),
	gatewayAsyncOperations: many(gatewayAsyncOperations),
	gatewayBatchRequests: many(gatewayBatchRequests),
	gatewayDynamicRoutes: many(gatewayDynamicRoutes),
	gatewayIoLogs: many(gatewayIoLogs),
	gatewayObservabilityEvents: many(gatewayObservabilityEvents),
	gatewayPresetTestRunItems: many(gatewayPresetTestRunItems),
	gatewayPresetTestRuns: many(gatewayPresetTestRuns),
	gatewayProviderEvents: many(gatewayProviderEvents),
	gatewayRealtimeSessions: many(gatewayRealtimeSessions),
	apiApps: many(apiApps),
	gatewayWebhookEndpoints: many(gatewayWebhookEndpoints),
	keys: many(keys),
	managementKeys: many(managementKeys),
	oauthAppMetadata: many(oauthAppMetadata),
	oauthAuthorizationCodes: many(oauthAuthorizationCodes),
	gatewayFeedbacks: many(gatewayFeedback),
	oauthAuthorizations: many(oauthAuthorizations),
	oauthDeviceCodes: many(oauthDeviceCodes),
	oauthRefreshTokens: many(oauthRefreshTokens),
	otelExportOutboxes: many(otelExportOutbox),
	presets: many(presets),
	requestClassifications: many(requestClassifications),
	securityKeyReports: many(securityKeyReports),
	users: many(users, {
		relationName: "users_defaultWorkspaceId_workspaces_id"
	}),
	v2AnalyticsOutboxes: many(v2AnalyticsOutbox),
	v2CreditReservations: many(v2CreditReservations),
	v2PrivateUsageDailies: many(v2PrivateUsageDaily),
	wallets: many(wallets),
	workspaceBroadcastDestinations: many(workspaceBroadcastDestinations),
	workspaceClassifiers: many(workspaceClassifiers),
	workspaceGuardrails: many(workspaceGuardrails),
	workspaceInvites: many(workspaceInvites),
	workspaceJoinRequests: many(workspaceJoinRequests),
	v2CreditLedgers: many(v2CreditLedger),
	v2RequestFacts: many(v2RequestFacts),
	v2RequestFeedbacks: many(v2RequestFeedback),
	workspacePublisherHandleAliases: many(workspacePublisherHandleAliases),
	workspaceSettings: many(workspaceSettings),
	user: one(users, {
		fields: [workspaces.ownerUserId],
		references: [users.userId],
		relationName: "workspaces_ownerUserId_users_userId"
	}),
	workspaceMemberGuardrails: many(workspaceMemberGuardrails),
	workspaceMembers: many(workspaceMembers),
	workspaceByokMonthlyUsages: many(workspaceByokMonthlyUsage),
	gatewayBatchFileUploads: many(gatewayBatchFileUploads),
	gatewayRequestCharges: many(gatewayRequestCharges),
	requestClassificationDailies: many(requestClassificationDaily),
	gatewayBatchKeyUsageRecords: many(gatewayBatchKeyUsageRecords),
	gatewayWalletReservations: many(gatewayWalletReservations),
	gatewayUpstreamRequests202607s: many(gatewayUpstreamRequests202607),
	gatewayUpstreamRequests202608s: many(gatewayUpstreamRequests202608),
	gatewayUpstreamRequests202609s: many(gatewayUpstreamRequests202609),
	gatewayUpstreamRequestsDefaults: many(gatewayUpstreamRequestsDefault),
	gatewayRequests202603s: many(gatewayRequests202603),
	gatewayRequests202604s: many(gatewayRequests202604),
	gatewayRequests202605s: many(gatewayRequests202605),
	gatewayRequests202606s: many(gatewayRequests202606),
	gatewayRequests202607s: many(gatewayRequests202607),
	gatewayRequests202608s: many(gatewayRequests202608),
	gatewayRequests202609s: many(gatewayRequests202609),
	gatewayRequestsDefaults: many(gatewayRequestsDefault),
}));

export const creditGrantRedemptionsRelations = relations(creditGrantRedemptions, ({one}) => ({
	creditGrant: one(creditGrants, {
		fields: [creditGrantRedemptions.grantId],
		references: [creditGrants.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [creditGrantRedemptions.userId],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [creditGrantRedemptions.workspaceId],
		references: [workspaces.id]
	}),
}));

export const creditGrantsRelations = relations(creditGrants, ({one, many}) => ({
	creditGrantRedemptions: many(creditGrantRedemptions),
	usersInAuth: one(usersInAuth, {
		fields: [creditGrants.createdBy],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	creditGrantRedemptions: many(creditGrantRedemptions),
	creditGrants: many(creditGrants),
	dataContributionConsentEvents: many(dataContributionConsentEvents),
	emailOutboxes: many(emailOutbox),
	gatewayDynamicRouteVersions: many(gatewayDynamicRouteVersions),
	gatewayDynamicRoutes: many(gatewayDynamicRoutes),
	gatewayWebhookEndpoints: many(gatewayWebhookEndpoints),
	keys: many(keys),
	oauthAppMetadata: many(oauthAppMetadata),
	oauthAuthorizationCodes: many(oauthAuthorizationCodes),
	oauthAuthorizations: many(oauthAuthorizations),
	oauthDeviceCodes: many(oauthDeviceCodes),
	oauthRefreshTokens: many(oauthRefreshTokens),
	users: many(users),
	v2CatalogueAdminChanges: many(v2CatalogueAdminChanges),
	v2ControlPlaneReleases_createdBy: many(v2ControlPlaneReleases, {
		relationName: "v2ControlPlaneReleases_createdBy_usersInAuth_id"
	}),
	v2ControlPlaneReleases_publishedBy: many(v2ControlPlaneReleases, {
		relationName: "v2ControlPlaneReleases_publishedBy_usersInAuth_id"
	}),
	v2ControlPlaneReleases_reviewedBy: many(v2ControlPlaneReleases, {
		relationName: "v2ControlPlaneReleases_reviewedBy_usersInAuth_id"
	}),
	webCacheGenerations: many(webCacheGenerations),
	webCachePurgeEvents: many(webCachePurgeEvents),
	workspaceClassifiers: many(workspaceClassifiers),
	workspaceSettings: many(workspaceSettings),
	gatewayDynamicRouteKeys: many(gatewayDynamicRouteKeys),
	v2CatalogueSourceOverrides: many(v2CatalogueSourceOverrides),
	catalogueGameResults: many(catalogueGameResults),
}));

export const creditLedgerRelations = relations(creditLedger, ({one}) => ({
	workspace: one(workspaces, {
		fields: [creditLedger.workspaceId],
		references: [workspaces.id]
	}),
}));

export const dataContributionConsentEventsRelations = relations(dataContributionConsentEvents, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [dataContributionConsentEvents.actorUserId],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [dataContributionConsentEvents.workspaceId],
		references: [workspaces.id]
	}),
}));

export const dataContributionsRelations = relations(dataContributions, ({one, many}) => ({
	workspace: one(workspaces, {
		fields: [dataContributions.workspaceId],
		references: [workspaces.id]
	}),
	requestClassifications: many(requestClassifications),
}));

export const emailOutboxRelations = relations(emailOutbox, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [emailOutbox.userId],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [emailOutbox.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayAsyncOperationsRelations = relations(gatewayAsyncOperations, ({one}) => ({
	apiApp: one(apiApps, {
		fields: [gatewayAsyncOperations.appId],
		references: [apiApps.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayAsyncOperations.workspaceId],
		references: [workspaces.id]
	}),
}));

export const apiAppsRelations = relations(apiApps, ({one, many}) => ({
	gatewayAsyncOperations: many(gatewayAsyncOperations),
	workspace: one(workspaces, {
		fields: [apiApps.workspaceId],
		references: [workspaces.id]
	}),
	v2PrivateUsageDailies: many(v2PrivateUsageDaily),
	v2PublicUsageDailies: many(v2PublicUsageDaily),
	v2PublicUsageHourlies: many(v2PublicUsageHourly),
	v2RequestFacts: many(v2RequestFacts),
	gatewayUpstreamRequests202607s: many(gatewayUpstreamRequests202607),
	gatewayUpstreamRequests202608s: many(gatewayUpstreamRequests202608),
	gatewayUpstreamRequests202609s: many(gatewayUpstreamRequests202609),
	gatewayUpstreamRequestsDefaults: many(gatewayUpstreamRequestsDefault),
	gatewayRequests202603s: many(gatewayRequests202603),
	gatewayRequests202604s: many(gatewayRequests202604),
	gatewayRequests202605s: many(gatewayRequests202605),
	gatewayRequests202606s: many(gatewayRequests202606),
	gatewayRequests202607s: many(gatewayRequests202607),
	gatewayRequests202608s: many(gatewayRequests202608),
	gatewayRequests202609s: many(gatewayRequests202609),
	gatewayRequestsDefaults: many(gatewayRequestsDefault),
}));

export const gatewayBatchRequestsRelations = relations(gatewayBatchRequests, ({one}) => ({
	workspace: one(workspaces, {
		fields: [gatewayBatchRequests.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayDynamicRouteVersionsRelations = relations(gatewayDynamicRouteVersions, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [gatewayDynamicRouteVersions.createdBy],
		references: [usersInAuth.id]
	}),
	gatewayDynamicRoute: one(gatewayDynamicRoutes, {
		fields: [gatewayDynamicRouteVersions.routeId],
		references: [gatewayDynamicRoutes.id]
	}),
}));

export const gatewayDynamicRoutesRelations = relations(gatewayDynamicRoutes, ({one, many}) => ({
	gatewayDynamicRouteVersions: many(gatewayDynamicRouteVersions),
	usersInAuth: one(usersInAuth, {
		fields: [gatewayDynamicRoutes.createdBy],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayDynamicRoutes.workspaceId],
		references: [workspaces.id]
	}),
	gatewayDynamicRouteKeys: many(gatewayDynamicRouteKeys),
}));

export const gatewayIoLogsRelations = relations(gatewayIoLogs, ({one}) => ({
	workspace: one(workspaces, {
		fields: [gatewayIoLogs.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayObservabilityEventsRelations = relations(gatewayObservabilityEvents, ({one}) => ({
	preset: one(presets, {
		fields: [gatewayObservabilityEvents.presetId],
		references: [presets.id]
	}),
	gatewayPresetTestRun: one(gatewayPresetTestRuns, {
		fields: [gatewayObservabilityEvents.testRunId],
		references: [gatewayPresetTestRuns.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayObservabilityEvents.workspaceId],
		references: [workspaces.id]
	}),
}));

export const presetsRelations = relations(presets, ({one, many}) => ({
	gatewayObservabilityEvents: many(gatewayObservabilityEvents),
	gatewayPresetTestRunItems: many(gatewayPresetTestRunItems),
	gatewayPresetTestRuns_baselinePresetId: many(gatewayPresetTestRuns, {
		relationName: "gatewayPresetTestRuns_baselinePresetId_presets_id"
	}),
	gatewayPresetTestRuns_presetId: many(gatewayPresetTestRuns, {
		relationName: "gatewayPresetTestRuns_presetId_presets_id"
	}),
	gatewayFeedbacks: many(gatewayFeedback),
	presetVersions: many(presetVersions, {
		relationName: "presetVersions_presetId_presets_id"
	}),
	presetVersion_activeVersionId: one(presetVersions, {
		fields: [presets.activeVersionId],
		references: [presetVersions.id],
		relationName: "presets_activeVersionId_presetVersions_id"
	}),
	user: one(users, {
		fields: [presets.createdBy],
		references: [users.userId]
	}),
	preset_rootPresetId: one(presets, {
		fields: [presets.rootPresetId],
		references: [presets.id],
		relationName: "presets_rootPresetId_presets_id"
	}),
	presets_rootPresetId: many(presets, {
		relationName: "presets_rootPresetId_presets_id"
	}),
	preset_sourcePresetId: one(presets, {
		fields: [presets.sourcePresetId],
		references: [presets.id],
		relationName: "presets_sourcePresetId_presets_id"
	}),
	presets_sourcePresetId: many(presets, {
		relationName: "presets_sourcePresetId_presets_id"
	}),
	presetVersion_sourcePresetVersionId: one(presetVersions, {
		fields: [presets.sourcePresetVersionId],
		references: [presetVersions.id],
		relationName: "presets_sourcePresetVersionId_presetVersions_id"
	}),
	presetVersion_upstreamVersionId: one(presetVersions, {
		fields: [presets.upstreamVersionId],
		references: [presetVersions.id],
		relationName: "presets_upstreamVersionId_presetVersions_id"
	}),
	workspace: one(workspaces, {
		fields: [presets.workspaceId],
		references: [workspaces.id]
	}),
	presetLineages_ancestorPresetId: many(presetLineage, {
		relationName: "presetLineage_ancestorPresetId_presets_id"
	}),
	presetLineages_descendantPresetId: many(presetLineage, {
		relationName: "presetLineage_descendantPresetId_presets_id"
	}),
}));

export const gatewayPresetTestRunsRelations = relations(gatewayPresetTestRuns, ({one, many}) => ({
	gatewayObservabilityEvents: many(gatewayObservabilityEvents),
	gatewayPresetTestRunItems: many(gatewayPresetTestRunItems),
	preset_baselinePresetId: one(presets, {
		fields: [gatewayPresetTestRuns.baselinePresetId],
		references: [presets.id],
		relationName: "gatewayPresetTestRuns_baselinePresetId_presets_id"
	}),
	preset_presetId: one(presets, {
		fields: [gatewayPresetTestRuns.presetId],
		references: [presets.id],
		relationName: "gatewayPresetTestRuns_presetId_presets_id"
	}),
	workspace: one(workspaces, {
		fields: [gatewayPresetTestRuns.workspaceId],
		references: [workspaces.id]
	}),
	gatewayFeedbacks: many(gatewayFeedback),
}));

export const gatewayPresetTestRunItemsRelations = relations(gatewayPresetTestRunItems, ({one}) => ({
	gatewayFeedback: one(gatewayFeedback, {
		fields: [gatewayPresetTestRunItems.feedbackId],
		references: [gatewayFeedback.id]
	}),
	preset: one(presets, {
		fields: [gatewayPresetTestRunItems.presetId],
		references: [presets.id]
	}),
	gatewayPresetTestRun: one(gatewayPresetTestRuns, {
		fields: [gatewayPresetTestRunItems.testRunId],
		references: [gatewayPresetTestRuns.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayPresetTestRunItems.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayFeedbackRelations = relations(gatewayFeedback, ({one, many}) => ({
	gatewayPresetTestRunItems: many(gatewayPresetTestRunItems),
	preset: one(presets, {
		fields: [gatewayFeedback.presetId],
		references: [presets.id]
	}),
	gatewayPresetTestRun: one(gatewayPresetTestRuns, {
		fields: [gatewayFeedback.testRunId],
		references: [gatewayPresetTestRuns.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayFeedback.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayProviderEventsRelations = relations(gatewayProviderEvents, ({one}) => ({
	workspace: one(workspaces, {
		fields: [gatewayProviderEvents.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayRealtimeSessionsRelations = relations(gatewayRealtimeSessions, ({one}) => ({
	key: one(keys, {
		fields: [gatewayRealtimeSessions.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayRealtimeSessions.workspaceId],
		references: [workspaces.id]
	}),
}));

export const keysRelations = relations(keys, ({one, many}) => ({
	gatewayRealtimeSessions: many(gatewayRealtimeSessions),
	user: one(users, {
		fields: [keys.createdBy],
		references: [users.userId]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [keys.oauthUserId],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [keys.workspaceId],
		references: [workspaces.id]
	}),
	v2RequestFacts: many(v2RequestFacts),
	keyGuardrails: many(keyGuardrails),
	gatewayDynamicRouteKeys: many(gatewayDynamicRouteKeys),
	broadcastDestinationKeys: many(broadcastDestinationKeys),
	gatewayBatchKeyUsageRecords: many(gatewayBatchKeyUsageRecords),
	gatewayWalletReservations: many(gatewayWalletReservations),
	gatewayUpstreamRequests202607s: many(gatewayUpstreamRequests202607),
	gatewayUpstreamRequests202608s: many(gatewayUpstreamRequests202608),
	gatewayUpstreamRequests202609s: many(gatewayUpstreamRequests202609),
	gatewayUpstreamRequestsDefaults: many(gatewayUpstreamRequestsDefault),
	gatewayRequests202603s: many(gatewayRequests202603),
	gatewayRequests202604s: many(gatewayRequests202604),
	gatewayRequests202605s: many(gatewayRequests202605),
	gatewayRequests202606s: many(gatewayRequests202606),
	gatewayRequests202607s: many(gatewayRequests202607),
	gatewayRequests202608s: many(gatewayRequests202608),
	gatewayRequests202609s: many(gatewayRequests202609),
	gatewayRequestsDefaults: many(gatewayRequestsDefault),
}));

export const v2ModelsRelations = relations(v2Models, ({one, many}) => ({
	v2Model: one(v2Models, {
		fields: [v2Models.baseModelSlug],
		references: [v2Models.modelSlug],
		relationName: "v2Models_baseModelSlug_v2Models_modelSlug"
	}),
	v2Models: many(v2Models, {
		relationName: "v2Models_baseModelSlug_v2Models_modelSlug"
	}),
	v2Lab: one(v2Labs, {
		fields: [v2Models.labSlug],
		references: [v2Labs.labSlug]
	}),
	v2BenchmarkResults: many(v2BenchmarkResults),
	v2ModelAliases: many(v2ModelAliases),
	v2ModelPageNotices: many(v2ModelPageNotices),
	v2ModelProviderRoutes: many(v2ModelProviderRoutes),
	v2PrivateUsageDailies: many(v2PrivateUsageDaily),
	v2PublicUsageDailies: many(v2PublicUsageDaily),
	v2PublicUsageHourlies: many(v2PublicUsageHourly),
	v2RequestFacts_requestedModelSlug: many(v2RequestFacts, {
		relationName: "v2RequestFacts_requestedModelSlug_v2Models_modelSlug"
	}),
	v2RequestFacts_routedModelSlug: many(v2RequestFacts, {
		relationName: "v2RequestFacts_routedModelSlug_v2Models_modelSlug"
	}),
	v2SubscriptionPlanModels: many(v2SubscriptionPlanModels),
	v2ModelDetails: many(v2ModelDetails),
	v2ModelLinks: many(v2ModelLinks),
	v2PublicProviderHealthDailies: many(v2PublicProviderHealthDaily),
}));

export const v2LabsRelations = relations(v2Labs, ({many}) => ({
	v2Models: many(v2Models),
	v2ModelFamilies: many(v2ModelFamilies),
	v2Providers: many(v2Providers),
	v2LabLinks: many(v2LabLinks),
}));

export const broadcastDestinationRulesRelations = relations(broadcastDestinationRules, ({one}) => ({
	broadcastDestinationRuleGroup: one(broadcastDestinationRuleGroups, {
		fields: [broadcastDestinationRules.ruleGroupId],
		references: [broadcastDestinationRuleGroups.id]
	}),
}));

export const broadcastDestinationRuleGroupsRelations = relations(broadcastDestinationRuleGroups, ({one, many}) => ({
	broadcastDestinationRules: many(broadcastDestinationRules),
	workspaceBroadcastDestination: one(workspaceBroadcastDestinations, {
		fields: [broadcastDestinationRuleGroups.destinationId],
		references: [workspaceBroadcastDestinations.id]
	}),
}));

export const gatewayWebhookEndpointsRelations = relations(gatewayWebhookEndpoints, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [gatewayWebhookEndpoints.createdBy],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayWebhookEndpoints.workspaceId],
		references: [workspaces.id]
	}),
}));

export const managementKeysRelations = relations(managementKeys, ({one}) => ({
	user: one(users, {
		fields: [managementKeys.createdBy],
		references: [users.userId]
	}),
	workspace: one(workspaces, {
		fields: [managementKeys.workspaceId],
		references: [workspaces.id]
	}),
}));

export const monitorHistoryEventsRelations = relations(monitorHistoryEvents, ({one}) => ({
	monitorHistoryCommit: one(monitorHistoryCommits, {
		fields: [monitorHistoryEvents.commitSha],
		references: [monitorHistoryCommits.commitSha]
	}),
}));

export const monitorHistoryCommitsRelations = relations(monitorHistoryCommits, ({many}) => ({
	monitorHistoryEvents: many(monitorHistoryEvents),
}));

export const oauthAppMetadataRelations = relations(oauthAppMetadata, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [oauthAppMetadata.createdBy],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [oauthAppMetadata.workspaceId],
		references: [workspaces.id]
	}),
}));

export const oauthAuthorizationCodesRelations = relations(oauthAuthorizationCodes, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [oauthAuthorizationCodes.userId],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [oauthAuthorizationCodes.workspaceId],
		references: [workspaces.id]
	}),
}));

export const oauthAuthorizationsRelations = relations(oauthAuthorizations, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [oauthAuthorizations.userId],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [oauthAuthorizations.workspaceId],
		references: [workspaces.id]
	}),
}));

export const oauthDeviceCodesRelations = relations(oauthDeviceCodes, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [oauthDeviceCodes.userId],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [oauthDeviceCodes.workspaceId],
		references: [workspaces.id]
	}),
}));

export const oauthRefreshTokensRelations = relations(oauthRefreshTokens, ({one, many}) => ({
	oauthRefreshToken: one(oauthRefreshTokens, {
		fields: [oauthRefreshTokens.rotatedFrom],
		references: [oauthRefreshTokens.id],
		relationName: "oauthRefreshTokens_rotatedFrom_oauthRefreshTokens_id"
	}),
	oauthRefreshTokens: many(oauthRefreshTokens, {
		relationName: "oauthRefreshTokens_rotatedFrom_oauthRefreshTokens_id"
	}),
	usersInAuth: one(usersInAuth, {
		fields: [oauthRefreshTokens.userId],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [oauthRefreshTokens.workspaceId],
		references: [workspaces.id]
	}),
}));

export const otelExportOutboxRelations = relations(otelExportOutbox, ({one}) => ({
	workspaceBroadcastDestination: one(workspaceBroadcastDestinations, {
		fields: [otelExportOutbox.destinationId],
		references: [workspaceBroadcastDestinations.id]
	}),
	workspace: one(workspaces, {
		fields: [otelExportOutbox.workspaceId],
		references: [workspaces.id]
	}),
}));

export const workspaceBroadcastDestinationsRelations = relations(workspaceBroadcastDestinations, ({one, many}) => ({
	otelExportOutboxes: many(otelExportOutbox),
	workspace: one(workspaces, {
		fields: [workspaceBroadcastDestinations.workspaceId],
		references: [workspaces.id]
	}),
	broadcastDestinationRuleGroups: many(broadcastDestinationRuleGroups),
	broadcastDestinationKeys: many(broadcastDestinationKeys),
}));

export const passkeyRelations = relations(passkey, ({one}) => ({
	user: one(user, {
		fields: [passkey.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	passkeys: many(passkey),
	sessions: many(session),
	twoFactors: many(twoFactor),
	ssoProviders: many(ssoProvider),
	accounts: many(account),
}));

export const presetVersionsRelations = relations(presetVersions, ({one, many}) => ({
	user: one(users, {
		fields: [presetVersions.createdBy],
		references: [users.userId]
	}),
	preset: one(presets, {
		fields: [presetVersions.presetId],
		references: [presets.id],
		relationName: "presetVersions_presetId_presets_id"
	}),
	presets_activeVersionId: many(presets, {
		relationName: "presets_activeVersionId_presetVersions_id"
	}),
	presets_sourcePresetVersionId: many(presets, {
		relationName: "presets_sourcePresetVersionId_presetVersions_id"
	}),
	presets_upstreamVersionId: many(presets, {
		relationName: "presets_upstreamVersionId_presetVersions_id"
	}),
}));

export const requestClassificationsRelations = relations(requestClassifications, ({one}) => ({
	workspaceClassifier: one(workspaceClassifiers, {
		fields: [requestClassifications.classifierId],
		references: [workspaceClassifiers.id]
	}),
	dataContribution: one(dataContributions, {
		fields: [requestClassifications.contributionId],
		references: [dataContributions.id]
	}),
	workspace: one(workspaces, {
		fields: [requestClassifications.workspaceId],
		references: [workspaces.id]
	}),
}));

export const workspaceClassifiersRelations = relations(workspaceClassifiers, ({one, many}) => ({
	requestClassifications: many(requestClassifications),
	usersInAuth: one(usersInAuth, {
		fields: [workspaceClassifiers.createdBy],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [workspaceClassifiers.workspaceId],
		references: [workspaces.id]
	}),
	requestClassificationDailies: many(requestClassificationDaily),
}));

export const securityKeyReportsRelations = relations(securityKeyReports, ({one}) => ({
	user: one(users, {
		fields: [securityKeyReports.actionTakenBy],
		references: [users.userId]
	}),
	workspace: one(workspaces, {
		fields: [securityKeyReports.workspaceId],
		references: [workspaces.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const twoFactorRelations = relations(twoFactor, ({one}) => ({
	user: one(user, {
		fields: [twoFactor.userId],
		references: [user.id]
	}),
}));

export const v2AnalyticsOutboxRelations = relations(v2AnalyticsOutbox, ({one}) => ({
	v2RequestFact: one(v2RequestFacts, {
		fields: [v2AnalyticsOutbox.requestEventId],
		references: [v2RequestFacts.requestEventId]
	}),
	workspace: one(workspaces, {
		fields: [v2AnalyticsOutbox.workspaceId],
		references: [workspaces.id]
	}),
}));

export const v2RequestFactsRelations = relations(v2RequestFacts, ({one, many}) => ({
	v2AnalyticsOutboxes: many(v2AnalyticsOutbox),
	v2RequestArtifacts: many(v2RequestArtifacts),
	v2RequestAttempts: many(v2RequestAttempts),
	apiApp: one(apiApps, {
		fields: [v2RequestFacts.appId],
		references: [apiApps.id]
	}),
	gatewayRequest: one(gatewayRequests, {
		fields: [v2RequestFacts.gatewayRequestId],
		references: [gatewayRequests.id]
	}),
	gatewayRequests202603: one(gatewayRequests202603, {
		fields: [v2RequestFacts.gatewayRequestId],
		references: [gatewayRequests202603.id]
	}),
	gatewayRequests202604: one(gatewayRequests202604, {
		fields: [v2RequestFacts.gatewayRequestId],
		references: [gatewayRequests202604.id]
	}),
	gatewayRequests202605: one(gatewayRequests202605, {
		fields: [v2RequestFacts.gatewayRequestId],
		references: [gatewayRequests202605.id]
	}),
	gatewayRequests202606: one(gatewayRequests202606, {
		fields: [v2RequestFacts.gatewayRequestId],
		references: [gatewayRequests202606.id]
	}),
	gatewayRequests202607: one(gatewayRequests202607, {
		fields: [v2RequestFacts.gatewayRequestId],
		references: [gatewayRequests202607.id]
	}),
	gatewayRequests202608: one(gatewayRequests202608, {
		fields: [v2RequestFacts.gatewayRequestId],
		references: [gatewayRequests202608.id]
	}),
	gatewayRequests202609: one(gatewayRequests202609, {
		fields: [v2RequestFacts.gatewayRequestId],
		references: [gatewayRequests202609.id]
	}),
	gatewayRequestsDefault: one(gatewayRequestsDefault, {
		fields: [v2RequestFacts.gatewayRequestId],
		references: [gatewayRequestsDefault.id]
	}),
	key: one(keys, {
		fields: [v2RequestFacts.keyId],
		references: [keys.id]
	}),
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2RequestFacts.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
	v2Model_requestedModelSlug: one(v2Models, {
		fields: [v2RequestFacts.requestedModelSlug],
		references: [v2Models.modelSlug],
		relationName: "v2RequestFacts_requestedModelSlug_v2Models_modelSlug"
	}),
	v2Model_routedModelSlug: one(v2Models, {
		fields: [v2RequestFacts.routedModelSlug],
		references: [v2Models.modelSlug],
		relationName: "v2RequestFacts_routedModelSlug_v2Models_modelSlug"
	}),
	workspace: one(workspaces, {
		fields: [v2RequestFacts.workspaceId],
		references: [workspaces.id]
	}),
	v2RequestFeedbacks: many(v2RequestFeedback),
	v2RequestPricingLines: many(v2RequestPricingLines),
	v2RequestRoutingDecisions: many(v2RequestRoutingDecisions),
	v2RequestUsages: many(v2RequestUsage),
}));

export const v2BenchmarkResultsRelations = relations(v2BenchmarkResults, ({one}) => ({
	v2Benchmark: one(v2Benchmarks, {
		fields: [v2BenchmarkResults.benchmarkId],
		references: [v2Benchmarks.benchmarkId]
	}),
	v2Model: one(v2Models, {
		fields: [v2BenchmarkResults.modelSlug],
		references: [v2Models.modelSlug]
	}),
}));

export const v2BenchmarksRelations = relations(v2Benchmarks, ({many}) => ({
	v2BenchmarkResults: many(v2BenchmarkResults),
}));

export const v2CapabilityConstraintsRelations = relations(v2CapabilityConstraints, ({one}) => ({
	v2ModelProviderRoute_providerModelId: one(v2ModelProviderRoutes, {
		fields: [v2CapabilityConstraints.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId],
		relationName: "v2CapabilityConstraints_providerModelId_v2ModelProviderRoutes_providerModelId"
	}),
	v2Provider: one(v2Providers, {
		fields: [v2CapabilityConstraints.providerSlug],
		references: [v2Providers.providerSlug]
	}),
	v2ModelProviderRoute_providerSlug: one(v2ModelProviderRoutes, {
		fields: [v2CapabilityConstraints.providerSlug],
		references: [v2ModelProviderRoutes.providerModelId],
		relationName: "v2CapabilityConstraints_providerSlug_v2ModelProviderRoutes_providerModelId"
	}),
}));

export const v2ModelProviderRoutesRelations = relations(v2ModelProviderRoutes, ({one, many}) => ({
	v2CapabilityConstraints_providerModelId: many(v2CapabilityConstraints, {
		relationName: "v2CapabilityConstraints_providerModelId_v2ModelProviderRoutes_providerModelId"
	}),
	v2CapabilityConstraints_providerSlug: many(v2CapabilityConstraints, {
		relationName: "v2CapabilityConstraints_providerSlug_v2ModelProviderRoutes_providerModelId"
	}),
	v2CapabilityEvidences_providerModelId: many(v2CapabilityEvidence, {
		relationName: "v2CapabilityEvidence_providerModelId_v2ModelProviderRoutes_providerModelId"
	}),
	v2CapabilityEvidences_providerSlug: many(v2CapabilityEvidence, {
		relationName: "v2CapabilityEvidence_providerSlug_v2ModelProviderRoutes_providerModelId"
	}),
	v2ExecutionPlans: many(v2ExecutionPlans),
	v2Model: one(v2Models, {
		fields: [v2ModelProviderRoutes.modelSlug],
		references: [v2Models.modelSlug]
	}),
	v2Provider: one(v2Providers, {
		fields: [v2ModelProviderRoutes.providerSlug],
		references: [v2Providers.providerSlug]
	}),
	v2PricingSkuses: many(v2PricingSkus),
	v2PrivateUsageDailies: many(v2PrivateUsageDaily),
	v2RouteVariants: many(v2RouteVariants),
	v2PublicUsageDailies: many(v2PublicUsageDaily),
	v2PublicUsageHourlies: many(v2PublicUsageHourly),
	v2RequestAttempts: many(v2RequestAttempts),
	v2RequestFacts: many(v2RequestFacts),
	v2RequestRoutingDecisions: many(v2RequestRoutingDecisions),
	v2RouteCapabilities: many(v2RouteCapabilities),
}));

export const v2ProvidersRelations = relations(v2Providers, ({one, many}) => ({
	v2CapabilityConstraints: many(v2CapabilityConstraints),
	v2CapabilityEvidences: many(v2CapabilityEvidence),
	v2ModelProviderRoutes: many(v2ModelProviderRoutes),
	v2ProviderAuthProfiles: many(v2ProviderAuthProfiles),
	v2ProviderCapabilityAdapters: many(v2ProviderCapabilityAdapters),
	v2ProviderCountryRestrictions: many(v2ProviderCountryRestrictions),
	v2ProviderEndpoints: many(v2ProviderEndpoints),
	v2ProviderRegions: many(v2ProviderRegions),
	v2Lab: one(v2Labs, {
		fields: [v2Providers.labSlug],
		references: [v2Labs.labSlug]
	}),
}));

export const v2CapabilityEvidenceRelations = relations(v2CapabilityEvidence, ({one}) => ({
	v2ModelProviderRoute_providerModelId: one(v2ModelProviderRoutes, {
		fields: [v2CapabilityEvidence.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId],
		relationName: "v2CapabilityEvidence_providerModelId_v2ModelProviderRoutes_providerModelId"
	}),
	v2Provider: one(v2Providers, {
		fields: [v2CapabilityEvidence.providerSlug],
		references: [v2Providers.providerSlug]
	}),
	v2ModelProviderRoute_providerSlug: one(v2ModelProviderRoutes, {
		fields: [v2CapabilityEvidence.providerSlug],
		references: [v2ModelProviderRoutes.providerModelId],
		relationName: "v2CapabilityEvidence_providerSlug_v2ModelProviderRoutes_providerModelId"
	}),
}));

export const v2CatalogueAdminChangesRelations = relations(v2CatalogueAdminChanges, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [v2CatalogueAdminChanges.actorUserId],
		references: [usersInAuth.id]
	}),
}));

export const v2ControlPlaneReleasesRelations = relations(v2ControlPlaneReleases, ({one, many}) => ({
	usersInAuth_createdBy: one(usersInAuth, {
		fields: [v2ControlPlaneReleases.createdBy],
		references: [usersInAuth.id],
		relationName: "v2ControlPlaneReleases_createdBy_usersInAuth_id"
	}),
	usersInAuth_publishedBy: one(usersInAuth, {
		fields: [v2ControlPlaneReleases.publishedBy],
		references: [usersInAuth.id],
		relationName: "v2ControlPlaneReleases_publishedBy_usersInAuth_id"
	}),
	usersInAuth_reviewedBy: one(usersInAuth, {
		fields: [v2ControlPlaneReleases.reviewedBy],
		references: [usersInAuth.id],
		relationName: "v2ControlPlaneReleases_reviewedBy_usersInAuth_id"
	}),
	v2ExecutionPlans: many(v2ExecutionPlans),
}));

export const v2CreditReservationsRelations = relations(v2CreditReservations, ({one}) => ({
	workspace: one(workspaces, {
		fields: [v2CreditReservations.workspaceId],
		references: [workspaces.id]
	}),
}));

export const v2ExecutionPlansRelations = relations(v2ExecutionPlans, ({one}) => ({
	v2RouteCapability: one(v2RouteCapabilities, {
		fields: [v2ExecutionPlans.providerModelId],
		references: [v2RouteCapabilities.providerModelId]
	}),
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2ExecutionPlans.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
	v2RouteVariant: one(v2RouteVariants, {
		fields: [v2ExecutionPlans.providerModelId],
		references: [v2RouteVariants.variantId]
	}),
	v2ControlPlaneRelease: one(v2ControlPlaneReleases, {
		fields: [v2ExecutionPlans.releaseId],
		references: [v2ControlPlaneReleases.releaseId]
	}),
}));

export const v2RouteCapabilitiesRelations = relations(v2RouteCapabilities, ({one, many}) => ({
	v2ExecutionPlans: many(v2ExecutionPlans),
	v2RouteParameterSupports: many(v2RouteParameterSupport),
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2RouteCapabilities.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
}));

export const v2RouteVariantsRelations = relations(v2RouteVariants, ({one, many}) => ({
	v2ExecutionPlans: many(v2ExecutionPlans),
	v2PricingSkuses: many(v2PricingSkus),
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2RouteVariants.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
	v2ProviderRegion: one(v2ProviderRegions, {
		fields: [v2RouteVariants.providerRegionId],
		references: [v2ProviderRegions.providerRegionId]
	}),
	v2ServiceTier: one(v2ServiceTiers, {
		fields: [v2RouteVariants.serviceTierSlug],
		references: [v2ServiceTiers.serviceTierSlug]
	}),
}));

export const v2ModelAliasesRelations = relations(v2ModelAliases, ({one}) => ({
	v2Model: one(v2Models, {
		fields: [v2ModelAliases.modelSlug],
		references: [v2Models.modelSlug]
	}),
}));

export const v2ModelFamiliesRelations = relations(v2ModelFamilies, ({one}) => ({
	v2Lab: one(v2Labs, {
		fields: [v2ModelFamilies.labSlug],
		references: [v2Labs.labSlug]
	}),
}));

export const v2ModelPageNoticesRelations = relations(v2ModelPageNotices, ({one}) => ({
	v2Model: one(v2Models, {
		fields: [v2ModelPageNotices.modelSlug],
		references: [v2Models.modelSlug]
	}),
}));

export const v2PricingSkuMetersRelations = relations(v2PricingSkuMeters, ({one, many}) => ({
	v2MeterDefinition: one(v2MeterDefinitions, {
		fields: [v2PricingSkuMeters.meterKey],
		references: [v2MeterDefinitions.meterKey]
	}),
	v2PricingSkus: one(v2PricingSkus, {
		fields: [v2PricingSkuMeters.skuId],
		references: [v2PricingSkus.skuId]
	}),
	v2RequestPricingLines: many(v2RequestPricingLines),
	v2RequestUsages: many(v2RequestUsage),
}));

export const v2MeterDefinitionsRelations = relations(v2MeterDefinitions, ({many}) => ({
	v2PricingSkuMeters: many(v2PricingSkuMeters),
}));

export const v2PricingSkusRelations = relations(v2PricingSkus, ({one, many}) => ({
	v2PricingSkuMeters: many(v2PricingSkuMeters),
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2PricingSkus.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
	v2RouteVariant: one(v2RouteVariants, {
		fields: [v2PricingSkus.routeVariantId],
		references: [v2RouteVariants.variantId]
	}),
	v2ServiceTier: one(v2ServiceTiers, {
		fields: [v2PricingSkus.serviceTierSlug],
		references: [v2ServiceTiers.serviceTierSlug]
	}),
	v2RequestPricingLines: many(v2RequestPricingLines),
}));

export const v2ServiceTiersRelations = relations(v2ServiceTiers, ({many}) => ({
	v2PricingSkuses: many(v2PricingSkus),
	v2ProviderEndpoints: many(v2ProviderEndpoints),
	v2RouteVariants: many(v2RouteVariants),
}));

export const v2PrivateUsageDailyRelations = relations(v2PrivateUsageDaily, ({one, many}) => ({
	apiApp: one(apiApps, {
		fields: [v2PrivateUsageDaily.appId],
		references: [apiApps.id]
	}),
	v2Model: one(v2Models, {
		fields: [v2PrivateUsageDaily.modelSlug],
		references: [v2Models.modelSlug]
	}),
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2PrivateUsageDaily.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
	workspace: one(workspaces, {
		fields: [v2PrivateUsageDaily.workspaceId],
		references: [workspaces.id]
	}),
	v2PrivateUsageDailyMeters: many(v2PrivateUsageDailyMeters),
}));

export const v2ProviderAuthProfilesRelations = relations(v2ProviderAuthProfiles, ({one, many}) => ({
	v2AdapterPrimitive: one(v2AdapterPrimitives, {
		fields: [v2ProviderAuthProfiles.authPrimitiveKey],
		references: [v2AdapterPrimitives.primitiveKey]
	}),
	v2Provider: one(v2Providers, {
		fields: [v2ProviderAuthProfiles.providerSlug],
		references: [v2Providers.providerSlug]
	}),
	v2ProviderEndpoints: many(v2ProviderEndpoints),
}));

export const v2AdapterPrimitivesRelations = relations(v2AdapterPrimitives, ({many}) => ({
	v2ProviderAuthProfiles: many(v2ProviderAuthProfiles),
}));

export const v2ProviderCapabilityAdaptersRelations = relations(v2ProviderCapabilityAdapters, ({one}) => ({
	v2CapabilityAdapter: one(v2CapabilityAdapters, {
		fields: [v2ProviderCapabilityAdapters.capabilityId],
		references: [v2CapabilityAdapters.capabilityAdapterId]
	}),
	v2ProviderEndpoint: one(v2ProviderEndpoints, {
		fields: [v2ProviderCapabilityAdapters.providerSlug],
		references: [v2ProviderEndpoints.providerEndpointId]
	}),
	v2Provider: one(v2Providers, {
		fields: [v2ProviderCapabilityAdapters.providerSlug],
		references: [v2Providers.providerSlug]
	}),
}));

export const v2CapabilityAdaptersRelations = relations(v2CapabilityAdapters, ({many}) => ({
	v2ProviderCapabilityAdapters: many(v2ProviderCapabilityAdapters),
}));

export const v2ProviderEndpointsRelations = relations(v2ProviderEndpoints, ({one, many}) => ({
	v2ProviderCapabilityAdapters: many(v2ProviderCapabilityAdapters),
	v2ProviderAuthProfile: one(v2ProviderAuthProfiles, {
		fields: [v2ProviderEndpoints.providerSlug],
		references: [v2ProviderAuthProfiles.authProfileId]
	}),
	v2Provider: one(v2Providers, {
		fields: [v2ProviderEndpoints.providerSlug],
		references: [v2Providers.providerSlug]
	}),
	v2ServiceTier: one(v2ServiceTiers, {
		fields: [v2ProviderEndpoints.serviceTierSlug],
		references: [v2ServiceTiers.serviceTierSlug]
	}),
}));

export const v2ProviderCountryRestrictionsRelations = relations(v2ProviderCountryRestrictions, ({one}) => ({
	v2Provider: one(v2Providers, {
		fields: [v2ProviderCountryRestrictions.providerSlug],
		references: [v2Providers.providerSlug]
	}),
}));

export const v2ProviderRegionsRelations = relations(v2ProviderRegions, ({one, many}) => ({
	v2Provider: one(v2Providers, {
		fields: [v2ProviderRegions.providerSlug],
		references: [v2Providers.providerSlug]
	}),
	v2RouteVariants: many(v2RouteVariants),
}));

export const walletsRelations = relations(wallets, ({one}) => ({
	workspace: one(workspaces, {
		fields: [wallets.workspaceId],
		references: [workspaces.id]
	}),
}));

export const webCacheGenerationsRelations = relations(webCacheGenerations, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [webCacheGenerations.updatedBy],
		references: [usersInAuth.id]
	}),
}));

export const webCachePurgeEventsRelations = relations(webCachePurgeEvents, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [webCachePurgeEvents.actorUserId],
		references: [usersInAuth.id]
	}),
}));

export const workspaceGuardrailsRelations = relations(workspaceGuardrails, ({one, many}) => ({
	workspace: one(workspaces, {
		fields: [workspaceGuardrails.workspaceId],
		references: [workspaces.id]
	}),
	keyGuardrails: many(keyGuardrails),
	workspaceMemberGuardrails: many(workspaceMemberGuardrails),
}));

export const workspaceInvitesRelations = relations(workspaceInvites, ({one, many}) => ({
	user: one(users, {
		fields: [workspaceInvites.creatorUserId],
		references: [users.userId]
	}),
	workspace: one(workspaces, {
		fields: [workspaceInvites.workspaceId],
		references: [workspaces.id]
	}),
	workspaceJoinRequests: many(workspaceJoinRequests),
}));

export const workspaceJoinRequestsRelations = relations(workspaceJoinRequests, ({one}) => ({
	user_decidedBy: one(users, {
		fields: [workspaceJoinRequests.decidedBy],
		references: [users.userId],
		relationName: "workspaceJoinRequests_decidedBy_users_userId"
	}),
	workspaceInvite: one(workspaceInvites, {
		fields: [workspaceJoinRequests.inviteId],
		references: [workspaceInvites.id]
	}),
	user_requesterUserId: one(users, {
		fields: [workspaceJoinRequests.requesterUserId],
		references: [users.userId],
		relationName: "workspaceJoinRequests_requesterUserId_users_userId"
	}),
	workspace: one(workspaces, {
		fields: [workspaceJoinRequests.workspaceId],
		references: [workspaces.id]
	}),
}));

export const ssoProviderRelations = relations(ssoProvider, ({one}) => ({
	user: one(user, {
		fields: [ssoProvider.userId],
		references: [user.id]
	}),
}));

export const v2CreditLedgerRelations = relations(v2CreditLedger, ({one}) => ({
	workspace: one(workspaces, {
		fields: [v2CreditLedger.workspaceId],
		references: [workspaces.id]
	}),
}));

export const v2PublicUsageDailyRelations = relations(v2PublicUsageDaily, ({one, many}) => ({
	apiApp: one(apiApps, {
		fields: [v2PublicUsageDaily.appId],
		references: [apiApps.id]
	}),
	v2Model: one(v2Models, {
		fields: [v2PublicUsageDaily.modelSlug],
		references: [v2Models.modelSlug]
	}),
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2PublicUsageDaily.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
	v2PublicUsageDailyMeters: many(v2PublicUsageDailyMeters),
}));

export const v2PublicUsageHourlyRelations = relations(v2PublicUsageHourly, ({one, many}) => ({
	apiApp: one(apiApps, {
		fields: [v2PublicUsageHourly.appId],
		references: [apiApps.id]
	}),
	v2Model: one(v2Models, {
		fields: [v2PublicUsageHourly.modelSlug],
		references: [v2Models.modelSlug]
	}),
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2PublicUsageHourly.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
	v2PublicUsageHourlyMeters: many(v2PublicUsageHourlyMeters),
}));

export const v2RequestArtifactsRelations = relations(v2RequestArtifacts, ({one}) => ({
	v2RequestAttempt: one(v2RequestAttempts, {
		fields: [v2RequestArtifacts.attemptId],
		references: [v2RequestAttempts.attemptId]
	}),
	v2RequestFact: one(v2RequestFacts, {
		fields: [v2RequestArtifacts.requestEventId],
		references: [v2RequestFacts.requestEventId]
	}),
}));

export const v2RequestAttemptsRelations = relations(v2RequestAttempts, ({one, many}) => ({
	v2RequestArtifacts: many(v2RequestArtifacts),
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2RequestAttempts.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
	v2RequestFact: one(v2RequestFacts, {
		fields: [v2RequestAttempts.requestEventId],
		references: [v2RequestFacts.requestEventId]
	}),
}));

export const gatewayRequestsRelations = relations(gatewayRequests, ({many}) => ({
	v2RequestFacts: many(v2RequestFacts),
	gatewayUpstreamRequests202607s: many(gatewayUpstreamRequests202607),
	gatewayUpstreamRequests202608s: many(gatewayUpstreamRequests202608),
	gatewayUpstreamRequests202609s: many(gatewayUpstreamRequests202609),
	gatewayUpstreamRequestsDefaults: many(gatewayUpstreamRequestsDefault),
}));

export const gatewayRequests202603Relations = relations(gatewayRequests202603, ({one, many}) => ({
	v2RequestFacts: many(v2RequestFacts),
	apiApp: one(apiApps, {
		fields: [gatewayRequests202603.appId],
		references: [apiApps.id]
	}),
	key: one(keys, {
		fields: [gatewayRequests202603.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayRequests202603.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayRequests202604Relations = relations(gatewayRequests202604, ({one, many}) => ({
	v2RequestFacts: many(v2RequestFacts),
	apiApp: one(apiApps, {
		fields: [gatewayRequests202604.appId],
		references: [apiApps.id]
	}),
	key: one(keys, {
		fields: [gatewayRequests202604.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayRequests202604.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayRequests202605Relations = relations(gatewayRequests202605, ({one, many}) => ({
	v2RequestFacts: many(v2RequestFacts),
	apiApp: one(apiApps, {
		fields: [gatewayRequests202605.appId],
		references: [apiApps.id]
	}),
	key: one(keys, {
		fields: [gatewayRequests202605.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayRequests202605.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayRequests202606Relations = relations(gatewayRequests202606, ({one, many}) => ({
	v2RequestFacts: many(v2RequestFacts),
	apiApp: one(apiApps, {
		fields: [gatewayRequests202606.appId],
		references: [apiApps.id]
	}),
	key: one(keys, {
		fields: [gatewayRequests202606.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayRequests202606.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayRequests202607Relations = relations(gatewayRequests202607, ({one, many}) => ({
	v2RequestFacts: many(v2RequestFacts),
	apiApp: one(apiApps, {
		fields: [gatewayRequests202607.appId],
		references: [apiApps.id]
	}),
	key: one(keys, {
		fields: [gatewayRequests202607.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayRequests202607.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayRequests202608Relations = relations(gatewayRequests202608, ({one, many}) => ({
	v2RequestFacts: many(v2RequestFacts),
	apiApp: one(apiApps, {
		fields: [gatewayRequests202608.appId],
		references: [apiApps.id]
	}),
	key: one(keys, {
		fields: [gatewayRequests202608.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayRequests202608.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayRequests202609Relations = relations(gatewayRequests202609, ({one, many}) => ({
	v2RequestFacts: many(v2RequestFacts),
	apiApp: one(apiApps, {
		fields: [gatewayRequests202609.appId],
		references: [apiApps.id]
	}),
	key: one(keys, {
		fields: [gatewayRequests202609.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayRequests202609.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayRequestsDefaultRelations = relations(gatewayRequestsDefault, ({one, many}) => ({
	v2RequestFacts: many(v2RequestFacts),
	apiApp: one(apiApps, {
		fields: [gatewayRequestsDefault.appId],
		references: [apiApps.id]
	}),
	key: one(keys, {
		fields: [gatewayRequestsDefault.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayRequestsDefault.workspaceId],
		references: [workspaces.id]
	}),
}));

export const v2RequestFeedbackRelations = relations(v2RequestFeedback, ({one}) => ({
	v2RequestFact: one(v2RequestFacts, {
		fields: [v2RequestFeedback.requestEventId],
		references: [v2RequestFacts.requestEventId]
	}),
	workspace: one(workspaces, {
		fields: [v2RequestFeedback.workspaceId],
		references: [workspaces.id]
	}),
}));

export const v2RequestPricingLinesRelations = relations(v2RequestPricingLines, ({one}) => ({
	v2RequestFact: one(v2RequestFacts, {
		fields: [v2RequestPricingLines.requestEventId],
		references: [v2RequestFacts.requestEventId]
	}),
	v2PricingSkus: one(v2PricingSkus, {
		fields: [v2RequestPricingLines.skuId],
		references: [v2PricingSkus.skuId]
	}),
	v2PricingSkuMeter: one(v2PricingSkuMeters, {
		fields: [v2RequestPricingLines.skuMeterId],
		references: [v2PricingSkuMeters.skuMeterId]
	}),
}));

export const v2RequestRoutingDecisionsRelations = relations(v2RequestRoutingDecisions, ({one}) => ({
	v2ModelProviderRoute: one(v2ModelProviderRoutes, {
		fields: [v2RequestRoutingDecisions.providerModelId],
		references: [v2ModelProviderRoutes.providerModelId]
	}),
	v2RequestFact: one(v2RequestFacts, {
		fields: [v2RequestRoutingDecisions.requestEventId],
		references: [v2RequestFacts.requestEventId]
	}),
}));

export const v2RequestUsageRelations = relations(v2RequestUsage, ({one}) => ({
	v2RequestFact: one(v2RequestFacts, {
		fields: [v2RequestUsage.requestEventId],
		references: [v2RequestFacts.requestEventId]
	}),
	v2PricingSkuMeter: one(v2PricingSkuMeters, {
		fields: [v2RequestUsage.skuMeterId],
		references: [v2PricingSkuMeters.skuMeterId]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const accountGuardrailSettingsRelations = relations(accountGuardrailSettings, ({one}) => ({
	user: one(users, {
		fields: [accountGuardrailSettings.userId],
		references: [users.userId]
	}),
}));

export const workspacePublisherHandleAliasesRelations = relations(workspacePublisherHandleAliases, ({one}) => ({
	workspace: one(workspaces, {
		fields: [workspacePublisherHandleAliases.workspaceId],
		references: [workspaces.id]
	}),
}));

export const workspaceSettingsRelations = relations(workspaceSettings, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [workspaceSettings.dataContributionConsentedBy],
		references: [usersInAuth.id]
	}),
	workspace: one(workspaces, {
		fields: [workspaceSettings.workspaceId],
		references: [workspaces.id]
	}),
}));

export const keyGuardrailsRelations = relations(keyGuardrails, ({one}) => ({
	workspaceGuardrail: one(workspaceGuardrails, {
		fields: [keyGuardrails.guardrailId],
		references: [workspaceGuardrails.id]
	}),
	key: one(keys, {
		fields: [keyGuardrails.keyId],
		references: [keys.id]
	}),
}));

export const presetLineageRelations = relations(presetLineage, ({one}) => ({
	preset_ancestorPresetId: one(presets, {
		fields: [presetLineage.ancestorPresetId],
		references: [presets.id],
		relationName: "presetLineage_ancestorPresetId_presets_id"
	}),
	preset_descendantPresetId: one(presets, {
		fields: [presetLineage.descendantPresetId],
		references: [presets.id],
		relationName: "presetLineage_descendantPresetId_presets_id"
	}),
}));

export const gatewayDynamicRouteKeysRelations = relations(gatewayDynamicRouteKeys, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [gatewayDynamicRouteKeys.attachedBy],
		references: [usersInAuth.id]
	}),
	key: one(keys, {
		fields: [gatewayDynamicRouteKeys.keyId],
		references: [keys.id]
	}),
	gatewayDynamicRoute: one(gatewayDynamicRoutes, {
		fields: [gatewayDynamicRouteKeys.routeId],
		references: [gatewayDynamicRoutes.id]
	}),
}));

export const broadcastDestinationKeysRelations = relations(broadcastDestinationKeys, ({one}) => ({
	workspaceBroadcastDestination: one(workspaceBroadcastDestinations, {
		fields: [broadcastDestinationKeys.destinationId],
		references: [workspaceBroadcastDestinations.id]
	}),
	key: one(keys, {
		fields: [broadcastDestinationKeys.keyId],
		references: [keys.id]
	}),
}));

export const workspaceMemberGuardrailsRelations = relations(workspaceMemberGuardrails, ({one}) => ({
	workspaceGuardrail: one(workspaceGuardrails, {
		fields: [workspaceMemberGuardrails.guardrailId],
		references: [workspaceGuardrails.id]
	}),
	user: one(users, {
		fields: [workspaceMemberGuardrails.userId],
		references: [users.userId]
	}),
	workspace: one(workspaces, {
		fields: [workspaceMemberGuardrails.workspaceId],
		references: [workspaces.id]
	}),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({one}) => ({
	user: one(users, {
		fields: [workspaceMembers.userId],
		references: [users.userId]
	}),
	workspace: one(workspaces, {
		fields: [workspaceMembers.workspaceId],
		references: [workspaces.id]
	}),
}));

export const v2SubscriptionPlanFeaturesRelations = relations(v2SubscriptionPlanFeatures, ({one}) => ({
	v2SubscriptionPlan: one(v2SubscriptionPlans, {
		fields: [v2SubscriptionPlanFeatures.planUuid],
		references: [v2SubscriptionPlans.planUuid]
	}),
}));

export const v2SubscriptionPlansRelations = relations(v2SubscriptionPlans, ({many}) => ({
	v2SubscriptionPlanFeatures: many(v2SubscriptionPlanFeatures),
	v2SubscriptionPlanModels: many(v2SubscriptionPlanModels),
}));

export const v2LabLinksRelations = relations(v2LabLinks, ({one}) => ({
	v2Lab: one(v2Labs, {
		fields: [v2LabLinks.labSlug],
		references: [v2Labs.labSlug]
	}),
}));

export const v2SubscriptionPlanModelsRelations = relations(v2SubscriptionPlanModels, ({one}) => ({
	v2Model: one(v2Models, {
		fields: [v2SubscriptionPlanModels.modelSlug],
		references: [v2Models.modelSlug]
	}),
	v2SubscriptionPlan: one(v2SubscriptionPlans, {
		fields: [v2SubscriptionPlanModels.planUuid],
		references: [v2SubscriptionPlans.planUuid]
	}),
}));

export const workspaceByokMonthlyUsageRelations = relations(workspaceByokMonthlyUsage, ({one}) => ({
	workspace: one(workspaces, {
		fields: [workspaceByokMonthlyUsage.workspaceId],
		references: [workspaces.id]
	}),
}));

export const v2CatalogueSourceOverridesRelations = relations(v2CatalogueSourceOverrides, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [v2CatalogueSourceOverrides.actorUserId],
		references: [usersInAuth.id]
	}),
}));

export const v2ModelDetailsRelations = relations(v2ModelDetails, ({one}) => ({
	v2Model: one(v2Models, {
		fields: [v2ModelDetails.modelSlug],
		references: [v2Models.modelSlug]
	}),
}));

export const gatewayBatchFileUploadsRelations = relations(gatewayBatchFileUploads, ({one}) => ({
	workspace: one(workspaces, {
		fields: [gatewayBatchFileUploads.workspaceId],
		references: [workspaces.id]
	}),
}));

export const v2ModelLinksRelations = relations(v2ModelLinks, ({one}) => ({
	v2Model: one(v2Models, {
		fields: [v2ModelLinks.modelSlug],
		references: [v2Models.modelSlug]
	}),
}));

export const v2PrivateUsageDailyMetersRelations = relations(v2PrivateUsageDailyMeters, ({one}) => ({
	v2PrivateUsageDaily: one(v2PrivateUsageDaily, {
		fields: [v2PrivateUsageDailyMeters.rollupId],
		references: [v2PrivateUsageDaily.rollupId]
	}),
}));

export const v2PublicUsageDailyMetersRelations = relations(v2PublicUsageDailyMeters, ({one}) => ({
	v2PublicUsageDaily: one(v2PublicUsageDaily, {
		fields: [v2PublicUsageDailyMeters.rollupId],
		references: [v2PublicUsageDaily.rollupId]
	}),
}));

export const v2PublicUsageHourlyMetersRelations = relations(v2PublicUsageHourlyMeters, ({one}) => ({
	v2PublicUsageHourly: one(v2PublicUsageHourly, {
		fields: [v2PublicUsageHourlyMeters.rollupId],
		references: [v2PublicUsageHourly.rollupId]
	}),
}));

export const v2RouteParameterSupportRelations = relations(v2RouteParameterSupport, ({one}) => ({
	v2CapabilityParameter: one(v2CapabilityParameters, {
		fields: [v2RouteParameterSupport.capabilityId],
		references: [v2CapabilityParameters.capabilityId]
	}),
	v2RouteCapability: one(v2RouteCapabilities, {
		fields: [v2RouteParameterSupport.providerModelId],
		references: [v2RouteCapabilities.providerModelId]
	}),
}));

export const v2CapabilityParametersRelations = relations(v2CapabilityParameters, ({many}) => ({
	v2RouteParameterSupports: many(v2RouteParameterSupport),
}));

export const gatewayRequestChargesRelations = relations(gatewayRequestCharges, ({one}) => ({
	workspace: one(workspaces, {
		fields: [gatewayRequestCharges.workspaceId],
		references: [workspaces.id]
	}),
}));

export const modelDiscoverySeenModelsRelations = relations(modelDiscoverySeenModels, ({one}) => ({
	modelDiscoveryRun: one(modelDiscoveryRuns, {
		fields: [modelDiscoverySeenModels.lastRunId],
		references: [modelDiscoveryRuns.id]
	}),
}));

export const modelDiscoveryRunsRelations = relations(modelDiscoveryRuns, ({many}) => ({
	modelDiscoverySeenModels: many(modelDiscoverySeenModels),
}));

export const catalogueGameResultsRelations = relations(catalogueGameResults, ({one}) => ({
	catalogueInteractionPuzzle: one(catalogueInteractionPuzzles, {
		fields: [catalogueGameResults.puzzleId],
		references: [catalogueInteractionPuzzles.puzzleId]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [catalogueGameResults.userId],
		references: [usersInAuth.id]
	}),
}));

export const catalogueInteractionPuzzlesRelations = relations(catalogueInteractionPuzzles, ({many}) => ({
	catalogueGameResults: many(catalogueGameResults),
}));

export const requestClassificationDailyRelations = relations(requestClassificationDaily, ({one}) => ({
	workspaceClassifier: one(workspaceClassifiers, {
		fields: [requestClassificationDaily.classifierId],
		references: [workspaceClassifiers.id]
	}),
	workspace: one(workspaces, {
		fields: [requestClassificationDaily.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayBatchKeyUsageRecordsRelations = relations(gatewayBatchKeyUsageRecords, ({one}) => ({
	key: one(keys, {
		fields: [gatewayBatchKeyUsageRecords.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayBatchKeyUsageRecords.workspaceId],
		references: [workspaces.id]
	}),
}));

export const v2PublicProviderHealthDailyRelations = relations(v2PublicProviderHealthDaily, ({one}) => ({
	v2Model: one(v2Models, {
		fields: [v2PublicProviderHealthDaily.modelSlug],
		references: [v2Models.modelSlug]
	}),
}));

export const gatewayWalletReservationsRelations = relations(gatewayWalletReservations, ({one}) => ({
	key: one(keys, {
		fields: [gatewayWalletReservations.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayWalletReservations.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayUpstreamRequests202607Relations = relations(gatewayUpstreamRequests202607, ({one}) => ({
	apiApp: one(apiApps, {
		fields: [gatewayUpstreamRequests202607.appId],
		references: [apiApps.id]
	}),
	gatewayRequest: one(gatewayRequests, {
		fields: [gatewayUpstreamRequests202607.gatewayRequestId],
		references: [gatewayRequests.id]
	}),
	key: one(keys, {
		fields: [gatewayUpstreamRequests202607.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayUpstreamRequests202607.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayUpstreamRequests202608Relations = relations(gatewayUpstreamRequests202608, ({one}) => ({
	apiApp: one(apiApps, {
		fields: [gatewayUpstreamRequests202608.appId],
		references: [apiApps.id]
	}),
	gatewayRequest: one(gatewayRequests, {
		fields: [gatewayUpstreamRequests202608.gatewayRequestId],
		references: [gatewayRequests.id]
	}),
	key: one(keys, {
		fields: [gatewayUpstreamRequests202608.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayUpstreamRequests202608.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayUpstreamRequests202609Relations = relations(gatewayUpstreamRequests202609, ({one}) => ({
	apiApp: one(apiApps, {
		fields: [gatewayUpstreamRequests202609.appId],
		references: [apiApps.id]
	}),
	gatewayRequest: one(gatewayRequests, {
		fields: [gatewayUpstreamRequests202609.gatewayRequestId],
		references: [gatewayRequests.id]
	}),
	key: one(keys, {
		fields: [gatewayUpstreamRequests202609.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayUpstreamRequests202609.workspaceId],
		references: [workspaces.id]
	}),
}));

export const gatewayUpstreamRequestsDefaultRelations = relations(gatewayUpstreamRequestsDefault, ({one}) => ({
	apiApp: one(apiApps, {
		fields: [gatewayUpstreamRequestsDefault.appId],
		references: [apiApps.id]
	}),
	gatewayRequest: one(gatewayRequests, {
		fields: [gatewayUpstreamRequestsDefault.gatewayRequestId],
		references: [gatewayRequests.id]
	}),
	key: one(keys, {
		fields: [gatewayUpstreamRequestsDefault.keyId],
		references: [keys.id]
	}),
	workspace: one(workspaces, {
		fields: [gatewayUpstreamRequestsDefault.workspaceId],
		references: [workspaces.id]
	}),
}));