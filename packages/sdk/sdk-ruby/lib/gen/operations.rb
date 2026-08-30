require_relative "client"

module Phaseo
  module Gen
    module Operations
      def self.addWorkspaceMembers(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/members/add"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.applyPresetUpstreamVersion(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets/#{URI.encode_uri_component(path["id"].to_s)}/upstream"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.approveWorkspaceJoinRequest(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/join-requests/#{URI.encode_uri_component(path["request_id"].to_s)}/approve"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.calculatePricing(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/pricing/calculate"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.cancelBatch(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches/#{URI.encode_uri_component(path["batch_id"].to_s)}/cancel"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.cancelBatchAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch/#{URI.encode_uri_component(path["id"].to_s)}/cancel"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.cancelVideo(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/videos/#{URI.encode_uri_component(path["video_id"].to_s)}/cancel"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.cancelVideoAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/video/generations/#{URI.encode_uri_component(path["video_id"].to_s)}/cancel"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createAnthropicMessage(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/messages"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createApiKey(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/keys"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createBatch(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createBatchAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createChatCompletion(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/chat/completions"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createDynamicRoute(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/routing/dynamic-routes"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createEmbedding(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/embeddings"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createImage(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/images/generations"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createImageEdit(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/images/edits"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createModeration(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/moderations"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createObservabilityDestination(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/observability/destinations"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createOcr(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/ocr"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createParse(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/parse"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createPreset(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createRerank(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/rerank"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createResponse(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/responses"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createSpeech(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/audio/speech"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createTranscription(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/audio/transcriptions"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createTranslation(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/audio/translations"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createVideo(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/videos"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createVideoAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/video/generations"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createVideoDownloadUrl(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/videos/#{URI.encode_uri_component(path["video_id"].to_s)}/download_url"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createVideoDownloadUrlAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/video/generations/#{URI.encode_uri_component(path["video_id"].to_s)}/download_url"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createWorkspace(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.createWorkspaceInvite(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/invites"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.deleteApiKey(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/keys/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "DELETE", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.deleteDynamicRoute(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/routing/dynamic-routes/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "DELETE", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.deleteObservabilityDestination(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/observability/destinations/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "DELETE", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.deletePreset(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "DELETE", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.deleteVideo(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/videos/#{URI.encode_uri_component(path["video_id"].to_s)}"
        client.request(method: "DELETE", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.deleteVideoAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/video/generations/#{URI.encode_uri_component(path["video_id"].to_s)}"
        client.request(method: "DELETE", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.deleteWorkspace(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "DELETE", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.deleteWorkspaceInvite(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/invites/#{URI.encode_uri_component(path["invite_id"].to_s)}"
        client.request(method: "DELETE", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.deployDynamicRouteVersion(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/routing/dynamic-routes/#{URI.encode_uri_component(path["id"].to_s)}/versions/#{URI.encode_uri_component(path["version"].to_s)}/deploy"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.exportAnalyticsCsv(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/analytics/export"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.forkPreset(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets/#{URI.encode_uri_component(path["id"].to_s)}/fork"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.generateMusic(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/music/generate"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.generateMusicAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/music/generations"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getActivity(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/activity"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getActivityAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/analytics"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getApiKey(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/keys/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getCredits(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/credits"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getCurrentApiKey(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/key"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getDynamicRoute(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/routing/dynamic-routes/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getGeneration(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/generations"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getHealth(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/health"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getMusicGeneration(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/music/generate/#{URI.encode_uri_component(path["music_id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getMusicGenerationAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/music/generations/#{URI.encode_uri_component(path["music_id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getObservabilityDestination(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/observability/destinations/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getObservabilityLoggingPolicy(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/observability/logging-policy"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getPreset(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getPresetPublisher(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets/publisher"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getProviderDerankStatus(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/health/providers/#{URI.encode_uri_component(path["provider_id"].to_s)}/derank"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getVideo(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/videos/#{URI.encode_uri_component(path["video_id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getVideoAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/video/generations/#{URI.encode_uri_component(path["video_id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getVideoContent(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/videos/#{URI.encode_uri_component(path["video_id"].to_s)}/content"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getVideoContentAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/video/generations/#{URI.encode_uri_component(path["video_id"].to_s)}/content"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getWorkspace(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.getWorkspaceSettings(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/settings"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listApiKeys(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/keys"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatchCapabilities(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches/capabilities"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatchCapabilitiesAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch/capabilities"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatches(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatchesAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatchFiles(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches/files"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatchFilesAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch/files"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatchModels(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches/models"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatchModelsAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch/models"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatchRequests(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches/#{URI.encode_uri_component(path["batch_id"].to_s)}/requests"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listBatchRequestsAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch/#{URI.encode_uri_component(path["id"].to_s)}/requests"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listDataModels(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/data/models"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listDynamicRoutes(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/routing/dynamic-routes"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listEndpoints(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/endpoints"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listFiles(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/files"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listModelEndpoints(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/models/#{URI.encode_uri_component(path["author"].to_s)}/#{URI.encode_uri_component(path["slug"].to_s)}/endpoints"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listModels(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/models"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listObservabilityDestinations(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/observability/destinations"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listOrganisations(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/organisations"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listPresets(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listPresetVersions(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets/#{URI.encode_uri_component(path["id"].to_s)}/versions"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listPricingModels(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/pricing/models"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listProviders(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/providers"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listTeamModels(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/models/me"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listVideoModels(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/videos/models"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listVideoModelsAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/video/generations/models"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listVideos(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/videos"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listVideosAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/video/generations"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listWorkspaceAuditEvents(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/audit-events"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listWorkspaceInvites(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/invites"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listWorkspaceJoinRequests(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/join-requests"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listWorkspaceMembers(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/members"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.listWorkspaces(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.openAsyncJobWebSocket(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/async/#{URI.encode_uri_component(path["kind"].to_s)}/#{URI.encode_uri_component(path["id"].to_s)}/ws"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.publishPresetVersion(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets/#{URI.encode_uri_component(path["id"].to_s)}/versions"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.rejectWorkspaceJoinRequest(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/join-requests/#{URI.encode_uri_component(path["request_id"].to_s)}/reject"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.removeWorkspaceMembers(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/members/remove"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.replaceDynamicRouteKeys(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/routing/dynamic-routes/#{URI.encode_uri_component(path["id"].to_s)}/keys"
        client.request(method: "PUT", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.retrieveBatch(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches/#{URI.encode_uri_component(path["batch_id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.retrieveBatchAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.retrieveBatchFile(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches/files/#{URI.encode_uri_component(path["file_id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.retrieveBatchFileAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch/files/#{URI.encode_uri_component(path["file_id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.retrieveBatchFileContent(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches/files/#{URI.encode_uri_component(path["file_id"].to_s)}/content"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.retrieveBatchFileContentAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch/files/#{URI.encode_uri_component(path["file_id"].to_s)}/content"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.retrieveFile(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/files/#{URI.encode_uri_component(path["file_id"].to_s)}"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.retrieveFileContent(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/files/#{URI.encode_uri_component(path["file_id"].to_s)}/content"
        client.request(method: "GET", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.updateApiKey(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/keys/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "PATCH", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.updateDynamicRoute(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/routing/dynamic-routes/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "PATCH", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.updateObservabilityDestination(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/observability/destinations/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "PATCH", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.updateObservabilityLoggingPolicy(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/observability/logging-policy"
        client.request(method: "PATCH", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.updatePreset(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "PATCH", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.updatePresetPublisher(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/presets/publisher"
        client.request(method: "PUT", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.updateWorkspace(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}"
        client.request(method: "PATCH", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.updateWorkspaceMemberRole(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/workspaces/#{URI.encode_uri_component(path["id"].to_s)}/members/#{URI.encode_uri_component(path["user_id"].to_s)}"
        client.request(method: "PATCH", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.updateWorkspaceSettings(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/settings"
        client.request(method: "PATCH", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.uploadBatchFile(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batches/files"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.uploadBatchFileAlias(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/batch/files"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

      def self.uploadFile(client, path: nil, query: nil, headers: nil, body: nil)
        path ||= {}
        resolved_path = "/files"
        client.request(method: "POST", path: resolved_path, query: query, headers: headers, body: body)
      end

    end
  end
end
