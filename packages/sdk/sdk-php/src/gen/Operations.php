<?php
declare(strict_types=1);

namespace Phaseo\Gen;

function addWorkspaceMembers(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/members/add";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function applyPresetUpstreamVersion(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets/" . rawurlencode((string)($path["id"] ?? "")) . "/upstream";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function approveWorkspaceJoinRequest(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/join-requests/" . rawurlencode((string)($path["request_id"] ?? "")) . "/approve";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function calculatePricing(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/pricing/calculate";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function cancelBatch(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches/" . rawurlencode((string)($path["batch_id"] ?? "")) . "/cancel";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function cancelBatchAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch/" . rawurlencode((string)($path["id"] ?? "")) . "/cancel";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function cancelVideo(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/videos/" . rawurlencode((string)($path["video_id"] ?? "")) . "/cancel";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function cancelVideoAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/video/generations/" . rawurlencode((string)($path["video_id"] ?? "")) . "/cancel";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createAnthropicMessage(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/messages";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createApiKey(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/keys";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createBatch(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createBatchAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createChatCompletion(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/chat/completions";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createDynamicRoute(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/routing/dynamic-routes";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createEmbedding(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/embeddings";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createImage(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/images/generations";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createImageEdit(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/images/edits";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createModeration(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/moderations";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createObservabilityDestination(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/observability/destinations";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createOcr(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/ocr";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createParse(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/parse";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createPreset(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createRerank(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/rerank";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createResponse(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/responses";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createSpeech(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/audio/speech";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createTranscription(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/audio/transcriptions";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createTranslation(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/audio/translations";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createVideo(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/videos";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createVideoAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/video/generations";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createVideoDownloadUrl(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/videos/" . rawurlencode((string)($path["video_id"] ?? "")) . "/download_url";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createVideoDownloadUrlAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/video/generations/" . rawurlencode((string)($path["video_id"] ?? "")) . "/download_url";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createWorkspace(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function createWorkspaceInvite(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/invites";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function deleteApiKey(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/keys/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("DELETE", $resolvedPath, $query, $headers, $body);
}

function deleteDynamicRoute(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/routing/dynamic-routes/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("DELETE", $resolvedPath, $query, $headers, $body);
}

function deleteObservabilityDestination(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/observability/destinations/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("DELETE", $resolvedPath, $query, $headers, $body);
}

function deletePreset(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("DELETE", $resolvedPath, $query, $headers, $body);
}

function deleteVideo(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/videos/" . rawurlencode((string)($path["video_id"] ?? ""));
	return $client->request("DELETE", $resolvedPath, $query, $headers, $body);
}

function deleteVideoAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/video/generations/" . rawurlencode((string)($path["video_id"] ?? ""));
	return $client->request("DELETE", $resolvedPath, $query, $headers, $body);
}

function deleteWorkspace(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("DELETE", $resolvedPath, $query, $headers, $body);
}

function deleteWorkspaceInvite(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/invites/" . rawurlencode((string)($path["invite_id"] ?? ""));
	return $client->request("DELETE", $resolvedPath, $query, $headers, $body);
}

function deployDynamicRouteVersion(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/routing/dynamic-routes/" . rawurlencode((string)($path["id"] ?? "")) . "/versions/" . rawurlencode((string)($path["version"] ?? "")) . "/deploy";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function forkPreset(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets/" . rawurlencode((string)($path["id"] ?? "")) . "/fork";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function generateMusic(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/music/generate";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function generateMusicAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/music/generations";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function getActivity(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/activity";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getActivityAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/analytics";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getApiKey(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/keys/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getCredits(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/credits";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getCurrentApiKey(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/key";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getDynamicRoute(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/routing/dynamic-routes/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getGeneration(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/generations";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getHealth(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/health";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getMusicGeneration(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/music/generate/" . rawurlencode((string)($path["music_id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getMusicGenerationAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/music/generations/" . rawurlencode((string)($path["music_id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getObservabilityDestination(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/observability/destinations/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getObservabilityLoggingPolicy(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/observability/logging-policy";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getPreset(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getPresetPublisher(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets/publisher";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getProviderDerankStatus(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/health/providers/" . rawurlencode((string)($path["provider_id"] ?? "")) . "/derank";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getVideo(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/videos/" . rawurlencode((string)($path["video_id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getVideoAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/video/generations/" . rawurlencode((string)($path["video_id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getVideoContent(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/videos/" . rawurlencode((string)($path["video_id"] ?? "")) . "/content";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getVideoContentAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/video/generations/" . rawurlencode((string)($path["video_id"] ?? "")) . "/content";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getWorkspace(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function getWorkspaceSettings(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/settings";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listApiKeys(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/keys";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatchCapabilities(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches/capabilities";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatchCapabilitiesAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch/capabilities";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatches(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatchesAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatchFiles(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches/files";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatchFilesAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch/files";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatchModels(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches/models";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatchModelsAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch/models";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatchRequests(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches/" . rawurlencode((string)($path["batch_id"] ?? "")) . "/requests";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listBatchRequestsAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch/" . rawurlencode((string)($path["id"] ?? "")) . "/requests";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listDataModels(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/data/models";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listDynamicRoutes(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/routing/dynamic-routes";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listEndpoints(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/endpoints";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listFiles(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/files";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listModelEndpoints(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/models/" . rawurlencode((string)($path["author"] ?? "")) . "/" . rawurlencode((string)($path["slug"] ?? "")) . "/endpoints";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listModels(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/models";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listObservabilityDestinations(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/observability/destinations";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listOrganisations(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/organisations";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listPresets(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listPresetVersions(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets/" . rawurlencode((string)($path["id"] ?? "")) . "/versions";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listPricingModels(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/pricing/models";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listProviders(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/providers";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listTeamModels(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/models/me";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listVideoModels(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/videos/models";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listVideoModelsAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/video/generations/models";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listVideos(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/videos";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listVideosAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/video/generations";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listWorkspaceAuditEvents(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/audit-events";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listWorkspaceInvites(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/invites";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listWorkspaceJoinRequests(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/join-requests";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listWorkspaceMembers(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/members";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function listWorkspaces(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function openAsyncJobWebSocket(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/async/" . rawurlencode((string)($path["kind"] ?? "")) . "/" . rawurlencode((string)($path["id"] ?? "")) . "/ws";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function publishPresetVersion(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets/" . rawurlencode((string)($path["id"] ?? "")) . "/versions";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function rejectWorkspaceJoinRequest(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/join-requests/" . rawurlencode((string)($path["request_id"] ?? "")) . "/reject";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function removeWorkspaceMembers(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/members/remove";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function replaceDynamicRouteKeys(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/routing/dynamic-routes/" . rawurlencode((string)($path["id"] ?? "")) . "/keys";
	return $client->request("PUT", $resolvedPath, $query, $headers, $body);
}

function retrieveBatch(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches/" . rawurlencode((string)($path["batch_id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function retrieveBatchAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function retrieveBatchFile(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches/files/" . rawurlencode((string)($path["file_id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function retrieveBatchFileAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch/files/" . rawurlencode((string)($path["file_id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function retrieveBatchFileContent(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches/files/" . rawurlencode((string)($path["file_id"] ?? "")) . "/content";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function retrieveBatchFileContentAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch/files/" . rawurlencode((string)($path["file_id"] ?? "")) . "/content";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function retrieveFile(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/files/" . rawurlencode((string)($path["file_id"] ?? ""));
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function retrieveFileContent(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/files/" . rawurlencode((string)($path["file_id"] ?? "")) . "/content";
	return $client->request("GET", $resolvedPath, $query, $headers, $body);
}

function updateApiKey(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/keys/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("PATCH", $resolvedPath, $query, $headers, $body);
}

function updateDynamicRoute(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/routing/dynamic-routes/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("PATCH", $resolvedPath, $query, $headers, $body);
}

function updateObservabilityDestination(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/observability/destinations/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("PATCH", $resolvedPath, $query, $headers, $body);
}

function updateObservabilityLoggingPolicy(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/observability/logging-policy";
	return $client->request("PATCH", $resolvedPath, $query, $headers, $body);
}

function updatePreset(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("PATCH", $resolvedPath, $query, $headers, $body);
}

function updatePresetPublisher(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/presets/publisher";
	return $client->request("PUT", $resolvedPath, $query, $headers, $body);
}

function updateWorkspace(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? ""));
	return $client->request("PATCH", $resolvedPath, $query, $headers, $body);
}

function updateWorkspaceMemberRole(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/workspaces/" . rawurlencode((string)($path["id"] ?? "")) . "/members/" . rawurlencode((string)($path["user_id"] ?? ""));
	return $client->request("PATCH", $resolvedPath, $query, $headers, $body);
}

function updateWorkspaceSettings(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/settings";
	return $client->request("PATCH", $resolvedPath, $query, $headers, $body);
}

function uploadBatchFile(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batches/files";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function uploadBatchFileAlias(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/batch/files";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}

function uploadFile(Client $client, ?array $path = null, ?array $query = null, ?array $headers = null, $body = null)
{
	$path = $path ?? [];
	$resolvedPath = "/files";
	return $client->request("POST", $resolvedPath, $query, $headers, $body);
}
