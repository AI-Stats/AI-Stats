# Phaseo-managed AI provider role register

Reviewed: 30 August 2026

This register records the legal-role review for AI providers that can receive a
request through a Phaseo-managed production credential. It is working evidence
for the public subprocessor schedule and DPA. It is not a legal opinion or proof
that a provider-specific setting has been enabled.

## Scope and method

A provider is in scope only where both conditions were met on the review date:

1. Phaseo's public production provider index reported at least one active
   Gateway model for the provider family.
2. The production Gateway Worker had a corresponding Phaseo-managed credential
   binding.

A credential without an active route is not current subprocessing. An active
route without a Phaseo-managed credential is treated as BYOK-only or as a
configuration gap until production evidence shows otherwise.

The role is determined by processing activity, not by the model developer's
name. For example, a Claude request sent through Amazon Bedrock makes AWS the
direct Phaseo subprocessor. Anthropic may be an onward AWS subprocessor under
AWS's contract rather than a separate direct Phaseo subprocessor.

For managed inference, Phaseo determines the service purpose on the customer's
instructions. The API provider is therefore intended to act as Phaseo's
subprocessor. If the provider uses request content for its own training,
research, advertising, or another independent purpose, it may instead act as a
controller for that additional processing. Such processing is not made safe by
calling the provider a subprocessor.

## A. Processor terms located

These providers publish a current processor agreement or DPA that covers the
relevant business or cloud service. Phaseo must still retain the accepted terms,
confirm the contracting entity and account configuration, and record the
applicable transfer mechanism.

| Direct provider | Managed route families | Preliminary role | Remaining check |
| --- | --- | --- | --- |
| Amazon Web Services | Amazon Bedrock; Anthropic on AWS | Subprocessor for the Bedrock service | Retain the AWS DPA and confirm the applicable Bedrock region and model-provider terms |
| Anthropic | Anthropic global and US | Subprocessor for direct API inference | Retain the automatically incorporated commercial DPA and current subprocessor list |
| Google Cloud | Vertex AI global and EU | Subprocessor under the Cloud Data Processing Addendum | Confirm the Phaseo billing entity, selected locations, abuse-monitoring configuration, and SCC module |
| Groq | GroqCloud | Subprocessor under the GroqCloud DPA | Record the contracting party, processing locations, and current subprocessor list |
| Mistral AI | Mistral global and EU | Processor for inference; controller for the limited own-purpose processing described in its DPA | Verify that model-training opt-out applies to the Phaseo account and document moderation retention |
| OpenAI | OpenAI global and EU | Subprocessor for API inference | Retain the incorporated DPA, confirm the contracting entity and regional-project configuration, and monitor the subprocessor list |

This category means suitable processor terms were located. It is not a final
approval of every model, feature, region, or special-category-data use case.

## B. Intended subprocessors pending contract evidence

The current catalogue records no default prompt training, but the evidence set
does not establish an incorporated Article 28 processor agreement for Phaseo's
account. These providers should remain provisional until Phaseo obtains or
confirms a DPA, transfer terms, deletion assistance, incident notice, and
subprocessor controls.

- AionLabs
- AkashML
- Alibaba Cloud
- AtlasCloud
- Baseten
- BytePlus
- Cerebras
- CrofAI
- DeepInfra
- GMICloud
- Meta Model API
- Morph
- Nebius Token Factory
- NovitaAI
- SiliconFlow
- Venice
- Wafer
- Xiaomi
- z.AI

Zero-retention or no-training product copy does not replace a processor
contract. Until the contract check is complete, these routes should not be
presented as approved for unrestricted Customer Personal Data.

## C. Restricted pending data-use resolution

The current evidence records training, an opt-out-dependent policy, or an
unknown policy. These routes should not receive Customer Personal Data through
a general Phaseo-managed pool unless Phaseo verifies a no-training configuration
and adequate processor terms. The safe alternatives are to disable the managed
route, make it customer-directed/BYOK, or restrict it to data that the customer
has knowingly authorized for that provider's stated purposes.

- Arcee AI — training opt-out recorded
- Cohere — training opt-out recorded
- DeepSeek — provider terms permit model improvement/training
- ElevenLabs — training opt-out recorded
- Fireworks AI — training position not confirmed in the evidence set
- Google AI Studio — terms permit use for product and model improvement in relevant circumstances
- MiniMax — provider terms permit model improvement/training
- Moonshot AI — provider terms permit model improvement/training
- Poolside — training opt-out recorded
- Sakana AI — training opt-out recorded
- Together AI — training opt-out recorded
- Voyage AI — training opt-out recorded
- Weights & Biases — provider terms permit model improvement/training

An account-level opt-out can move a provider from this category only after the
setting and its contractual effect have been recorded.

## Customer-owned credentials

Where the customer supplies the provider credentials or contracts directly with
the provider, Phaseo sends the request on the customer's documented instruction.
The provider is then normally a customer-directed recipient or the customer's
own processor. It is not a Phaseo subprocessor merely because Phaseo transports
the request. Phaseo remains responsible for its own handling of the request.

## Operational decisions required

1. Preserve copies or acceptance evidence for the six located processor
   frameworks and complete their entity, region, transfer, and retention fields.
2. Obtain processor terms for every provider in category B before describing it
   as approved for Customer Personal Data.
3. Disable, convert to BYOK, or technically segregate category C providers until
   their training and own-purpose processing has been resolved.
4. Make the production provider allowlist derive from this approval register so
   a credential or catalogue row cannot enable a legally unreviewed managed
   route by itself.
5. Review the register whenever a managed credential, route, provider term,
   account setting, or processing region changes, and at least quarterly.

## Principal processor sources checked

- [AWS GDPR resources and Data Processing Addendum](https://aws.amazon.com/compliance/gdpr-center/)
  and [AWS Service Terms](https://aws.amazon.com/service-terms/)
- [Anthropic's automatically incorporated commercial DPA](https://privacy.anthropic.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa)
- [Google Cloud Terms](https://cloud.google.com/terms/) and
  [Cloud Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum)
- [Groq Services Agreement](https://console.groq.com/docs/legal/services-agreement)
  and [GroqCloud Customer Data Processing Addendum](https://console.groq.com/docs/legal/customer-data-processing-addendum)
- [Mistral AI Commercial Terms](https://legal.mistral.ai/terms/commercial-terms-of-service)
  and [Data Processing Addendum](https://legal.mistral.ai/terms/data-processing-addendum)
- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/)
  and [Data Processing Addendum](https://openai.com/policies/data-processing-addendum/)

Provider-specific data-use and terms sources for the provisional and restricted
groups are maintained in the corresponding
`packages/data/catalog/src/data/api_providers/*/api_provider.json` records.
