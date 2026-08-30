/* eslint-disable react/no-unescaped-entities -- Contract prose uses natural apostrophes. */
import type { Metadata } from "next";
import Link from "next/link";
import { TrustCallout, TrustDocument, TrustSection, TrustTable } from "@/components/trust/TrustDocument";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Data Processing Addendum",
	description: "Review Phaseo's non-binding first draft Data Processing Addendum for UK and EU controller-to-processor use.",
	path: "/trust/dpa",
	keywords: ["Phaseo DPA", "Phaseo data processing addendum", "AI gateway DPA"],
});

const listClass = "list-decimal space-y-3 pl-5";
const bulletsClass = "list-disc space-y-2 pl-5";

export default function DpaPage() {
	return (
		<TrustDocument
			title="Data Processing Addendum"
			description="A UK and EU-oriented controller-to-processor first draft for product and counsel review. It is not automatically incorporated into Phaseo's Terms and is not an executed agreement."
			status="First draft · legal review required"
		>
			<TrustCallout title="Not yet binding">
				Do not rely on this page as an executed DPA. Bracketed items require factual or legal review, including party details, processing locations, subprocessor notice, deletion timing, transfer terms, and signatures. Request a reviewed version from <a href="mailto:privacy@phaseo.app" className="text-foreground underline underline-offset-4">privacy@phaseo.app</a>.
			</TrustCallout>

			<TrustSection id="parties" title="Parties and effective date">
				<p>This Data Processing Addendum (the <span className="font-medium text-foreground">DPA</span>) is proposed between:</p>
				<ul className={bulletsClass}>
					<li>the customer identified in the applicable order, online account, or signature block (<span className="font-medium text-foreground">Customer</span>); and</li>
					<li>Daniel Butler, trading as Phaseo, of <span className="font-medium text-amber-700 dark:text-amber-300">[LEGAL REVIEW: insert service address and any required registration details]</span> (<span className="font-medium text-foreground">Phaseo</span>).</li>
				</ul>
				<p><span className="font-medium text-foreground">Effective date:</span> <span className="text-amber-700 dark:text-amber-300">[insert date when signed or validly incorporated]</span>.</p>
				<p>This DPA supplements the agreement governing Customer's use of the Phaseo service (the <span className="font-medium text-foreground">Agreement</span>). If there is a conflict about processing Customer Personal Data, this DPA controls to the extent of that conflict.</p>
			</TrustSection>

			<TrustSection id="definitions" title="1. Definitions">
				<ul className={bulletsClass}>
					<li><span className="font-medium text-foreground">Applicable Data Protection Law</span> means the data-protection and privacy laws that apply to processing under this DPA, including the UK GDPR, Data Protection Act 2018, and EU GDPR where applicable.</li>
					<li><span className="font-medium text-foreground">Customer Data</span> means data Customer submits to the service or directs Phaseo to process on its behalf. It excludes data for which Phaseo acts as an independent controller, such as Phaseo's own account administration, billing, fraud prevention, and service-security records.</li>
					<li><span className="font-medium text-foreground">Customer Personal Data</span> means personal data contained in Customer Data.</li>
					<li><span className="font-medium text-foreground">Data Subject, Controller, Processor, Personal Data Breach, Process,</span> and <span className="font-medium text-foreground">Supervisory Authority</span> have the meanings given by Applicable Data Protection Law.</li>
					<li><span className="font-medium text-foreground">Subprocessor</span> means a processor engaged by Phaseo to process Customer Personal Data on Customer's behalf.</li>
				</ul>
			</TrustSection>

			<TrustSection id="roles" title="2. Roles, scope, and instructions">
				<ol className={listClass}>
					<li>Customer is the Controller and Phaseo is the Processor for Customer Personal Data, except where Customer acts as a Processor for another Controller, in which case Phaseo is Customer's Subprocessor.</li>
					<li>Phaseo will process Customer Personal Data only on Customer's documented instructions, including the Agreement, this DPA, Customer's service configuration, API requests, selected models and providers, routing policies, and support requests.</li>
					<li>If Applicable Data Protection Law requires other processing, Phaseo will inform Customer before processing unless the law prohibits notice.</li>
					<li>Phaseo will promptly inform Customer if, in Phaseo's reasonable opinion, an instruction infringes Applicable Data Protection Law. Phaseo may suspend the affected processing while the parties resolve the issue.</li>
					<li>Annex 1 describes the subject matter, duration, nature, purpose, data subjects, and data categories.</li>
				</ol>
			</TrustSection>

			<TrustSection id="customer" title="3. Customer obligations">
				<ol className={listClass}>
					<li>Customer will provide lawful instructions, necessary notices, and a valid legal basis for Customer Personal Data.</li>
					<li>Customer will not submit special-category, criminal-offence, health, payment-card, or other highly sensitive data unless the Agreement expressly permits it and Customer has confirmed that the selected Phaseo configuration and AI providers are appropriate.</li>
					<li>Customer is responsible for selecting AI providers, routing restrictions, retention and logging settings, credentials, and customer-directed destinations.</li>
					<li>Customer will limit access, protect credentials, and notify Phaseo promptly of suspected compromise or unlawful instructions.</li>
				</ol>
			</TrustSection>

			<TrustSection id="confidentiality" title="4. Confidentiality and access">
				<ol className={listClass}>
					<li>Phaseo will limit access to Customer Personal Data to people who need it to perform the Agreement, support the service, maintain security, or comply with law.</li>
					<li>Phaseo will ensure that authorised people are bound by confidentiality obligations.</li>
					<li>Phaseo will maintain the technical and organisational measures described in Annex 2, taking into account the state of the art, implementation cost, processing context, and risk.</li>
				</ol>
			</TrustSection>

			<TrustSection id="subprocessors" title="5. Subprocessors and AI providers">
				<ol className={listClass}>
					<li>Customer gives general written authorisation for Phaseo to use the Subprocessors listed on the <Link href="/trust/subprocessors" className="text-foreground underline underline-offset-4">public subprocessor schedule</Link>, subject to the agreed notice and objection process.</li>
					<li className="text-amber-700 dark:text-amber-300">[LEGAL AND OPERATIONAL REVIEW: select a notice period, direct-notification method, and objection procedure before execution. The current service only publishes dated page changes.]</li>
					<li>Phaseo will impose data-protection obligations on each Subprocessor that are materially protective of Customer Personal Data as required by Applicable Data Protection Law. Phaseo remains responsible for a Subprocessor's performance of those obligations to the extent required by law.</li>
					<li>Customer instructs Phaseo to send Customer Data to the AI provider selected by Customer or by Customer's routing configuration. The provider's legal role may depend on the route and contract. If that provider is Phaseo's Subprocessor, this Section applies; if it is an independent Controller or Customer-appointed Processor, its own terms govern that role.</li>
					<li>Customer may restrict permitted providers using available routing controls. Phaseo will not promise that every model, region, retention policy, or provider remains available.</li>
				</ol>
			</TrustSection>

			<TrustSection id="rights" title="6. Data-subject requests and compliance assistance">
				<ol className={listClass}>
					<li>Taking into account the nature of processing, Phaseo will provide reasonable assistance for Customer to respond to data-subject requests where Customer cannot fulfil the request using the service.</li>
					<li>If Phaseo receives a request concerning Customer Personal Data, Phaseo will direct the requester to Customer unless legally prohibited or Phaseo is independently responsible for the request.</li>
					<li>Phaseo will provide reasonable information and assistance for Customer's security assessments, data-protection impact assessments, prior consultations, and regulatory enquiries, considering the nature of processing and information available to Phaseo.</li>
					<li>Assistance beyond standard service functionality may be subject to reasonable fees where permitted by law and agreed in advance.</li>
				</ol>
			</TrustSection>

			<TrustSection id="breach" title="7. Personal Data Breach">
				<ol className={listClass}>
					<li>Phaseo will notify Customer without undue delay after becoming aware of a confirmed Personal Data Breach affecting Customer Personal Data.</li>
					<li>As information becomes available, the notice will describe the nature of the breach, likely consequences, measures taken or proposed, and a contact for follow-up. Phaseo may provide information in phases.</li>
					<li>Phaseo will take reasonable steps to contain, investigate, mitigate, and remediate the breach and will reasonably assist Customer with legally required notifications.</li>
					<li>Notification is not an admission of fault or liability. Customer remains responsible for deciding whether and how to notify authorities or data subjects.</li>
				</ol>
			</TrustSection>

			<TrustSection id="transfers" title="8. International transfers">
				<ol className={listClass}>
					<li>Customer authorises processing in the countries identified in the subprocessor schedule and in the locations used by customer-selected AI providers.</li>
					<li>Where a restricted transfer requires safeguards, the parties will use an applicable adequacy decision, the European Commission's controller-to-processor Standard Contractual Clauses, the UK International Data Transfer Addendum or Agreement, or another valid mechanism.</li>
					<li className="text-amber-700 dark:text-amber-300">[LEGAL REVIEW: identify exporter/importer roles, modules, optional clauses, governing law, supervisory authority, UK mechanism, and completed annex details for the actual parties and vendor regions.]</li>
					<li>If a transfer mechanism becomes invalid, the parties will cooperate in good faith to adopt a lawful alternative or stop the affected transfer.</li>
				</ol>
			</TrustSection>

			<TrustSection id="deletion" title="9. Return and deletion">
				<ol className={listClass}>
					<li>During the Agreement, Customer may use available product controls to retrieve or delete supported Customer Data.</li>
					<li>On termination or Customer's written instruction, Phaseo will delete or return Customer Personal Data unless law requires retention. Deletion from backups may occur through the ordinary backup lifecycle.</li>
					<li className="text-amber-700 dark:text-amber-300">[LEGAL AND OPERATIONAL REVIEW: define a verified deletion period and backup lifecycle. The repository currently establishes 30-day data-contribution retention, 90–365-day optional I/O-log retention, and 30-second–24-hour response-cache retention, but not one complete account and metadata deletion schedule.]</li>
					<li>Deletion by Phaseo does not delete data retained by an independent Controller, customer-selected provider, or customer-directed destination. Customer must exercise its rights with those recipients separately.</li>
				</ol>
			</TrustSection>

			<TrustSection id="audit" title="10. Information and audits">
				<ol className={listClass}>
					<li>Phaseo will make available information reasonably necessary to demonstrate compliance with processor obligations, subject to confidentiality, security, and third-party restrictions.</li>
					<li>Customer will first use current public trust materials and reasonable written questionnaires. If those are insufficient and Applicable Data Protection Law requires more, Customer may request an audit no more than once annually, or after a confirmed material breach.</li>
					<li>Audits must use an independent qualified auditor, avoid access to other customers' data, minimise disruption, and comply with reasonable security procedures. Customer bears reasonable costs unless the audit identifies material non-compliance.</li>
					<li>Phaseo does not currently have a SOC 2 report, ISO 27001 certificate, or independent penetration-test report to provide.</li>
				</ol>
			</TrustSection>

			<TrustSection id="general" title="11. Liability, term, and general terms">
				<ol className={listClass}>
					<li>This DPA remains in effect while Phaseo processes Customer Personal Data under the Agreement.</li>
					<li>Liability under this DPA is subject to the Agreement's exclusions and limits to the extent permitted by law.</li>
					<li>The Agreement's governing-law and dispute provisions apply unless Applicable Data Protection Law or an incorporated transfer mechanism requires otherwise.</li>
					<li className="text-amber-700 dark:text-amber-300">[LEGAL REVIEW: confirm enforceability, liability allocation, priority, governing law, execution method, and relationship with consumer terms.]</li>
				</ol>
			</TrustSection>

			<TrustSection id="annex-1" title="Annex 1 — Processing details">
				<TrustTable>
					<table className="w-full min-w-[720px] text-left"><tbody className="align-top">
						<tr className="border-b border-border"><th className="w-52 py-4 pr-4 font-medium text-foreground">Subject matter</th><td className="py-4">Providing the Phaseo dashboard, API gateway, model routing, usage and billing records, configured logging, data contribution, observability, notifications, and related support.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Duration</th><td className="py-4">The term of the Agreement plus the time necessary to return or delete Customer Personal Data under Section 9 and applicable law.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Nature and purpose</th><td className="py-4">Receive, transmit, route, secure, cache, record, retrieve, classify when opted in, export when configured, support, and delete data to provide and protect the service.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Data subjects</th><td className="py-4">Customer's users, personnel, contractors, end users, prospects, customers, suppliers, and any other people whose data Customer includes in requests or configured destinations.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Data categories</th><td className="py-4">Prompt, message, document, image, audio, video, tool, and model-output content; identifiers; account and workspace references; device, IP, location, authentication, routing, provider, usage, cost, latency, error, security, and support metadata.</td></tr>
						<tr><th className="py-4 pr-4 font-medium text-foreground">Sensitive data</th><td className="py-4">Not intentionally required. Customer must not submit sensitive or regulated data unless expressly agreed and appropriately configured. The service cannot determine reliably whether all customer-supplied content contains sensitive data.</td></tr>
					</tbody></table>
				</TrustTable>
			</TrustSection>

			<TrustSection id="annex-2" title="Annex 2 — Current technical and organisational measures">
				<ul className={bulletsClass}>
					<li>HTTPS for public service delivery and upstream provider connections.</li>
					<li>AES-256-GCM encryption for stored BYOK credentials and encrypted storage for supported webhook and notification secrets.</li>
					<li>One-way keyed or password-based derivation for API, management, and OAuth secrets.</li>
					<li>Workspace roles, database access policies, scoped API and OAuth permissions, consent screens, and revocation controls.</li>
					<li>Rate limits for sensitive authentication and realtime routes; structured request and configuration validation.</li>
					<li>Separation of raw gateway content from the primary request database and analytics, subject to the documented response-cache, I/O-logging, data-contribution, provider, and customer-destination exceptions.</li>
					<li>Managed infrastructure logging, request metadata, provider health, and public incident status.</li>
					<li>Version control, dependency lockfiles, automated linting, type checking, and targeted tests.</li>
					<li>Private vulnerability reporting and a public security policy.</li>
				</ul>
				<p>See the <Link href="/trust/security" className="text-foreground underline underline-offset-4">security whitepaper</Link> for scope and limitations. These measures are self-attested and may evolve without reducing protection required by Applicable Data Protection Law.</p>
			</TrustSection>

			<TrustSection id="annex-3" title="Annex 3 — Subprocessors">
				<p>The dated <Link href="/trust/subprocessors" className="text-foreground underline underline-offset-4">subprocessor schedule</Link> is proposed to form Annex 3 once the parties complete the notice, location, transfer, and role-review placeholders.</p>
			</TrustSection>

			<TrustSection id="signature" title="Signature block">
				<TrustTable>
					<table className="w-full min-w-[640px] text-left"><thead><tr className="border-b border-border"><th className="py-3 pr-8 font-medium text-foreground">Customer</th><th className="py-3 font-medium text-foreground">Daniel Butler, trading as Phaseo</th></tr></thead><tbody><tr><td className="py-4 pr-8">Name: [insert]<br />Title: [insert]<br />Signature: [insert]<br />Date: [insert]</td><td className="py-4">Name: Daniel Butler<br />Title/capacity: <span className="text-amber-700 dark:text-amber-300">[legal review]</span><br />Signature: [insert]<br />Date: [insert]</td></tr></tbody></table>
				</TrustTable>
			</TrustSection>
		</TrustDocument>
	);
}
