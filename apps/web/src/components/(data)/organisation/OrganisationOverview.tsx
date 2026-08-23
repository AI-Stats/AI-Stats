import type { OrganisationOverview as OrganisationOverviewType } from "@/lib/fetchers/organisations/types";
import OrganisationLinks from "./OrganisationLinks";
import ModelsDisplay from "./ModelsDisplay";
import LabPerformance from "./LabPerformance";

export interface OrganisationOverviewProps {
	organisation: OrganisationOverviewType;
}

export default function OrganisationOverview({
	organisation,
}: OrganisationOverviewProps) {
	return (
		<div className="mx-auto w-full space-y-10">
			{/* Header & Description */}
			{organisation.description && (
				<section id="about" className="scroll-mt-36 space-y-2">
					<h2 className="text-xl font-semibold tracking-tight">
						About {organisation.name}
					</h2>
					<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
						{organisation.description}
					</p>
				</section>
			)}

			<section id="performance" className="scroll-mt-36 space-y-4 border-t border-border/60 pt-8">
				<div className="space-y-1">
					<h2 className="text-xl font-semibold tracking-tight">Performance</h2>
					<p className="text-sm text-muted-foreground">
						Recent gateway performance across models from {organisation.name}.
					</p>
				</div>
				<LabPerformance models={organisation.performance_models} />
			</section>

			{/* Models section */}
			<section id="latest-models" className="scroll-mt-36 space-y-4 border-t border-border/60 pt-8">
				<div className="space-y-1">
					<h2 className="text-xl font-semibold tracking-tight">Latest Models</h2>
					<p className="text-sm text-muted-foreground">
						Recent releases with availability, context, pricing, and usage details.
					</p>
				</div>
				<ModelsDisplay
					models={[...organisation.recent_models]}
					showStatusHeadings={false}
				/>
			</section>

			{organisation.organisation_links &&
				organisation.organisation_links.length > 0 && (
					<section id="links" className="scroll-mt-36 space-y-4 border-t border-border/60 pt-8">
						<div className="space-y-1">
							<h2 className="text-xl font-semibold tracking-tight">Around the web</h2>
							<p className="text-sm text-muted-foreground">
								Official profiles, research, and community channels.
							</p>
						</div>
						<OrganisationLinks organisation={organisation} />
					</section>
				)}
		</div>
	);
}
