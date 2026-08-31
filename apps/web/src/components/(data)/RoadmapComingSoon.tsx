// components/common/RoadmapComingSoon.tsx
"use client";

import ComingSoon, { type ComingSoonProps } from "./ComingSoon";
import { getMilestone } from "@/lib/roadmap";
import { Infinity as InfinityIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type RoadmapComingSoonProps = {
	milestoneKey: string;
	overrides?: Partial<ComingSoonProps>; // optional tweaks per page
};

export default function RoadmapComingSoon({
	milestoneKey,
	overrides,
}: RoadmapComingSoonProps) {
	const t = useTranslations("Content.roadmap");
	const m = getMilestone(milestoneKey);

	if (!m) {
		// Fallback if unknown key (keeps page from breaking)
		return (
			<ComingSoon
				title={t("comingSoon")}
				subtitle={t("activeDevelopment")}
				description={t("shippingFast")}
				primaryAction={{ label: t("viewRoadmap"), href: "/roadmap" }}
				align="center"
				{...overrides}
			/>
		);
	}

	// Adapt roadmap fields to ComingSoon props
	const base: ComingSoonProps = {
		title: m.title,
		subtitle:
			m.status === "Ongoing"
				? t("continuousImprovements")
				: m.status === "In Progress"
				? t("currentlyBuilt")
				: m.status === "Beta"
				? t("availableBeta")
				: t("plannedFeature"),
		description: m.description,
		eta: m.due, // strings like "Nov 2025" render nicely in ComingSoon
		icon:
			m.icon === "Infinity" ? (
				<InfinityIcon className="h-5 w-5" />
			) : undefined,
		// Optional extras if you add them in the roadmap data later:
		// featureList: m.featureList,
		// tags: m.tags,
		breadcrumb: [
			{ label: "Phaseo", href: "/" },
			{ label: t("title"), href: "/roadmap" },
			{ label: m.title },
		],
		primaryAction: {
			label: t("seeRoadmapItem"),
			href: `/roadmap#milestone-${m.key}`,
		},
		secondaryAction: { label: t("goHome"), href: "/" },
		align: "center",
		variant: "minimal",
	};

	return <ComingSoon {...base} {...overrides} />;
}
