import type { PaletteItem } from "./Search.types";

export type SearchWorkspace = {
	id: string;
	name: string;
};

type WorkspaceSearchResponse = {
	workspaces?: SearchWorkspace[];
};

export function createWorkspaceSearchItem(
	workspace: SearchWorkspace,
): PaletteItem {
	return {
		id: `workspace:${workspace.id}`,
		title: workspace.name,
		subtitle: "Workspace settings",
		href: "/settings/workspaces/settings",
		workspaceId: workspace.id,
		keywords: ["workspace", "team", workspace.name],
	};
}

export async function fetchWorkspaceSearchItems(
	path: string,
): Promise<PaletteItem[]> {
	const response = await fetch(path, {
		method: "GET",
		credentials: "same-origin",
		headers: { Accept: "application/json" },
	});

	if (!response.ok) return [];

	const payload = (await response.json()) as WorkspaceSearchResponse;
	return (payload.workspaces ?? []).map(createWorkspaceSearchItem);
}
