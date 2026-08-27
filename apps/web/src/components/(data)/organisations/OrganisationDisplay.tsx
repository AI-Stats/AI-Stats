import OrganisationCard from "./OrganisationCard";
import type { OrganisationCard as OrganisationCardType } from "@/lib/fetchers/organisations/getAllOrganisations";

interface OrganisationDisplayProps {
	organisations: OrganisationCardType[];
}

export default function OrganisationsDisplay({
	organisations,
}: OrganisationDisplayProps) {
	return (
		<>
			<div className="mb-6 space-y-1">
				<h1 className="text-3xl font-bold tracking-tight">Labs</h1>
				<p className="text-sm text-muted-foreground">
					Explore the teams building today&apos;s AI models.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
				{organisations.map((organisation) => (
					<OrganisationCard
						key={organisation.organisation_id}
						organisation={organisation}
					/>
				))}
			</div>
		</>
	);
}
