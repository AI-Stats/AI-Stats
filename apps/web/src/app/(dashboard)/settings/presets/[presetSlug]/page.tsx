import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PresetForm from "@/components/(gateway)/settings/presets/PresetForm";
import { ProductFeedbackButton } from "@/components/feedback/ProductFeedbackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchFrontendAPIProviders, fetchFrontendModels } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import { fetchSettingsPresetsInitialData } from "@/lib/fetchers/internal/fetchSettingsPresetsInitialData";

export const metadata = { title: "Edit Preset - Settings" };

export default async function PresetDetailPage({ params }: { params: Promise<{ presetSlug: string }> }) {
	const { presetSlug } = await params;
	const decodedSlug = decodeURIComponent(presetSlug).trim().toLowerCase();
	const [initialData, models, providers] = await Promise.all([
		fetchSettingsPresetsInitialData(),
		fetchFrontendModels(),
		fetchFrontendAPIProviders(),
	]);
	const preset = initialData.teamsWithPresets
		.flatMap((workspace) => workspace.presets)
		.find((candidate: any) => String(candidate.slug ?? "").toLowerCase() === decodedSlug);
	if (!preset) notFound();

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
				<div className="flex min-w-0 items-center gap-3">
					<Button asChild variant="ghost" size="icon" className="rounded-md">
						<Link href="/settings/presets" aria-label="Back to Presets">
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="truncate text-xl font-semibold">Edit Preset</h1>
							{preset.hasDraftChanges ? <Badge variant="secondary">Unpublished Changes</Badge> : null}
						</div>
						<p className="text-sm text-muted-foreground">Changes remain a draft until you publish a new version.</p>
					</div>
				</div>
				<ProductFeedbackButton surface="settings_preset_editor" prompt="Tell us what is missing or confusing about the Preset editor." />
			</div>
			<PresetForm
				models={models}
				providers={providers}
				currentUserId={initialData.currentUserId}
				currentTeamId={initialData.initialTeamId}
				workspacePublisher={initialData.workspacePublisher}
				initialPreset={preset}
			/>
		</div>
	);
}
