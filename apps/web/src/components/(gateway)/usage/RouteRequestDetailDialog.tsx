"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { InvestigateGenerationResult } from "@/app/(dashboard)/gateway/usage/server-actions";
import RequestDetailDialog from "./RequestDetailDialog";

export function RouteRequestDetailErrorDialog({
	closeHref,
}: {
	closeHref: string;
}) {
	const router = useRouter();

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) router.push(closeHref);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Request details unavailable</DialogTitle>
					<DialogDescription>
						We couldn&apos;t load this request. Try again or return to the
						request logs.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => router.refresh()}>
						Try again
					</Button>
					<Button asChild>
						<Link href={closeHref}>Back to request logs</Link>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function RouteRequestDetailDialog({
	detail,
	closeHref,
	previousHref,
	nextHref,
}: {
	detail: InvestigateGenerationResult;
	closeHref: string;
	previousHref?: string | null;
	nextHref?: string | null;
}) {
	const router = useRouter();
	const modelMetadata = React.useMemo(
		() => new Map(detail.modelMetadata ?? []),
		[detail.modelMetadata],
	);
	const providerNames = React.useMemo(
		() => new Map(detail.providerNames ?? []),
		[detail.providerNames],
	);
	const providerMetadata = React.useMemo(
		() => new Map(detail.providerMetadata ?? []),
		[detail.providerMetadata],
	);
	const providerName = detail.request.provider
		? providerNames.get(detail.request.provider) || detail.request.provider
		: null;

	return (
		<RequestDetailDialog
			open
			presentation="sheet"
			onOpenChange={(open) => {
				if (!open) router.push(closeHref);
			}}
			request={detail.request}
			appName={detail.appName}
			modelMetadata={modelMetadata}
			providerNames={providerNames}
			providerMetadata={providerMetadata}
			providerName={providerName}
			ioLog={detail.ioLog}
			headerActions={
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						{previousHref ? (
							<Button asChild variant="outline" size="sm">
								<Link href={previousHref} prefetch>
									<ChevronLeft className="mr-1 h-4 w-4" />
									Previous
								</Link>
							</Button>
						) : (
							<Button variant="outline" size="sm" disabled>
								<ChevronLeft className="mr-1 h-4 w-4" />
								Previous
							</Button>
						)}
						{nextHref ? (
							<Button asChild variant="outline" size="sm">
								<Link href={nextHref} prefetch>
									Next
									<ChevronRight className="ml-1 h-4 w-4" />
								</Link>
							</Button>
						) : (
							<Button variant="outline" size="sm" disabled>
								Next
								<ChevronRight className="ml-1 h-4 w-4" />
							</Button>
						)}
					</div>
					<Button asChild variant="ghost" size="sm">
						<Link href={closeHref} prefetch>
							<X className="mr-1 h-4 w-4" />
							Close
						</Link>
					</Button>
				</div>
			}
		/>
	);
}
