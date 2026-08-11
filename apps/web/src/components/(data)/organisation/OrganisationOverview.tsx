import type { OrganisationOverview as OrganisationOverviewType } from "@/lib/fetchers/organisations/types";
import OrganisationLinks from "./OrganisationLinks";
import ModelsDisplay from "./ModelsDisplay";

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
					<h2 className="text-xl font-bold mb-1">
						About {organisation.name}
					</h2>
					<p>{organisation.description}</p>
				</section>
			)}

			{/* Links section */}
			{organisation.organisation_links &&
				organisation.organisation_links.length > 0 && (
					<section id="links" className="scroll-mt-36 space-y-3">
						<h2 className="text-xl font-semibold mb-2">Links</h2>
						<OrganisationLinks organisation={organisation} />
					</section>
				)}

			{/* Models section */}
			<section id="latest-models" className="scroll-mt-36 space-y-3">
				<h2 className="text-xl font-semibold">Latest Models</h2>
				<ModelsDisplay
					models={[...organisation.recent_models]}
					showStatusHeadings={false}
				/>
			</section>
		</div>
	);
}
