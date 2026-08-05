import { Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SettingsDynamicRoutesInitialData } from "@/lib/fetchers/internal/settingsTypes";

export default function RoutingInsights({ suggestions }: { suggestions: SettingsDynamicRoutesInitialData["suggestions"] }) {
	return (
		<div className="max-w-4xl">
			<header>
				<h1 className="text-2xl font-bold">Routing insights</h1>
				<p className="mt-2 text-sm text-muted-foreground">Provider health and routing recommendations across this workspace.</p>
			</header>
			{suggestions.length ? <div className="mt-6 divide-y border-y">{suggestions.map((suggestion) => <div key={suggestion.providerId} className="flex items-center gap-4 py-4"><div className="grid size-9 place-items-center rounded-lg bg-amber-500/10 text-amber-500"><Gauge className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{suggestion.providerName}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{suggestion.message}</p></div><Badge variant="outline" className="capitalize">{suggestion.severity}</Badge></div>)}</div> : <div className="mt-6 border-y py-10 text-center text-sm text-muted-foreground">No provider issues detected for this workspace.</div>}
		</div>
	);
}
