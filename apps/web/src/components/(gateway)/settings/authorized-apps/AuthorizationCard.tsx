"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, Activity, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import RevokeDialog from "./RevokeDialog";
import { oauthScopeLabel } from "@/lib/oauth/scopes";

interface AuthorizationCardProps {
	authorization: any;
	userId: string;
}

export default function AuthorizationCard({ authorization }: AuthorizationCardProps) {
	const additionalScopes: string[] = Array.isArray(authorization.additional_scopes)
		? authorization.additional_scopes.filter((scope: unknown): scope is string => typeof scope === "string")
		: [];

	return (
		<Card className="min-w-0 overflow-hidden">
			<CardHeader className="pb-3">
				<div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex min-w-0 flex-1 items-start gap-3">
						{authorization.app_logo_url ? (
							<img
								src={authorization.app_logo_url}
								alt={authorization.app_name}
								className="size-12 rounded-md object-cover border shrink-0"
							/>
						) : (
							<div className="size-12 rounded-md border bg-muted flex items-center justify-center shrink-0">
								<Activity className="size-6 text-muted-foreground" />
							</div>
						)}
						<div className="min-w-0 flex-1">
							<CardTitle className="line-clamp-2 wrap-break-word text-lg">
								{authorization.app_name}
							</CardTitle>
							<CardDescription className="mt-1 wrap-break-word">
								{authorization.app_description || "No description provided"}
							</CardDescription>
							{authorization.app_homepage_url && (
								<a
									href={authorization.app_homepage_url}
									target="_blank"
									rel="noopener noreferrer"
									className="mt-2 inline-flex min-h-9 max-w-full items-center gap-1 wrap-break-word text-xs text-blue-600 underline decoration-transparent transition-colors duration-200 hover:decoration-current dark:text-blue-400"
								>
									<ExternalLink className="size-3" />
									<span>Visit website</span>
								</a>
							)}
						</div>
					</div>
					<RevokeDialog
						authorizationId={authorization.authorization_id}
						appName={authorization.app_name}
					/>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Scopes */}
				<div>
					<div className="text-sm font-medium mb-2">Permissions</div>
					<div className="flex min-w-0 flex-wrap gap-2">
						{(Array.isArray(authorization.scopes) ? authorization.scopes : []).map((scope: string) => (
							<Badge key={scope} variant="secondary" className="max-w-full whitespace-normal break-all text-left text-xs">
								{oauthScopeLabel(scope)}
							</Badge>
						))}
					</div>
				</div>

				{additionalScopes.length > 0 ? (
					<div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
						<div className="flex items-start gap-2">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
							<div className="min-w-0 space-y-2">
								<div className="text-sm font-medium text-amber-900 dark:text-amber-100">Additional permissions available</div>
								<p className="text-xs text-amber-800 dark:text-amber-200">
									This app can now request more permissions. Your existing access has not changed; review and approve any new request in the OAuth consent screen, or revoke this authorization to decline access.
								</p>
								<div className="flex flex-wrap gap-2">
									{additionalScopes.map((scope) => (
										<Badge key={scope} variant="outline" className="max-w-full whitespace-normal break-all border-amber-300 bg-transparent text-left text-xs text-amber-900 dark:border-amber-800 dark:text-amber-100">
											{oauthScopeLabel(scope)}
										</Badge>
									))}
								</div>
							</div>
						</div>
					</div>
				) : null}

				{/* Team */}
				<div>
					<div className="text-sm font-medium mb-1">Team</div>
					<div className="text-sm text-muted-foreground">
						{authorization.team_name}
					</div>
				</div>

				{/* Metadata */}
				<div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
					<div>
						<div className="flex items-center gap-1 text-muted-foreground mb-1">
							<Calendar className="size-3" />
							<span>Authorized</span>
						</div>
						<div className="font-medium">
							{formatDistanceToNow(new Date(authorization.authorized_at), {
								addSuffix: true,
							})}
						</div>
					</div>
					<div>
						<div className="flex items-center gap-1 text-muted-foreground mb-1">
							<Activity className="size-3" />
							<span>Last Used</span>
						</div>
						<div className="font-medium">
							{authorization.last_used_at
								? formatDistanceToNow(new Date(authorization.last_used_at), {
										addSuffix: true,
								  })
								: "Never"}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
