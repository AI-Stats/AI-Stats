"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { forkPresetAction } from "@/app/(dashboard)/settings/presets/actions";

export default function CopyPresetButton({
	sourcePresetId,
	sourceVersionId,
}: {
	sourcePresetId: string;
	sourceVersionId?: string;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	return (
		<Button
			variant="default"
			className="w-full rounded-md"
			disabled={isPending}
			onClick={() => {
				startTransition(async () => {
					try {
						const copied = await forkPresetAction(sourcePresetId, sourceVersionId);
						toast.success("Preset copied to your workspace", {
							action: copied.slug ? { label: "Open Preset", onClick: () => router.push(`/settings/presets/${encodeURIComponent(copied.slug!)}`) } : { label: "View Presets", onClick: () => router.push("/settings/presets") },
						});
					} catch (error) {
						const message = error instanceof Error ? error.message : "";
						if (message === "AUTH_REQUIRED") {
							router.push("/sign-in");
							return;
						}
						if (message === "TEAM_REQUIRED") {
							toast.error("Select a team before copying a preset.");
							return;
						}
						toast.error(message || "Failed to copy preset");
					}
				});
			}}
		>
			{isPending ? "Copying..." : "Copy to my presets"}
		</Button>
	);
}
