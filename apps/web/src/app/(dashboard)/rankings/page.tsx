import { Suspense } from "react";
import { PublicGeography } from "@/components/(rankings)/PublicGeography";
import RankingsPageContent, {
	generateRankingsMetadata,
} from "./RankingsPageContent";

export const generateMetadata = generateRankingsMetadata;

export default async function RankingsPage() {
	return (
		<>
			<RankingsPageContent modality="text" />
			<Suspense fallback={<div className="mx-auto max-w-[1680px] px-4 pb-16 text-sm text-muted-foreground sm:px-6 lg:px-10">Loading geography…</div>}>
				<PublicGeography />
			</Suspense>
		</>
	);
}
