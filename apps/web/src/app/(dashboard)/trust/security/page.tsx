/* eslint-disable react/no-unescaped-entities -- Legal and security prose uses natural apostrophes. */
import type { Metadata } from "next";
import Link from "next/link";
import { TrustCallout, TrustDocument, TrustSection, TrustTable } from "@/components/trust/TrustDocument";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Security Whitepaper",
	description: "Review Phaseo's architecture, data flows, current security controls, limitations, and shared responsibilities.",
	path: "/trust/security",
	keywords: ["Phaseo security whitepaper", "Phaseo security", "AI gateway security"],
});

const listClass = "list-disc space-y-2 pl-5";

export default function SecurityWhitepaperPage() {
	return (
		<TrustDocument
			title="Security whitepaper"
			description="A self-attested overview of how Phaseo protects its website, dashboard, API gateway, and customer data. It describes current implementation evidence, not an independent audit."
			status="Self-attested · version 1.0"
		>
			<TrustCallout title="Assurance boundary">
				Phaseo is not SOC 2 or ISO 27001 certified and has not completed an independent penetration test. This paper is not a certification, warranty, or substitute for your own risk assessment.
			</TrustCallout>

			<TrustSection id="scope" title="1. Scope and service model">
				<p>Phaseo provides a public AI model directory, a customer dashboard, and an API gateway that forwards requests to third-party AI providers. This paper covers the Phaseo-controlled application, gateway, data stores, and operational integrations. It does not attest to controls operated by an AI provider or a customer-configured destination.</p>
				<p>The public website runs as a Next.js application hosted by Vercel and delivered behind Cloudflare. The gateway runs on Cloudflare Workers. Supabase provides authentication and the primary relational database. Additional services are listed in the <Link href="/trust/subprocessors" className="text-foreground underline underline-offset-4">subprocessor schedule</Link>.</p>
			</TrustSection>

			<TrustSection id="flow" title="2. Gateway data flow">
				<TrustTable>
					<table className="w-full min-w-[720px] text-left">
						<thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-3 pr-4 font-medium">Stage</th><th className="py-3 pr-4 font-medium">Data</th><th className="py-3 font-medium">Handling</th></tr></thead>
						<tbody className="align-top">
							<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Client to Phaseo</th><td className="py-4 pr-4">Request content, credentials, routing options, and network metadata</td><td className="py-4">Sent over HTTPS to Cloudflare and processed by the Gateway Worker.</td></tr>
							<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Phaseo metadata</th><td className="py-4 pr-4">Request ID, model and provider IDs, usage, cost, latency, status, errors, and coarse location</td><td className="py-4">Stored in Supabase for billing, usage views, reliability, abuse prevention, and support. Raw prompts and full outputs are excluded from the primary request record.</td></tr>
							<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Response cache</th><td className="py-4 pr-4">Workspace-scoped cache key, response body, and response metadata</td><td className="py-4">Eligible non-streaming text responses may be stored in Upstash Redis for five minutes by default. A preset may configure 30 seconds to 24 hours. The request body contributes to a SHA-256 cache-key digest but is not stored in the cached record.</td></tr>
							<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">AI provider</th><td className="py-4 pr-4">Request content and metadata necessary to fulfil the selected model call</td><td className="py-4">Sent over HTTPS to the provider selected directly or by the customer's routing policy. Provider retention, training, and residency terms apply.</td></tr>
							<tr><th className="py-4 pr-4 font-medium text-foreground">Client response</th><td className="py-4 pr-4">Provider output and Phaseo response metadata</td><td className="py-4">Returned to the client over HTTPS. Streaming data is processed in memory while the connection is active.</td></tr>
						</tbody>
					</table>
				</TrustTable>
			</TrustSection>

			<TrustSection id="exceptions" title="3. Content-storage choices and exceptions">
				<p>Phaseo does not make a universal zero-data-retention claim. In addition to the short-lived response cache, the following customer choices can extend content storage:</p>
				<ul className={listClass}>
					<li><span className="font-medium text-foreground">Private I/O logging:</span> a feature-gated workspace setting can store request, response, and optional provider payloads in private Cloudflare R2 for 90, 180, or 365 days. It is off by default.</li>
					<li><span className="font-medium text-foreground">Data contribution:</span> an explicit opt-in can capture successful non-BYOK prompts and completions in private Cloudflare R2 for no more than 30 days. Phaseo applies best-effort redaction, but customers must not treat redaction as a guarantee. A configured sample is sent to OpenAI with API storage disabled for asynchronous task classification.</li>
					<li><span className="font-medium text-foreground">Observability exports and notifications:</span> customer-configured destinations may receive prompts, outputs, metadata, or alert content according to the customer's settings.</li>
					<li><span className="font-medium text-foreground">Asynchronous and media APIs:</span> providers may retain job state, files, inputs, or generated assets for their own documented periods. Phaseo stores job and billing metadata needed to reconcile those requests.</li>
				</ul>
				<p>Disabling a Phaseo storage feature stops new capture subject to propagation and in-flight work. It does not delete data already received by an AI provider or customer-configured destination.</p>
			</TrustSection>

			<TrustSection id="controls" title="4. Current technical controls">
				<div className="grid gap-6 sm:grid-cols-2">
					<div><h3 className="font-medium text-foreground">Transport and secrets</h3><ul className={`mt-2 ${listClass}`}><li>Public service and upstream provider connections use HTTPS.</li><li>Bring-your-own provider credentials are encrypted with AES-256-GCM before database storage.</li><li>API and management keys use keyed one-way derivation; OAuth secrets use one-way password-based or keyed derivation.</li><li>Webhook and notification credentials use encrypted storage where the feature supports stored secrets.</li></ul></div>
					<div><h3 className="font-medium text-foreground">Identity and access</h3><ul className={`mt-2 ${listClass}`}><li>Workspace roles and database policies constrain account and workspace records.</li><li>OAuth consent screens display requested scopes; grants and tokens can be revoked.</li><li>SAML single sign-on and SCIM provisioning are gated enterprise capabilities, not universal controls.</li><li>Management and gateway keys can be scoped and rotated.</li></ul></div>
					<div><h3 className="font-medium text-foreground">Application safeguards</h3><ul className={`mt-2 ${listClass}`}><li>Rate limits protect sensitive OAuth and realtime routes.</li><li>Security headers include content-type, frame, referrer, and permissions restrictions; the OAuth consent route has a stricter content security policy.</li><li>Structured validation is used at API and configuration boundaries.</li><li>Billing operations use idempotency and database transaction controls in security-sensitive paths.</li></ul></div>
					<div><h3 className="font-medium text-foreground">Monitoring and disclosure</h3><ul className={`mt-2 ${listClass}`}><li>Cloudflare invocation logging and request metadata support operational monitoring.</li><li>Provider health and routing state help contain upstream failures.</li><li>Service health and incidents are published at <a href="https://status.phaseo.app" className="text-foreground underline underline-offset-4">status.phaseo.app</a>.</li><li>Private vulnerability reports are accepted through GitHub Security Advisories or <a href="mailto:security@phaseo.app" className="text-foreground underline underline-offset-4">security@phaseo.app</a>.</li></ul></div>
				</div>
			</TrustSection>

			<TrustSection id="development" title="5. Software and change management">
				<p>Phaseo's main repository is public. Changes use version control, dependency lockfiles, automated linting and type checks, and targeted automated tests. Security-focused validations cover selected secret boundaries, database policies, authentication flows, and gateway contracts.</p>
				<p>These practices reduce risk but do not prove that every change receives a formal security review or that the service is free of vulnerabilities. Phaseo does not currently publish a secure-development certification or an independently audited change-management control.</p>
			</TrustSection>

			<TrustSection id="availability" title="6. Availability and incident handling">
				<p>Phaseo uses managed infrastructure and provider-health routing to limit some failures. The public status page is hosted by incident.io. Phaseo does not offer a contractual uptime SLA for the public service and does not claim that its incident-response or business-continuity process has been independently tested.</p>
				<p>Security incidents involving personal data are assessed against applicable notification duties. The public vulnerability policy targets acknowledgement of a good-faith report within three business days; this is an operational target, not a contractual resolution deadline.</p>
			</TrustSection>

			<TrustSection id="responsibility" title="7. Customer responsibilities">
				<ul className={listClass}>
					<li>Do not send sensitive or regulated data unless your chosen Phaseo and AI-provider configuration is appropriate for that data.</li>
					<li>Review provider retention, training, residency, and acceptable-use terms before enabling a route.</li>
					<li>Use provider allowlists and privacy routing controls where route selection matters.</li>
					<li>Protect and rotate account, API, management, BYOK, webhook, and OAuth credentials.</li>
					<li>Limit workspace membership and OAuth scopes to what each person or application needs.</li>
					<li>Review private I/O logging, data contribution, response caching, observability, and notification settings before production use.</li>
				</ul>
			</TrustSection>

			<TrustSection id="limitations" title="8. Known assurance gaps">
				<ul className={listClass}>
					<li>No SOC 2, ISO 27001, PCI DSS, HIPAA, or comparable Phaseo certification is claimed.</li>
					<li>No completed independent penetration test or public audit report is claimed.</li>
					<li>No universal zero-data-retention or no-training guarantee applies across all providers.</li>
					<li>No end-to-end regional residency guarantee applies across all routes.</li>
					<li>General retention periods for every account, metadata, backup, support, and operational-log category have not yet been consolidated into one public schedule.</li>
				</ul>
			</TrustSection>

			<TrustSection id="contact" title="9. Contact">
				<p>Send security reports to <a href="mailto:security@phaseo.app" className="text-foreground underline underline-offset-4">security@phaseo.app</a>. Send privacy, DPA, and subprocessor questions to <a href="mailto:privacy@phaseo.app" className="text-foreground underline underline-offset-4">privacy@phaseo.app</a>.</p>
			</TrustSection>
		</TrustDocument>
	);
}
