import { Suspense } from "react";
import PresetsPanel from "@/components/(gateway)/settings/presets/PresetsPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Plus, Sparkles, Store } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	fetchFrontendAPIProviders,
	fetchFrontendModels,
} from "@/lib/fetchers/frontend/fetchPublicCatalog";
import { fetchSettingsPresetsInitialData } from "@/lib/fetchers/internal/fetchSettingsPresetsInitialData";
import SettingsSectionFallback from "@/components/(gateway)/settings/SettingsSectionFallback";
import SettingsPageHeader from "@/components/(gateway)/settings/SettingsPageHeader";
import { presetExperimentsEnabled } from "@/lib/flags";

export const metadata = {
	title: "Presets - Settings",
};

export default async function PresetsPage() {
	const showPresetExperiments = await presetExperimentsEnabled();

	return (
		<div className="space-y-7">
			<Alert className="border-border/80 bg-muted/25">
				<Sparkles className="h-4 w-4 text-muted-foreground" />
				<AlertTitle className="text-foreground">
					Presets for request configuration
				</AlertTitle>
				<AlertDescription className="max-w-4xl text-muted-foreground">
					Presets are named configurations starting with @ that you can reference
					in your API calls. Save your preferred model, temperature, system
					prompts, and other settings to create reusable request templates.
				</AlertDescription>
			</Alert>

			<SettingsPageHeader
				title="Presets"
				description="Manage reusable request configurations for your API calls."
				meta={<Badge variant="outline">Beta</Badge>}
				actions={
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Button asChild variant="default" size="sm" className="h-9 gap-2 px-3">
							<Link href="/settings/presets/new">
								<Plus className="h-4 w-4" />
								Create preset
							</Link>
						</Button>
						{showPresetExperiments ? (
							<Button asChild variant="outline" size="sm" className="h-9 gap-2 px-3">
								<Link href="/settings/presets/experiments">
									<MessageSquareText className="h-4 w-4" />
									Preset feedback
								</Link>
							</Button>
						) : null}
						<Button asChild variant="outline" size="sm" className="h-9 gap-2 px-3">
							<Link href="/gateway/marketplace" target="_blank" rel="noreferrer">
								<Store className="h-4 w-4" />
								Marketplace
							</Link>
						</Button>
					</div>
				}
			/>

			<Suspense fallback={<SettingsSectionFallback />}>
				<PresetsContent />
			</Suspense>
		</div>
	);
}

async function PresetsContent() {
	const [initialData, models, providers] = await Promise.all([
		fetchSettingsPresetsInitialData(),
		fetchFrontendModels(),
		fetchFrontendAPIProviders(),
	]);

	const teamsWithPresets = initialData.teamsWithPresets.map((team) => ({
		...team,
		presets: team.presets.map((preset: any) => ({
			...preset,
			all_models: models,
		})),
	}));

	return (
		<PresetsPanel
			teamsWithPresets={teamsWithPresets}
			initialTeamId={initialData.initialTeamId}
			currentUserId={initialData.currentUserId}
			providers={providers}
		/>
	);
}
