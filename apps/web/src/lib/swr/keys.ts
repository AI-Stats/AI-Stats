export const publicSWRKeys = {
	models: "/api/_web/models?limit=2000&offset=0&shape=page&projection=5",
	modelsV2:
		"/api/_web/models?limit=2000&offset=0&shape=page&projection=6&catalogue_version=v2",
	search: "/api/_web/search",
	status: "/api/_web/status",
} as const;
