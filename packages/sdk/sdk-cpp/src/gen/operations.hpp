#pragma once
#include <map>
#include <string>
#include "client.hpp"

namespace phaseo::gen {
inline Response AddGuardrailKeys(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{}) + "/keys/add";
	return client.request("POST", resolved_path, body);
}

inline Response AddGuardrailMembers(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{}) + "/members/add";
	return client.request("POST", resolved_path, body);
}

inline Response AddWorkspaceMembers(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/members/add";
	return client.request("POST", resolved_path, body);
}

inline Response ApplyPresetUpstreamVersion(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets/" + (path.count("id") ? path.at("id") : std::string{}) + "/upstream";
	return client.request("POST", resolved_path, body);
}

inline Response ApproveWorkspaceJoinRequest(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/join-requests/" + (path.count("request_id") ? path.at("request_id") : std::string{}) + "/approve";
	return client.request("POST", resolved_path, body);
}

inline Response CalculatePricing(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/pricing/calculate";
	return client.request("POST", resolved_path, body);
}

inline Response CancelBatch(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches/" + (path.count("batch_id") ? path.at("batch_id") : std::string{}) + "/cancel";
	return client.request("POST", resolved_path, body);
}

inline Response CancelBatchAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch/" + (path.count("id") ? path.at("id") : std::string{}) + "/cancel";
	return client.request("POST", resolved_path, body);
}

inline Response CancelVideo(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/videos/" + (path.count("video_id") ? path.at("video_id") : std::string{}) + "/cancel";
	return client.request("POST", resolved_path, body);
}

inline Response CancelVideoAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/video/generations/" + (path.count("video_id") ? path.at("video_id") : std::string{}) + "/cancel";
	return client.request("POST", resolved_path, body);
}

inline Response CreateAnthropicMessage(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/messages";
	return client.request("POST", resolved_path, body);
}

inline Response CreateApiKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/keys";
	return client.request("POST", resolved_path, body);
}

inline Response CreateBatch(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches";
	return client.request("POST", resolved_path, body);
}

inline Response CreateBatchAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch";
	return client.request("POST", resolved_path, body);
}

inline Response CreateChatCompletion(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/chat/completions";
	return client.request("POST", resolved_path, body);
}

inline Response CreateDataContributionClassifier(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/data-contribution/classifiers";
	return client.request("POST", resolved_path, body);
}

inline Response CreateDynamicRoute(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/routing/dynamic-routes";
	return client.request("POST", resolved_path, body);
}

inline Response CreateEmbedding(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/embeddings";
	return client.request("POST", resolved_path, body);
}

inline Response CreateGuardrail(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails";
	return client.request("POST", resolved_path, body);
}

inline Response CreateImage(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/images/generations";
	return client.request("POST", resolved_path, body);
}

inline Response CreateImageEdit(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/images/edits";
	return client.request("POST", resolved_path, body);
}

inline Response CreateManagementKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/management-keys";
	return client.request("POST", resolved_path, body);
}

inline Response CreateModeration(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/moderations";
	return client.request("POST", resolved_path, body);
}

inline Response CreateOAuthClient(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/oauth-clients";
	return client.request("POST", resolved_path, body);
}

inline Response CreateObservabilityDestination(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/observability/destinations";
	return client.request("POST", resolved_path, body);
}

inline Response CreateOcr(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/ocr";
	return client.request("POST", resolved_path, body);
}

inline Response CreateParse(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/parse";
	return client.request("POST", resolved_path, body);
}

inline Response CreatePreset(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets";
	return client.request("POST", resolved_path, body);
}

inline Response CreateRerank(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/rerank";
	return client.request("POST", resolved_path, body);
}

inline Response CreateResponse(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/responses";
	return client.request("POST", resolved_path, body);
}

inline Response CreateSpeech(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/audio/speech";
	return client.request("POST", resolved_path, body);
}

inline Response CreateTranscription(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/audio/transcriptions";
	return client.request("POST", resolved_path, body);
}

inline Response CreateTranslation(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/audio/translations";
	return client.request("POST", resolved_path, body);
}

inline Response CreateVideo(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/videos";
	return client.request("POST", resolved_path, body);
}

inline Response CreateVideoAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/video/generations";
	return client.request("POST", resolved_path, body);
}

inline Response CreateVideoDownloadUrl(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/videos/" + (path.count("video_id") ? path.at("video_id") : std::string{}) + "/download_url";
	return client.request("POST", resolved_path, body);
}

inline Response CreateVideoDownloadUrlAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/video/generations/" + (path.count("video_id") ? path.at("video_id") : std::string{}) + "/download_url";
	return client.request("POST", resolved_path, body);
}

inline Response CreateWebhookEndpoint(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/webhook-endpoints";
	return client.request("POST", resolved_path, body);
}

inline Response CreateWorkspace(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces";
	return client.request("POST", resolved_path, body);
}

inline Response CreateWorkspaceInvite(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/invites";
	return client.request("POST", resolved_path, body);
}

inline Response DeleteApiKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/keys/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteDataContributionClassifier(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/data-contribution/classifiers/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteDynamicRoute(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/routing/dynamic-routes/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteGuardrail(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteManagementKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/management-keys/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteOAuthClient(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/oauth-clients/" + (path.count("client_id") ? path.at("client_id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteObservabilityDestination(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/observability/destinations/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeletePreset(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteVideo(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/videos/" + (path.count("video_id") ? path.at("video_id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteVideoAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/video/generations/" + (path.count("video_id") ? path.at("video_id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteWebhookEndpoint(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/webhook-endpoints/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteWorkspace(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeleteWorkspaceInvite(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/invites/" + (path.count("invite_id") ? path.at("invite_id") : std::string{});
	return client.request("DELETE", resolved_path, body);
}

inline Response DeployDynamicRouteVersion(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/routing/dynamic-routes/" + (path.count("id") ? path.at("id") : std::string{}) + "/versions/" + (path.count("version") ? path.at("version") : std::string{}) + "/deploy";
	return client.request("POST", resolved_path, body);
}

inline Response ExportAnalyticsCsv(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/analytics/export";
	return client.request("GET", resolved_path, body);
}

inline Response ForkPreset(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets/" + (path.count("id") ? path.at("id") : std::string{}) + "/fork";
	return client.request("POST", resolved_path, body);
}

inline Response GenerateMusic(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/music/generate";
	return client.request("POST", resolved_path, body);
}

inline Response GenerateMusicAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/music/generations";
	return client.request("POST", resolved_path, body);
}

inline Response GetActivity(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/activity";
	return client.request("GET", resolved_path, body);
}

inline Response GetActivityAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/analytics";
	return client.request("GET", resolved_path, body);
}

inline Response GetApiKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/keys/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetCredits(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/credits";
	return client.request("GET", resolved_path, body);
}

inline Response GetCurrentApiKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/key";
	return client.request("GET", resolved_path, body);
}

inline Response GetDataContributionSettings(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/data-contribution";
	return client.request("GET", resolved_path, body);
}

inline Response GetDynamicRoute(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/routing/dynamic-routes/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetGeneration(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/generations";
	return client.request("GET", resolved_path, body);
}

inline Response GetGuardrail(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetHealth(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/health";
	return client.request("GET", resolved_path, body);
}

inline Response GetManagementKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/management-keys/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetMusicGeneration(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/music/generate/" + (path.count("music_id") ? path.at("music_id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetMusicGenerationAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/music/generations/" + (path.count("music_id") ? path.at("music_id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetOAuthClient(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/oauth-clients/" + (path.count("client_id") ? path.at("client_id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetObservabilityDestination(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/observability/destinations/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetObservabilityLoggingPolicy(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/observability/logging-policy";
	return client.request("GET", resolved_path, body);
}

inline Response GetPreset(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetPresetPublisher(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets/publisher";
	return client.request("GET", resolved_path, body);
}

inline Response GetProviderDerankStatus(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/health/providers/" + (path.count("provider_id") ? path.at("provider_id") : std::string{}) + "/derank";
	return client.request("GET", resolved_path, body);
}

inline Response GetVideo(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/videos/" + (path.count("video_id") ? path.at("video_id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetVideoAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/video/generations/" + (path.count("video_id") ? path.at("video_id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetVideoContent(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/videos/" + (path.count("video_id") ? path.at("video_id") : std::string{}) + "/content";
	return client.request("GET", resolved_path, body);
}

inline Response GetVideoContentAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/video/generations/" + (path.count("video_id") ? path.at("video_id") : std::string{}) + "/content";
	return client.request("GET", resolved_path, body);
}

inline Response GetWebhookEndpoint(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/webhook-endpoints/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetWorkspace(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response GetWorkspaceSettings(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/settings";
	return client.request("GET", resolved_path, body);
}

inline Response InvalidateApiKeyCache(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/keys/" + (path.count("id") ? path.at("id") : std::string{}) + "/invalidate";
	return client.request("POST", resolved_path, body);
}

inline Response ListApiKeys(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/keys";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatchCapabilities(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches/capabilities";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatchCapabilitiesAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch/capabilities";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatches(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatchesAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatchFiles(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches/files";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatchFilesAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch/files";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatchModels(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches/models";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatchModelsAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch/models";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatchRequests(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches/" + (path.count("batch_id") ? path.at("batch_id") : std::string{}) + "/requests";
	return client.request("GET", resolved_path, body);
}

inline Response ListBatchRequestsAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch/" + (path.count("id") ? path.at("id") : std::string{}) + "/requests";
	return client.request("GET", resolved_path, body);
}

inline Response ListDataModels(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/data/models";
	return client.request("GET", resolved_path, body);
}

inline Response ListDynamicRoutes(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/routing/dynamic-routes";
	return client.request("GET", resolved_path, body);
}

inline Response ListEndpoints(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/endpoints";
	return client.request("GET", resolved_path, body);
}

inline Response ListFiles(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/files";
	return client.request("GET", resolved_path, body);
}

inline Response ListGuardrailKeys(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{}) + "/keys";
	return client.request("GET", resolved_path, body);
}

inline Response ListGuardrailMembers(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{}) + "/members";
	return client.request("GET", resolved_path, body);
}

inline Response ListGuardrails(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails";
	return client.request("GET", resolved_path, body);
}

inline Response ListManagementKeys(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/management-keys";
	return client.request("GET", resolved_path, body);
}

inline Response ListModelEndpoints(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/models/" + (path.count("author") ? path.at("author") : std::string{}) + "/" + (path.count("slug") ? path.at("slug") : std::string{}) + "/endpoints";
	return client.request("GET", resolved_path, body);
}

inline Response ListModels(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/models";
	return client.request("GET", resolved_path, body);
}

inline Response ListOAuthClients(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/oauth-clients";
	return client.request("GET", resolved_path, body);
}

inline Response ListObservabilityDestinations(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/observability/destinations";
	return client.request("GET", resolved_path, body);
}

inline Response ListOrganisations(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/organisations";
	return client.request("GET", resolved_path, body);
}

inline Response ListPresets(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets";
	return client.request("GET", resolved_path, body);
}

inline Response ListPresetVersions(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets/" + (path.count("id") ? path.at("id") : std::string{}) + "/versions";
	return client.request("GET", resolved_path, body);
}

inline Response ListPricingModels(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/pricing/models";
	return client.request("GET", resolved_path, body);
}

inline Response ListProviders(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/providers";
	return client.request("GET", resolved_path, body);
}

inline Response ListTeamModels(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/models/me";
	return client.request("GET", resolved_path, body);
}

inline Response ListVideoModels(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/videos/models";
	return client.request("GET", resolved_path, body);
}

inline Response ListVideoModelsAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/video/generations/models";
	return client.request("GET", resolved_path, body);
}

inline Response ListVideos(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/videos";
	return client.request("GET", resolved_path, body);
}

inline Response ListVideosAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/video/generations";
	return client.request("GET", resolved_path, body);
}

inline Response ListWebhookEndpoints(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/webhook-endpoints";
	return client.request("GET", resolved_path, body);
}

inline Response ListWorkspaceAuditEvents(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/audit-events";
	return client.request("GET", resolved_path, body);
}

inline Response ListWorkspaceInvites(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/invites";
	return client.request("GET", resolved_path, body);
}

inline Response ListWorkspaceJoinRequests(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/join-requests";
	return client.request("GET", resolved_path, body);
}

inline Response ListWorkspaceMembers(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/members";
	return client.request("GET", resolved_path, body);
}

inline Response ListWorkspaces(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces";
	return client.request("GET", resolved_path, body);
}

inline Response OpenAsyncJobWebSocket(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/async/" + (path.count("kind") ? path.at("kind") : std::string{}) + "/" + (path.count("id") ? path.at("id") : std::string{}) + "/ws";
	return client.request("GET", resolved_path, body);
}

inline Response PublishPresetVersion(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets/" + (path.count("id") ? path.at("id") : std::string{}) + "/versions";
	return client.request("POST", resolved_path, body);
}

inline Response RegenerateOAuthClientSecret(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/oauth-clients/" + (path.count("client_id") ? path.at("client_id") : std::string{}) + "/regenerate-secret";
	return client.request("POST", resolved_path, body);
}

inline Response RejectWorkspaceJoinRequest(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/join-requests/" + (path.count("request_id") ? path.at("request_id") : std::string{}) + "/reject";
	return client.request("POST", resolved_path, body);
}

inline Response RemoveGuardrailKeys(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{}) + "/keys/remove";
	return client.request("POST", resolved_path, body);
}

inline Response RemoveGuardrailMembers(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{}) + "/members/remove";
	return client.request("POST", resolved_path, body);
}

inline Response RemoveWorkspaceMembers(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/members/remove";
	return client.request("POST", resolved_path, body);
}

inline Response ReplaceDynamicRouteKeys(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/routing/dynamic-routes/" + (path.count("id") ? path.at("id") : std::string{}) + "/keys";
	return client.request("PUT", resolved_path, body);
}

inline Response ReplaceGuardrailKeys(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{}) + "/keys";
	return client.request("PUT", resolved_path, body);
}

inline Response RetrieveBatch(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches/" + (path.count("batch_id") ? path.at("batch_id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response RetrieveBatchAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response RetrieveBatchFile(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches/files/" + (path.count("file_id") ? path.at("file_id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response RetrieveBatchFileAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch/files/" + (path.count("file_id") ? path.at("file_id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response RetrieveBatchFileContent(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches/files/" + (path.count("file_id") ? path.at("file_id") : std::string{}) + "/content";
	return client.request("GET", resolved_path, body);
}

inline Response RetrieveBatchFileContentAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch/files/" + (path.count("file_id") ? path.at("file_id") : std::string{}) + "/content";
	return client.request("GET", resolved_path, body);
}

inline Response RetrieveFile(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/files/" + (path.count("file_id") ? path.at("file_id") : std::string{});
	return client.request("GET", resolved_path, body);
}

inline Response RetrieveFileContent(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/files/" + (path.count("file_id") ? path.at("file_id") : std::string{}) + "/content";
	return client.request("GET", resolved_path, body);
}

inline Response RotateApiKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/keys/" + (path.count("id") ? path.at("id") : std::string{}) + "/rotate";
	return client.request("POST", resolved_path, body);
}

inline Response RotateWebhookEndpointSecret(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/webhook-endpoints/" + (path.count("id") ? path.at("id") : std::string{}) + "/rotate-secret";
	return client.request("POST", resolved_path, body);
}

inline Response UpdateApiKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/keys/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateDataContributionClassifier(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/data-contribution/classifiers/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateDataContributionConsent(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/data-contribution/consent";
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateDynamicRoute(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/routing/dynamic-routes/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateGuardrail(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/guardrails/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateManagementKey(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/management-keys/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateOAuthClient(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/oauth-clients/" + (path.count("client_id") ? path.at("client_id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateObservabilityDestination(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/observability/destinations/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateObservabilityLoggingPolicy(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/observability/logging-policy";
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdatePreset(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdatePresetPublisher(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/presets/publisher";
	return client.request("PUT", resolved_path, body);
}

inline Response UpdateWebhookEndpoint(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/webhook-endpoints/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateWorkspace(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateWorkspaceMemberRole(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/workspaces/" + (path.count("id") ? path.at("id") : std::string{}) + "/members/" + (path.count("user_id") ? path.at("user_id") : std::string{});
	return client.request("PATCH", resolved_path, body);
}

inline Response UpdateWorkspaceSettings(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/settings";
	return client.request("PATCH", resolved_path, body);
}

inline Response UploadBatchFile(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batches/files";
	return client.request("POST", resolved_path, body);
}

inline Response UploadBatchFileAlias(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/batch/files";
	return client.request("POST", resolved_path, body);
}

inline Response UploadFile(Client& client, const std::map<std::string, std::string>& path = {}, const std::string& body = "") {
	const std::string resolved_path = "/files";
	return client.request("POST", resolved_path, body);
}

} // namespace phaseo::gen
