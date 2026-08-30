/* eslint-disable react/no-unescaped-entities -- Contract prose uses natural apostrophes. */
import type { Metadata } from "next";
import Link from "next/link";
import { TrustCallout, TrustDocument, TrustSection, TrustTable } from "@/components/trust/TrustDocument";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Data Processing Addendum",
	description: "Review Phaseo's draft Data Processing Addendum for UK and EU controller-to-processor use.",
	path: "/trust/dpa",
	keywords: ["Phaseo DPA", "Phaseo data processing addendum", "AI gateway DPA"],
});

const clauses = "list-decimal space-y-3 pl-5";
const bullets = "list-disc space-y-2 pl-5";
const reviewText = "text-amber-700 dark:text-amber-300";

export default function DpaPage() {
	return (
		<TrustDocument
			title="Data Processing Addendum"
			description="Terms for processing personal data through Phaseo on a customer's behalf. This public version is a review draft. It does not bind either party until it is signed or expressly incorporated into an agreement."
			status="Review draft · legal approval required"
		>
			<TrustCallout title="Review draft">
				This draft is written to cover the mandatory controller-processor terms in Article 28 of the UK GDPR and EU GDPR. It still needs Phaseo's service address, confirmed transfer terms, a final approved list of Phaseo-managed AI Subprocessors, a verified deletion workflow, and qualified legal approval. Request an execution copy from <a href="mailto:privacy@phaseo.app" className="text-foreground underline underline-offset-4">privacy@phaseo.app</a>.
			</TrustCallout>

			<TrustSection id="parties" title="Parties and effective date">
				<p>This Data Processing Addendum (<span className="font-medium text-foreground">DPA</span>) forms part of the agreement that governs the Customer's use of the Services (<span className="font-medium text-foreground">Agreement</span>) once it has been signed or expressly incorporated into that Agreement.</p>
				<ul className={bullets}>
					<li><span className="font-medium text-foreground">Customer</span> is the person or organisation identified in the Agreement, order form, or signature block.</li>
					<li><span className="font-medium text-foreground">Phaseo</span> is Daniel Butler, trading as Phaseo, of <span className={reviewText}>[insert service address and any required tax or registration details]</span>.</li>
				</ul>
				<p>The <span className="font-medium text-foreground">Effective Date</span> is the date on which this DPA is last signed or validly incorporated into the Agreement.</p>
				<p>If this DPA conflicts with the Agreement on the processing of Customer Personal Data, this DPA controls. The Agreement otherwise remains unchanged.</p>
			</TrustSection>

			<TrustSection id="definitions" title="1. Definitions">
				<ul className={bullets}>
					<li><span className="font-medium text-foreground">Applicable Data Protection Law</span> means the privacy and data-protection law that applies to the processing under this DPA. It includes the UK GDPR, the Data Protection Act 2018, the Data (Use and Access) Act 2025 to the extent it amends UK data-protection law, the EU GDPR, and applicable national legislation that implements or supplements them.</li>
					<li><span className="font-medium text-foreground">Customer Data</span> means data submitted to the Services by or for Customer, or data that Customer directs Phaseo to process through the Services.</li>
					<li><span className="font-medium text-foreground">Customer Personal Data</span> means personal data contained in Customer Data that Phaseo processes on Customer's behalf.</li>
					<li><span className="font-medium text-foreground">AI Provider</span> means a third party that receives a request to run an AI model or related service.</li>
					<li><span className="font-medium text-foreground">Services</span> means the Phaseo services covered by the Agreement.</li>
					<li><span className="font-medium text-foreground">Subprocessor</span> means another processor engaged by Phaseo to process Customer Personal Data for the Services.</li>
					<li><span className="font-medium text-foreground">Controller</span>, <span className="font-medium text-foreground">Processor</span>, <span className="font-medium text-foreground">Data Subject</span>, <span className="font-medium text-foreground">Personal Data Breach</span>, and <span className="font-medium text-foreground">Process</span> have the meanings given by Applicable Data Protection Law.</li>
				</ul>
			</TrustSection>

			<TrustSection id="scope" title="2. Scope, roles, and instructions">
				<ol className={clauses}>
					<li>Customer is the Controller of Customer Personal Data and Phaseo is its Processor. If Customer is itself a Processor, Phaseo is Customer's Subprocessor and Customer confirms that its instructions are authorised by the relevant Controller.</li>
					<li>Phaseo will process Customer Personal Data only on Customer's documented instructions. The Agreement, this DPA, Customer's API requests, selected models and providers, routing rules, product settings, and written support requests are documented instructions. These instructions include transfers needed to provide the Services.</li>
					<li>If UK or EU law requires Phaseo to process Customer Personal Data without Customer's instruction, Phaseo will tell Customer before processing unless that law prohibits notice.</li>
					<li>Phaseo will tell Customer if it believes an instruction infringes Applicable Data Protection Law. Phaseo may suspend the affected processing until the parties resolve the issue.</li>
					<li>Annex 1 states the subject matter, duration, nature, purpose, personal-data types, Data Subject categories, and the parties' relevant rights and duties.</li>
					<li>Phaseo acts as an independent Controller where it determines its own purposes and means of processing, including account administration, billing, fraud prevention, legal compliance, and security of the Services. The <Link href="/privacy" className="text-foreground underline underline-offset-4">Privacy Policy</Link> applies to that processing. Phaseo will not treat gateway content as independent-controller data merely because it passes through the Services.</li>
				</ol>
			</TrustSection>

			<TrustSection id="customer" title="3. Customer's responsibilities">
				<ol className={clauses}>
					<li>Customer will comply with Applicable Data Protection Law, provide all required notices, and have a valid legal basis for its instructions and Customer Personal Data.</li>
					<li>Customer will not submit special-category data, criminal-offence data, full payment-card data, or other highly sensitive data unless the Agreement expressly permits it and Customer has assessed the selected settings and AI Providers.</li>
					<li>Customer is responsible for its AI Provider restrictions, retention and logging settings, credentials, and customer-directed destinations.</li>
					<li>Customer will limit access to the Services, protect its credentials, and notify Phaseo promptly if it suspects unauthorised access or unlawful processing.</li>
				</ol>
			</TrustSection>

			<TrustSection id="confidentiality" title="4. Confidentiality and security">
				<ol className={clauses}>
					<li>Phaseo will limit access to Customer Personal Data to people who need access to provide, secure, or support the Services or to comply with law.</li>
					<li>Anyone authorised by Phaseo to process Customer Personal Data must be bound by a contractual duty of confidentiality or an appropriate statutory duty.</li>
					<li>Phaseo will maintain the technical and organisational measures in Annex 2. Those measures must provide a level of security appropriate to the risk, taking account of the factors listed in Article 32 of the UK GDPR and EU GDPR.</li>
					<li>Phaseo may change individual measures as the Services develop, but will not materially reduce the overall protection of Customer Personal Data during the term of the Agreement.</li>
				</ol>
			</TrustSection>

			<TrustSection id="subprocessors" title="5. Subprocessors and AI Providers">
				<ol className={clauses}>
					<li>Customer gives general written authorisation for Phaseo to use the Subprocessors on the <Link href="/trust/subprocessors" className="text-foreground underline underline-offset-4">subprocessor schedule</Link>.</li>
					<li>Phaseo will give Customer at least 30 days' notice before a new Subprocessor begins processing Customer Personal Data. Notice will be sent to the account email address and recorded on the subprocessor schedule. If urgent security or service-continuity needs make advance notice impracticable, Phaseo will give notice as soon as practicable.</li>
					<li>Customer may object in writing during the notice period on reasonable data-protection grounds. The parties will try in good faith to resolve the objection. If they cannot, Phaseo may avoid the Subprocessor, offer a reasonable service change, or permit Customer to stop using the affected part of the Services under the Agreement.</li>
					<li>Phaseo will bind each Subprocessor by written terms that provide no less protection for Customer Personal Data than the applicable terms of this DPA. Phaseo remains responsible for the Subprocessor's performance to the extent required by Applicable Data Protection Law.</li>
					<li>An AI Provider used through a Phaseo-managed route is a Subprocessor where it processes Customer Personal Data on Phaseo's behalf. If Customer supplies its own provider credentials or has a direct agreement with the AI Provider, that provider is a customer-directed recipient unless the subprocessor schedule says otherwise. A provider's legal role depends on the actual processing and applicable law, not the label used in this DPA.</li>
					<li>Customer instructs Phaseo to disclose Customer Data to the AI Providers allowed by Customer's routing configuration. Customer may use available provider restrictions where provider identity, location, retention, or training policy matters.</li>
				</ol>
			</TrustSection>

			<TrustSection id="assistance" title="6. Assistance and regulatory duties">
				<ol className={clauses}>
					<li>Taking account of the nature of the processing, Phaseo will use appropriate technical and organisational measures to help Customer respond to requests made by Data Subjects under Applicable Data Protection Law.</li>
					<li>If Phaseo receives a request about Customer Personal Data directly from a Data Subject, Phaseo will refer the request to Customer. Phaseo will not respond on Customer's behalf unless Customer instructs it to do so or law requires a response.</li>
					<li>Taking account of the nature of processing and information available to Phaseo, Phaseo will help Customer meet its obligations concerning security, Personal Data Breach notifications, data-protection impact assessments, and prior consultation with a supervisory authority.</li>
					<li>Phaseo will maintain records and cooperate with supervisory authorities where Applicable Data Protection Law requires it to do so.</li>
					<li>If Customer asks for substantial assistance beyond standard product features, Phaseo may charge reasonable, agreed costs unless the work is needed because Phaseo breached this DPA.</li>
				</ol>
			</TrustSection>

			<TrustSection id="breach" title="7. Personal Data Breach">
				<ol className={clauses}>
					<li>Phaseo will notify Customer without undue delay after becoming aware of a Personal Data Breach affecting Customer Personal Data.</li>
					<li>To the extent known at the time, the notice will describe the nature of the breach, the categories and approximate number of affected Data Subjects and records, likely consequences, measures taken or proposed, and a contact for further information. Phaseo may provide this information in stages.</li>
					<li>Phaseo will take appropriate steps to contain, investigate, mitigate, and remediate the breach. It will provide the information and assistance Customer reasonably needs to make any notification required by law.</li>
					<li>Phaseo's notice is not an admission of fault or liability. Customer remains responsible for deciding whether it must notify a supervisory authority or affected Data Subjects.</li>
				</ol>
			</TrustSection>

			<TrustSection id="transfers" title="8. International transfers">
				<ol className={clauses}>
					<li>Phaseo will not make a restricted transfer of Customer Personal Data except on Customer's documented instructions and in compliance with Applicable Data Protection Law.</li>
					<li>The parties may rely on an applicable adequacy decision or regulation. Where that is unavailable, they will enter into and complete the European Commission's 2021 Standard Contractual Clauses for international transfers, the UK International Data Transfer Agreement, the UK Addendum to those EU clauses, or another valid safeguard.</li>
					<li>Where a transfer safeguard requires a transfer risk assessment or UK data protection test, Phaseo will provide information reasonably available to it and implement any supplementary measure agreed by the parties.</li>
					<li>If a transfer mechanism no longer provides a lawful basis for the transfer, the parties will adopt another lawful mechanism or stop the affected processing.</li>
					<li className={reviewText}>Before execution, Annex 4 must identify the exporter and importer, relevant SCC module, governing law, supervisory authority, optional clauses, UK mechanism, and processing locations for any transfer not covered by adequacy.</li>
				</ol>
			</TrustSection>

			<TrustSection id="deletion" title="9. Return and deletion">
				<ol className={clauses}>
					<li>Customer may retrieve or delete supported Customer Data using available product controls during the term of the Agreement.</li>
					<li>At the end of the Services, Phaseo will, at Customer's choice, return or delete Customer Personal Data and delete existing copies unless applicable law requires retention. Customer must communicate its choice before termination or within 30 days afterward. If Customer makes no choice, Phaseo will delete the data.</li>
					<li>Phaseo will delete Customer Personal Data from active systems without undue delay. The intended contractual deadline is 30 days after the applicable instruction or termination date, but Phaseo will not offer that deadline in an execution copy until the deletion workflow has been verified. Copies in backups will remain protected and isolated from ordinary use until deleted through the backup cycle.</li>
					<li className={reviewText}>The production Supabase project currently has seven days of daily database restore points and point-in-time recovery is disabled. Phaseo must recheck the backup window before execution and verify deletion across its database, object storage, caches, and other active systems before making the intended 30-day commitment binding.</li>
					<li>Phaseo's deletion does not remove data held by an independent Controller or customer-directed recipient. Customer must direct those parties separately.</li>
				</ol>
			</TrustSection>

			<TrustSection id="audit" title="10. Information and audits">
				<ol className={clauses}>
					<li>Phaseo will provide information reasonably necessary to show compliance with this DPA and Article 28, subject to duties of confidentiality and security.</li>
					<li>Customer will normally review Phaseo's current trust materials and written responses before requesting an inspection. This does not limit an audit required by Applicable Data Protection Law or a supervisory authority.</li>
					<li>Customer may audit Phaseo once in any 12-month period and after a Personal Data Breach or credible evidence of material non-compliance. Customer must give at least 30 days' notice unless the matter is urgent or a supervisory authority requires shorter notice.</li>
					<li>An audit must be conducted by Customer or an independent qualified auditor bound by confidentiality. It must avoid access to other customers' data, source code, and systems unrelated to the processing. Phaseo will contribute to the audit and may provide equivalent evidence where direct access would create a security risk.</li>
					<li>Customer will bear its audit costs and Phaseo's reasonable costs unless the audit finds a material breach of this DPA by Phaseo.</li>
					<li>Phaseo does not currently have a SOC 2 report, ISO 27001 certificate, or independent penetration-test report.</li>
				</ol>
			</TrustSection>

			<TrustSection id="term" title="11. Term, liability, and general terms">
				<ol className={clauses}>
					<li>This DPA remains in force while Phaseo processes Customer Personal Data under the Agreement.</li>
					<li>Nothing in this DPA relieves either party of duties or liability imposed directly on it by Applicable Data Protection Law.</li>
					<li>The liability limits and exclusions in the Agreement apply to this DPA to the extent permitted by law.</li>
					<li>The Agreement's governing-law and dispute terms apply unless Applicable Data Protection Law or an incorporated transfer mechanism requires otherwise.</li>
				</ol>
			</TrustSection>

			<TrustSection id="annex-1" title="Annex 1: Details of processing">
				<TrustTable>
					<table className="w-full min-w-[720px] text-left"><tbody className="align-top">
						<tr className="border-b border-border"><th className="w-56 py-4 pr-4 font-medium text-foreground">Subject matter</th><td className="py-4">Providing the dashboard, API gateway, model routing, usage and billing records, configured logging, optional data contribution, observability exports, notifications, and support covered by the Agreement.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Duration</th><td className="py-4">The term of the Agreement and the deletion period in Section 9.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Nature and purpose</th><td className="py-4">Receive, transmit, route, secure, cache, record, retrieve, classify when Customer opts in, export when Customer configures a destination, support, return, and delete data to provide and secure the Services.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Frequency</th><td className="py-4">Continuous or intermittent, depending on Customer's use of the Services.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Data Subjects</th><td className="py-4">Customer's users, personnel, contractors, end users, customers, suppliers, and other people whose data Customer submits through the Services.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Personal-data types</th><td className="py-4">Prompt, message, document, image, audio, video, tool, and model-output content; identifiers; account and workspace references; device, IP, coarse location, authentication, routing, provider, usage, cost, latency, error, security, and support metadata.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Sensitive data</th><td className="py-4">The Services do not require special-category or criminal-offence data. Phaseo cannot reliably determine whether Customer has included such data in free-form content. The restriction in Section 3 applies.</td></tr>
						<tr className="border-b border-border"><th className="py-4 pr-4 font-medium text-foreground">Retention</th><td className="py-4">Response cache: five minutes by default and no more than 24 hours when configured. Optional private I/O logs: 90, 180, or 365 days. Optional data contributions: no more than 30 days. Other Customer Personal Data follows Section 9 and the Agreement.</td></tr>
						<tr><th className="py-4 pr-4 font-medium text-foreground">Controller rights and duties</th><td className="py-4">Customer may give lawful instructions, configure the Services, exercise audit and assistance rights under this DPA, and require return or deletion. Customer must meet the obligations in Section 3.</td></tr>
					</tbody></table>
				</TrustTable>
			</TrustSection>

			<TrustSection id="annex-2" title="Annex 2: Technical and organisational measures">
				<ul className={bullets}>
					<li>HTTPS for public service delivery and connections from Phaseo to AI Providers.</li>
					<li>AES-256-GCM encryption before storage for bring-your-own-provider credentials. Supported webhook and notification secrets also use encrypted storage.</li>
					<li>One-way keyed or password-based derivation for API, management, and OAuth secrets.</li>
					<li>Workspace roles, database access policies, scoped API and OAuth permissions, consent screens, and revocation controls.</li>
					<li>Rate limits on sensitive authentication and realtime routes, plus structured validation at request and configuration boundaries.</li>
					<li>Exclusion of raw gateway content from the primary request database and analytics, subject to the response-cache, I/O-logging, data-contribution, AI Provider, and customer-directed destination paths described in the <Link href="/trust/security" className="text-foreground underline underline-offset-4">security whitepaper</Link>.</li>
					<li>Managed infrastructure logs, request metadata, provider-health signals, and a public incident status page.</li>
					<li>Version control, dependency lockfiles, automated linting, type checking, targeted tests, and private vulnerability reporting.</li>
				</ul>
				<p>These measures are self-attested. Phaseo does not claim an independently audited security programme, tested disaster-recovery programme, or formal certification.</p>
			</TrustSection>

			<TrustSection id="annex-3" title="Annex 3: Subprocessors">
				<p>The dated <Link href="/trust/subprocessors" className="text-foreground underline underline-offset-4">subprocessor schedule</Link> forms Annex 3 when this DPA is executed. Section 5 governs additions and replacements.</p>
				<p className={reviewText}>Phaseo has completed a preliminary classification of the active Phaseo-managed AI Providers. Before execution, Phaseo must complete the outstanding processor-contract, account-setting, transfer, and retention checks identified in the schedule, and must remove or restrict any managed provider that is not approved for Customer Personal Data. Customer-directed providers used under Customer's own credentials or agreement remain identified separately.</p>
			</TrustSection>

			<TrustSection id="annex-4" title="Annex 4: Restricted-transfer terms">
				<p className={reviewText}>Complete this annex before execution if Customer Personal Data will be transferred without an applicable adequacy decision or regulation. Identify the transfer mechanism, exporter and importer, countries, categories of data and Data Subjects, frequency, purpose, retention, competent supervisory authority, governing law, optional SCC clauses, and any supplementary measures.</p>
			</TrustSection>

			<TrustSection id="sources" title="Drafting basis">
				<p>This draft follows the current processor-contract checklist published by the UK Information Commissioner's Office and the European Commission's Article 28 and international-transfer materials. The ICO notes that parts of its processor-contract guidance are being reviewed following the Data (Use and Access) Act 2025. Qualified counsel should check the final execution copy against the law and guidance then in force.</p>
				<ul className={bullets}>
					<li><a href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/what-needs-to-be-included-in-the-contract/" className="text-foreground underline underline-offset-4">ICO: required controller-processor contract terms</a></li>
					<li><a href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/" className="text-foreground underline underline-offset-4">ICO: international transfers</a></li>
					<li><a href="https://commission.europa.eu/publications/standard-contractual-clauses-controllers-and-processors-eueea_en" className="text-foreground underline underline-offset-4">European Commission: controller-processor standard clauses</a></li>
				</ul>
			</TrustSection>

			<TrustSection id="signature" title="Signature block">
				<TrustTable>
					<table className="w-full min-w-[640px] text-left"><thead><tr className="border-b border-border"><th className="py-3 pr-8 font-medium text-foreground">Customer</th><th className="py-3 font-medium text-foreground">Daniel Butler, trading as Phaseo</th></tr></thead><tbody><tr><td className="py-4 pr-8">Name: [insert]<br />Title: [insert]<br />Signature: [insert]<br />Date: [insert]</td><td className="py-4">Name: Daniel Butler<br />Capacity: Sole trader<br />Signature: [insert]<br />Date: [insert]</td></tr></tbody></table>
				</TrustTable>
			</TrustSection>
		</TrustDocument>
	);
}
