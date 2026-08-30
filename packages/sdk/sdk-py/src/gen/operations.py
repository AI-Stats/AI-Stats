from __future__ import annotations

from typing import Any, Dict, Optional
from .client import Client
from . import models

def addWorkspaceMembers(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceMemberAddResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/members/add"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def applyPresetUpstreamVersion(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetUpstreamApplyResponse:
	path = path or {}
	resolved_path = f"/presets/{path.get('id', '')}/upstream"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def approveWorkspaceJoinRequest(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceJoinRequestResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/join-requests/{path.get('request_id', '')}/approve"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def calculatePricing(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = "/pricing/calculate"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def cancelBatch(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchResponse:
	path = path or {}
	resolved_path = f"/batches/{path.get('batch_id', '')}/cancel"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def cancelBatchAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchResponse:
	path = path or {}
	resolved_path = f"/batch/{path.get('id', '')}/cancel"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def cancelVideo(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = f"/videos/{path.get('video_id', '')}/cancel"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def cancelVideoAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = f"/video/generations/{path.get('video_id', '')}/cancel"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createAnthropicMessage(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> AnthropicMessagesResponse:
	path = path or {}
	resolved_path = "/messages"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createApiKey(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ApiKeyWithValueResponse:
	path = path or {}
	resolved_path = "/keys"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createBatch(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchResponse:
	path = path or {}
	resolved_path = "/batches"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createBatchAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchResponse:
	path = path or {}
	resolved_path = "/batch"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createChatCompletion(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ChatCompletionsResponse:
	path = path or {}
	resolved_path = "/chat/completions"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createDynamicRoute(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DynamicRouteResponse:
	path = path or {}
	resolved_path = "/routing/dynamic-routes"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createEmbedding(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> EmbeddingsResponse:
	path = path or {}
	resolved_path = "/embeddings"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createImage(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = "/images/generations"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createImageEdit(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ImagesEditResponse:
	path = path or {}
	resolved_path = "/images/edits"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createModeration(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ModerationsResponse:
	path = path or {}
	resolved_path = "/moderations"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createObservabilityDestination(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ObservabilityDestinationResponse:
	path = path or {}
	resolved_path = "/observability/destinations"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createOcr(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> OcrResponse:
	path = path or {}
	resolved_path = "/ocr"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createParse(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ParseResponse:
	path = path or {}
	resolved_path = "/parse"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createPreset(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetCreateResponse:
	path = path or {}
	resolved_path = "/presets"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createRerank(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> RerankResponse:
	path = path or {}
	resolved_path = "/rerank"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createResponse(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ResponsesResponse:
	path = path or {}
	resolved_path = "/responses"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createSpeech(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = "/audio/speech"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createTranscription(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> AudioTranscriptionResponse:
	path = path or {}
	resolved_path = "/audio/transcriptions"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createTranslation(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> AudioTranslationResponse:
	path = path or {}
	resolved_path = "/audio/translations"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createVideo(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoGenerationResponse:
	path = path or {}
	resolved_path = "/videos"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createVideoAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoGenerationResponse:
	path = path or {}
	resolved_path = "/video/generations"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createVideoDownloadUrl(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = f"/videos/{path.get('video_id', '')}/download_url"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createVideoDownloadUrlAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = f"/video/generations/{path.get('video_id', '')}/download_url"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createWorkspace(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceResponse:
	path = path or {}
	resolved_path = "/workspaces"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def createWorkspaceInvite(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceInviteCreateResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/invites"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def deleteApiKey(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DeletedResponse:
	path = path or {}
	resolved_path = f"/keys/{path.get('id', '')}"
	return client.request("DELETE", resolved_path, query=query, headers=headers, body=body)


def deleteDynamicRoute(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DynamicRouteDeleteResponse:
	path = path or {}
	resolved_path = f"/routing/dynamic-routes/{path.get('id', '')}"
	return client.request("DELETE", resolved_path, query=query, headers=headers, body=body)


def deleteObservabilityDestination(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DeletedResponse:
	path = path or {}
	resolved_path = f"/observability/destinations/{path.get('id', '')}"
	return client.request("DELETE", resolved_path, query=query, headers=headers, body=body)


def deletePreset(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DeletedResponse:
	path = path or {}
	resolved_path = f"/presets/{path.get('id', '')}"
	return client.request("DELETE", resolved_path, query=query, headers=headers, body=body)


def deleteVideo(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoDeleteResponse:
	path = path or {}
	resolved_path = f"/videos/{path.get('video_id', '')}"
	return client.request("DELETE", resolved_path, query=query, headers=headers, body=body)


def deleteVideoAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoDeleteResponse:
	path = path or {}
	resolved_path = f"/video/generations/{path.get('video_id', '')}"
	return client.request("DELETE", resolved_path, query=query, headers=headers, body=body)


def deleteWorkspace(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DeletedResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}"
	return client.request("DELETE", resolved_path, query=query, headers=headers, body=body)


def deleteWorkspaceInvite(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DeletedResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/invites/{path.get('invite_id', '')}"
	return client.request("DELETE", resolved_path, query=query, headers=headers, body=body)


def deployDynamicRouteVersion(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DynamicRouteDeployResponse:
	path = path or {}
	resolved_path = f"/routing/dynamic-routes/{path.get('id', '')}/versions/{path.get('version', '')}/deploy"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def exportAnalyticsCsv(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> str:
	path = path or {}
	resolved_path = "/analytics/export"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def forkPreset(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetResponse:
	path = path or {}
	resolved_path = f"/presets/{path.get('id', '')}/fork"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def generateMusic(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> MusicGenerateResponse:
	path = path or {}
	resolved_path = "/music/generate"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def generateMusicAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> MusicGenerateResponse:
	path = path or {}
	resolved_path = "/music/generations"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def getActivity(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceActivityResponse:
	path = path or {}
	resolved_path = "/activity"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getActivityAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> AnalyticsResponse:
	path = path or {}
	resolved_path = "/analytics"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getApiKey(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ApiKeyResponse:
	path = path or {}
	resolved_path = f"/keys/{path.get('id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getCredits(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> CreditsResponse:
	path = path or {}
	resolved_path = "/credits"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getCurrentApiKey(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ApiKeyResponse:
	path = path or {}
	resolved_path = "/key"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getDynamicRoute(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DynamicRouteResponse:
	path = path or {}
	resolved_path = f"/routing/dynamic-routes/{path.get('id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getGeneration(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> GenerationResponse:
	path = path or {}
	resolved_path = "/generations"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getHealth(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = "/health"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getMusicGeneration(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> MusicGenerateResponse:
	path = path or {}
	resolved_path = f"/music/generate/{path.get('music_id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getMusicGenerationAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> MusicGenerateResponse:
	path = path or {}
	resolved_path = f"/music/generations/{path.get('music_id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getObservabilityDestination(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ObservabilityDestinationResponse:
	path = path or {}
	resolved_path = f"/observability/destinations/{path.get('id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getObservabilityLoggingPolicy(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ObservabilityLoggingPolicyResponse:
	path = path or {}
	resolved_path = "/observability/logging-policy"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getPreset(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetResponse:
	path = path or {}
	resolved_path = f"/presets/{path.get('id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getPresetPublisher(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetPublisherResponse:
	path = path or {}
	resolved_path = "/presets/publisher"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getProviderDerankStatus(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = f"/health/providers/{path.get('provider_id', '')}/derank"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getVideo(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoGenerationResponse:
	path = path or {}
	resolved_path = f"/videos/{path.get('video_id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getVideoAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoGenerationResponse:
	path = path or {}
	resolved_path = f"/video/generations/{path.get('video_id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getVideoContent(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = f"/videos/{path.get('video_id', '')}/content"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getVideoContentAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = f"/video/generations/{path.get('video_id', '')}/content"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getWorkspace(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def getWorkspaceSettings(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceSettingsResponse:
	path = path or {}
	resolved_path = "/settings"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listApiKeys(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ApiKeyListResponse:
	path = path or {}
	resolved_path = "/keys"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatchCapabilities(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = "/batches/capabilities"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatchCapabilitiesAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = "/batch/capabilities"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatches(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchListResponse:
	path = path or {}
	resolved_path = "/batches"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatchesAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchListResponse:
	path = path or {}
	resolved_path = "/batch"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatchFiles(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = "/batches/files"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatchFilesAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = "/batch/files"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatchModels(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchModelsResponse:
	path = path or {}
	resolved_path = "/batches/models"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatchModelsAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchModelsResponse:
	path = path or {}
	resolved_path = "/batch/models"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatchRequests(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = f"/batches/{path.get('batch_id', '')}/requests"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listBatchRequestsAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = f"/batch/{path.get('id', '')}/requests"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listDataModels(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = "/data/models"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listDynamicRoutes(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DynamicRouteListResponse:
	path = path or {}
	resolved_path = "/routing/dynamic-routes"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listEndpoints(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> EndpointCatalogueResponse:
	path = path or {}
	resolved_path = "/endpoints"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listFiles(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = "/files"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listModelEndpoints(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ModelEndpointsResponse:
	path = path or {}
	resolved_path = f"/models/{path.get('author', '')}/{path.get('slug', '')}/endpoints"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listModels(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> GatewayModelsResponse:
	path = path or {}
	resolved_path = "/models"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listObservabilityDestinations(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ObservabilityDestinationListResponse:
	path = path or {}
	resolved_path = "/observability/destinations"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listOrganisations(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = "/organisations"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listPresets(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetListResponse:
	path = path or {}
	resolved_path = "/presets"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listPresetVersions(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetVersionListResponse:
	path = path or {}
	resolved_path = f"/presets/{path.get('id', '')}/versions"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listPricingModels(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = "/pricing/models"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listProviders(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Dict[str, Any]:
	path = path or {}
	resolved_path = "/providers"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listTeamModels(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> GatewayModelsResponse:
	path = path or {}
	resolved_path = "/models/me"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listVideoModels(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoModelsResponse:
	path = path or {}
	resolved_path = "/videos/models"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listVideoModelsAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoModelsResponse:
	path = path or {}
	resolved_path = "/video/generations/models"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listVideos(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoListResponse:
	path = path or {}
	resolved_path = "/videos"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listVideosAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> VideoListResponse:
	path = path or {}
	resolved_path = "/video/generations"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listWorkspaceAuditEvents(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceAuditEventListResponse:
	path = path or {}
	resolved_path = "/audit-events"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listWorkspaceInvites(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceInviteListResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/invites"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listWorkspaceJoinRequests(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceJoinRequestListResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/join-requests"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listWorkspaceMembers(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceMemberListResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/members"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def listWorkspaces(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceListResponse:
	path = path or {}
	resolved_path = "/workspaces"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def openAsyncJobWebSocket(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = f"/async/{path.get('kind', '')}/{path.get('id', '')}/ws"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def publishPresetVersion(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetVersionResponse:
	path = path or {}
	resolved_path = f"/presets/{path.get('id', '')}/versions"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def rejectWorkspaceJoinRequest(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceJoinRequestResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/join-requests/{path.get('request_id', '')}/reject"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def removeWorkspaceMembers(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceMemberRemoveResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/members/remove"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def replaceDynamicRouteKeys(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DynamicRouteKeysResponse:
	path = path or {}
	resolved_path = f"/routing/dynamic-routes/{path.get('id', '')}/keys"
	return client.request("PUT", resolved_path, query=query, headers=headers, body=body)


def retrieveBatch(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchResponse:
	path = path or {}
	resolved_path = f"/batches/{path.get('batch_id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def retrieveBatchAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> BatchResponse:
	path = path or {}
	resolved_path = f"/batch/{path.get('id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def retrieveBatchFile(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> FileResponse:
	path = path or {}
	resolved_path = f"/batches/files/{path.get('file_id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def retrieveBatchFileAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> FileResponse:
	path = path or {}
	resolved_path = f"/batch/files/{path.get('file_id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def retrieveBatchFileContent(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = f"/batches/files/{path.get('file_id', '')}/content"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def retrieveBatchFileContentAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = f"/batch/files/{path.get('file_id', '')}/content"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def retrieveFile(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> FileResponse:
	path = path or {}
	resolved_path = f"/files/{path.get('file_id', '')}"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def retrieveFileContent(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> Any:
	path = path or {}
	resolved_path = f"/files/{path.get('file_id', '')}/content"
	return client.request("GET", resolved_path, query=query, headers=headers, body=body)


def updateApiKey(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ApiKeyResponse:
	path = path or {}
	resolved_path = f"/keys/{path.get('id', '')}"
	return client.request("PATCH", resolved_path, query=query, headers=headers, body=body)


def updateDynamicRoute(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> DynamicRouteResponse:
	path = path or {}
	resolved_path = f"/routing/dynamic-routes/{path.get('id', '')}"
	return client.request("PATCH", resolved_path, query=query, headers=headers, body=body)


def updateObservabilityDestination(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ObservabilityDestinationResponse:
	path = path or {}
	resolved_path = f"/observability/destinations/{path.get('id', '')}"
	return client.request("PATCH", resolved_path, query=query, headers=headers, body=body)


def updateObservabilityLoggingPolicy(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> ObservabilityLoggingPolicyResponse:
	path = path or {}
	resolved_path = "/observability/logging-policy"
	return client.request("PATCH", resolved_path, query=query, headers=headers, body=body)


def updatePreset(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetResponse:
	path = path or {}
	resolved_path = f"/presets/{path.get('id', '')}"
	return client.request("PATCH", resolved_path, query=query, headers=headers, body=body)


def updatePresetPublisher(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> PresetPublisherResponse:
	path = path or {}
	resolved_path = "/presets/publisher"
	return client.request("PUT", resolved_path, query=query, headers=headers, body=body)


def updateWorkspace(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}"
	return client.request("PATCH", resolved_path, query=query, headers=headers, body=body)


def updateWorkspaceMemberRole(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceMemberResponse:
	path = path or {}
	resolved_path = f"/workspaces/{path.get('id', '')}/members/{path.get('user_id', '')}"
	return client.request("PATCH", resolved_path, query=query, headers=headers, body=body)


def updateWorkspaceSettings(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> WorkspaceSettingsResponse:
	path = path or {}
	resolved_path = "/settings"
	return client.request("PATCH", resolved_path, query=query, headers=headers, body=body)


def uploadBatchFile(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> FileResponse:
	path = path or {}
	resolved_path = "/batches/files"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def uploadBatchFileAlias(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> FileResponse:
	path = path or {}
	resolved_path = "/batch/files"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


def uploadFile(
	client: Client,
	*,
	path: Optional[Dict[str, Any]] = None,
	query: Optional[Dict[str, Any]] = None,
	headers: Optional[Dict[str, str]] = None,
	body: Optional[Any] = None,
) -> FileResponse:
	path = path or {}
	resolved_path = "/files"
	return client.request("POST", resolved_path, query=query, headers=headers, body=body)


operations___all__ = ["addWorkspaceMembers", "applyPresetUpstreamVersion", "approveWorkspaceJoinRequest", "calculatePricing", "cancelBatch", "cancelBatchAlias", "cancelVideo", "cancelVideoAlias", "createAnthropicMessage", "createApiKey", "createBatch", "createBatchAlias", "createChatCompletion", "createDynamicRoute", "createEmbedding", "createImage", "createImageEdit", "createModeration", "createObservabilityDestination", "createOcr", "createParse", "createPreset", "createRerank", "createResponse", "createSpeech", "createTranscription", "createTranslation", "createVideo", "createVideoAlias", "createVideoDownloadUrl", "createVideoDownloadUrlAlias", "createWorkspace", "createWorkspaceInvite", "deleteApiKey", "deleteDynamicRoute", "deleteObservabilityDestination", "deletePreset", "deleteVideo", "deleteVideoAlias", "deleteWorkspace", "deleteWorkspaceInvite", "deployDynamicRouteVersion", "exportAnalyticsCsv", "forkPreset", "generateMusic", "generateMusicAlias", "getActivity", "getActivityAlias", "getApiKey", "getCredits", "getCurrentApiKey", "getDynamicRoute", "getGeneration", "getHealth", "getMusicGeneration", "getMusicGenerationAlias", "getObservabilityDestination", "getObservabilityLoggingPolicy", "getPreset", "getPresetPublisher", "getProviderDerankStatus", "getVideo", "getVideoAlias", "getVideoContent", "getVideoContentAlias", "getWorkspace", "getWorkspaceSettings", "listApiKeys", "listBatchCapabilities", "listBatchCapabilitiesAlias", "listBatches", "listBatchesAlias", "listBatchFiles", "listBatchFilesAlias", "listBatchModels", "listBatchModelsAlias", "listBatchRequests", "listBatchRequestsAlias", "listDataModels", "listDynamicRoutes", "listEndpoints", "listFiles", "listModelEndpoints", "listModels", "listObservabilityDestinations", "listOrganisations", "listPresets", "listPresetVersions", "listPricingModels", "listProviders", "listTeamModels", "listVideoModels", "listVideoModelsAlias", "listVideos", "listVideosAlias", "listWorkspaceAuditEvents", "listWorkspaceInvites", "listWorkspaceJoinRequests", "listWorkspaceMembers", "listWorkspaces", "openAsyncJobWebSocket", "publishPresetVersion", "rejectWorkspaceJoinRequest", "removeWorkspaceMembers", "replaceDynamicRouteKeys", "retrieveBatch", "retrieveBatchAlias", "retrieveBatchFile", "retrieveBatchFileAlias", "retrieveBatchFileContent", "retrieveBatchFileContentAlias", "retrieveFile", "retrieveFileContent", "updateApiKey", "updateDynamicRoute", "updateObservabilityDestination", "updateObservabilityLoggingPolicy", "updatePreset", "updatePresetPublisher", "updateWorkspace", "updateWorkspaceMemberRole", "updateWorkspaceSettings", "uploadBatchFile", "uploadBatchFileAlias", "uploadFile"]
