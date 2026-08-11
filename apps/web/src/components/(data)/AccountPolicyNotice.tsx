import Link from "next/link";
import { ShieldBan } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchAccountPrivacyPolicy } from "@/lib/fetchers/internal/fetchAccountPrivacyPolicy";
import { fetchSettingsPrivacyInitialData } from "@/lib/fetchers/internal/fetchSettingsPrivacyInitialData";

function isBlocked(mode: string | null | undefined, selected: string[], id: string) {
	return mode === "blocklist"
		? selected.includes(id)
		: mode === "allowlist" && !selected.includes(id);
}

export default async function AccountPolicyNotice({ kind, id }: { kind: "model" | "provider"; id: string }) {
	const [accountPolicy, workspaceData] = await Promise.all([
		fetchAccountPrivacyPolicy().catch(() => null),
		fetchSettingsPrivacyInitialData().catch(() => null),
	]);
	const accountRestriction = kind === "model"
		? { mode: accountPolicy?.modelRestrictionMode, selected: accountPolicy?.modelRestrictionModelIds ?? [] }
		: { mode: accountPolicy?.providerRestrictionMode, selected: accountPolicy?.providerRestrictionProviderIds ?? [] };
	const workspaceRestriction = kind === "model"
		? { mode: workspaceData?.initialGlobal?.model_restriction_mode, selected: workspaceData?.initialGlobal?.model_restriction_model_ids ?? [] }
		: { mode: workspaceData?.initialGlobal?.provider_restriction_mode, selected: workspaceData?.initialGlobal?.provider_restriction_provider_ids ?? [] };
	const workspaceBlocked = isBlocked(workspaceRestriction.mode, workspaceRestriction.selected, id);
	const accountBlocked = isBlocked(accountRestriction.mode, accountRestriction.selected, id);
	if (!workspaceBlocked && !accountBlocked) return null;
	const title = workspaceBlocked ? "Blocked by workspace Data Controls" : "Unavailable in Phaseo Chat";
	const description = workspaceBlocked
		? `Requests in this workspace cannot route to this ${kind}.`
		: `Your Personal Data Controls prevent Phaseo Chat from routing to this ${kind}. Workspace API keys are unaffected unless the workspace also blocks it.`;
	const href = workspaceBlocked ? "/settings/privacy" : "/settings/account/privacy";
	return <Alert className="mb-6 border-destructive/40 bg-destructive/5">
		<ShieldBan className="size-4 text-destructive" />
		<AlertTitle>{title}</AlertTitle>
		<AlertDescription>
			{description}{" "}
			<Link href={href} className="font-medium text-foreground underline underline-offset-4">Review Data Controls</Link>
			{workspaceBlocked && accountBlocked ? " Your Personal Data Controls also block it in Phaseo Chat." : null}
		</AlertDescription>
	</Alert>;
}
