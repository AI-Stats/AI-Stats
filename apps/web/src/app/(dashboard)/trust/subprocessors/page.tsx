/* eslint-disable react/no-unescaped-entities -- Vendor and legal prose uses natural apostrophes. */
import type { Metadata } from "next";
import Link from "next/link";
import { TrustCallout, TrustDocument, TrustSection, TrustTable } from "@/components/trust/TrustDocument";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Subprocessors",
	description: "Review the infrastructure, AI processing, and other third parties Phaseo uses to deliver the service.",
	path: "/trust/subprocessors",
	keywords: ["Phaseo subprocessors", "Phaseo service providers", "AI gateway subprocessors"],
});

const coreProcessors = [
	{ name: "Cloudflare", purpose: "Public edge, DNS, Gateway Worker execution, logs, KV, Durable Objects, and private R2 object storage", data: "Network and request data; gateway content in transit; optional I/O logs and data contributions; operational metadata", location: "Global edge; configured storage and processing locations require factual confirmation before DPA execution", condition: "Core" },
	{ name: "Vercel", purpose: "Host and deliver the Phaseo web application", data: "Website and dashboard traffic, account-facing requests, device and operational metadata", location: "Global delivery network; deployment processing locations require factual confirmation", condition: "Core" },
	{ name: "Supabase", purpose: "Authentication and primary relational database", data: "Account, workspace, configuration, billing reference, request, usage, security, and support metadata", location: "Production project region requires factual confirmation", condition: "Core" },
	{ name: "Upstash", purpose: "Redis-backed response caching and cache-related routing data", data: "Workspace-scoped cache keys, model outputs, response metadata, and short-lived routing/cache records", location: "Production database region requires factual confirmation", condition: "When the Redis binding is enabled" },
	{ name: "OpenAI", purpose: "Classify a configured sample of opted-in data contributions", data: "Best-effort-redacted prompt and response content and classifier instructions", location: "According to the Phaseo OpenAI API account and applicable transfer terms; factual confirmation required", condition: "Only when data contribution and upstream classification are enabled" },
] as const;

const operationalProviders = [
	{ name: "Stripe", role: "Billing and payment processing", data: "Billing identity, transaction, invoice, refund, and payment-method data" },
	{ name: "Resend", role: "Transactional and operational email", data: "Recipient contact details, email content, and delivery events" },
	{ name: "Statsig", role: "Feature flags and experiments", data: "Stable, user, workspace, environment, and feature-evaluation identifiers; authenticated email where configured" },
	{ name: "Google Analytics", role: "Consent-based website analytics", data: "Page, device, referrer, event, and coarse location data" },
	{ name: "Vercel Web Analytics", role: "Consent-based website analytics", data: "Page, device, referrer, and performance telemetry" },
	{ name: "PostHog", role: "Product analytics where the production key is enabled", data: "Product events, page, device, and usage telemetry; raw gateway content is excluded by design" },
	{ name: "Mintlify", role: "Documentation hosting", data: "Documentation requests, network data, and documentation analytics" },
	{ name: "incident.io", role: "Public status page and incident communications", data: "Status-page traffic and incident-subscription contact details when supplied" },
	{ name: "Tawk.to", role: "Optional live support chat", data: "Contact details, chat content, device, and page context" },
	{ name: "Notion", role: "Support ticket and internal workflow management", data: "Contact details, ticket content, and related account context" },
	{ name: "Discord", role: "Internal operational notifications and customer-configured alert delivery", data: "Masked contact data, operational or billing summaries, and customer-selected alert content" },
] as const;

export default function SubprocessorsPage() {
	return (
		<TrustDocument
			title="Subprocessors and third-party processing"
			description="A dated schedule of the services Phaseo uses, the data they may receive, and the conditions that apply. The legal role of an AI provider can vary by route and contract."
			status="Public schedule · factual and legal review noted"
		>
			<TrustCallout title="How to read this schedule">
				The first table identifies services that can process Customer Data on Phaseo's behalf under a customer DPA. Later sections distinguish customer-selected AI providers and services Phaseo mainly uses for its own controller operations. Inclusion does not mean every service receives every customer's data.
			</TrustCallout>

			<TrustSection id="core" title="1. Core and conditional subprocessors">
				<TrustTable>
					<table className="w-full min-w-[960px] text-left">
						<thead><tr className="border-b border-border text-xs"><th className="py-3 pr-4 font-medium">Provider</th><th className="py-3 pr-4 font-medium">Purpose</th><th className="py-3 pr-4 font-medium">Data</th><th className="py-3 pr-4 font-medium">Processing location</th><th className="py-3 font-medium">When used</th></tr></thead>
						<tbody className="align-top">{coreProcessors.map((provider) => <tr key={provider.name} className="border-b border-border last:border-0"><th className="py-4 pr-4 font-medium text-foreground">{provider.name}</th><td className="py-4 pr-4">{provider.purpose}</td><td className="py-4 pr-4">{provider.data}</td><td className="py-4 pr-4">{provider.location}</td><td className="py-4">{provider.condition}</td></tr>)}</tbody>
					</table>
				</TrustTable>
			</TrustSection>

			<TrustSection id="ai" title="2. Customer-selected AI providers">
				<p>Phaseo sends request content and necessary metadata to the provider selected by the customer, the requested model, or the customer's routing configuration. The available set changes as routes are added, disabled, or degraded. The live <Link href="/providers" className="text-foreground underline underline-offset-4">provider directory</Link> is the maintainable source for currently available providers.</p>
				<p>Depending on Phaseo's contract, the customer's instructions, and the provider's terms, an AI provider may be a Phaseo subprocessor, the customer's processor, an independent controller, or another type of recipient. Phaseo does not make one blanket legal classification for every route. Customers should restrict allowed providers when provider identity, region, retention, or training policy matters.</p>
				<p>The current Privacy Policy says model providers usually act as independent controllers. That classification is flagged for legal review because contracted API terms may allocate roles differently. The <Link href="/trust/dpa" className="text-foreground underline underline-offset-4">DPA first draft</Link> therefore treats routing to an AI provider as a documented customer instruction without prejudging every provider's role.</p>
			</TrustSection>

			<TrustSection id="operations" title="3. Other service providers">
				<p>These vendors support Phaseo's billing, communications, product operations, documentation, or support. They may be processors for Phaseo when Phaseo acts as a controller, but are not automatically subprocessors for all Customer Data under the DPA.</p>
				<TrustTable>
					<table className="w-full min-w-[720px] text-left">
						<thead><tr className="border-b border-border text-xs"><th className="py-3 pr-4 font-medium">Provider</th><th className="py-3 pr-4 font-medium">Role</th><th className="py-3 font-medium">Data</th></tr></thead>
						<tbody className="align-top">{operationalProviders.map((provider) => <tr key={provider.name} className="border-b border-border last:border-0"><th className="py-4 pr-4 font-medium text-foreground">{provider.name}</th><td className="py-4 pr-4">{provider.role}</td><td className="py-4">{provider.data}</td></tr>)}</tbody>
					</table>
				</TrustTable>
			</TrustSection>

			<TrustSection id="customer" title="4. Customer-directed destinations">
				<p>When a customer configures an observability endpoint, webhook, email recipient, Slack workspace, Microsoft Teams channel, Discord destination, OAuth application, or compatible AI assistant, Phaseo sends the selected data to that destination on the customer's instruction. Those recipients are not Phaseo-appointed subprocessors merely because Phaseo provides the connection.</p>
			</TrustSection>

			<TrustSection id="changes" title="5. Changes and objections">
				<p>Phaseo publishes material changes to this page with a new review date. The current product does not yet provide a contractual subprocessor-change subscription. Customers that require advance email notice, a fixed notice period, or a formal objection process should include that requirement in an executed DPA or contact <a href="mailto:privacy@phaseo.app" className="text-foreground underline underline-offset-4">privacy@phaseo.app</a>.</p>
				<p><span className="font-medium text-foreground">Legal-review placeholder:</span> before the public DPA is incorporated into contracts, Phaseo must select and operationalise a notice period, notification channel, and objection process.</p>
			</TrustSection>

			<TrustSection id="history" title="6. Change history">
				<dl className="grid gap-2 border-y border-border py-4 sm:grid-cols-[10rem_1fr]"><dt className="font-medium text-foreground">30 August 2026</dt><dd>Initial evidence-backed schedule. Added the short-lived Upstash response cache, optional OpenAI data-contribution classification, and separate customer-directed and controller-operation categories.</dd></dl>
			</TrustSection>
		</TrustDocument>
	);
}
