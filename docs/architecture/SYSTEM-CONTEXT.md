# System Context

## Intent

Automate a permission-based outbound calling workflow while using SalesGodCRM's native AI caller as the conversational and calling provider.

## Target workflow

Contact source -> eligibility gate -> campaign enrollment -> SalesGod AI caller -> voicemail or human conversation -> qualification/outcome -> appointment, callback, or DNC -> audit/reporting.

## External system

SalesGodCRM public product material states that its AI Sales Agents can follow up with leads, answer common questions, handle objections, qualify prospects, book appointments, move leads through a sales pipeline, and trigger automations.

The exact supported integration mechanism for this repository is not yet established.

## Integration constraint

The implementation must use a provider-supported integration mechanism. UI scraping, browser scripting, undocumented endpoints, or automated access that conflicts with SalesGodCRM terms are prohibited.

## Ownership boundary

Our application is intended to own:

- campaign definitions
- contact eligibility state
- suppression state
- campaign enrollment state
- normalized call state
- business qualification rules
- audit records
- reporting projections

SalesGodCRM is intended to own:

- provider-side calling
- provider-side AI conversation execution
- provider-side telephony execution
- provider-specific artifacts

These ownership boundaries remain subject to provider integration discovery.

## Open architecture questions

- Supported SalesGodCRM API, connector, or workflow mechanism.
- Authentication model for that mechanism.
- Event/webhook model and signatures.
- Call lifecycle payloads and identifiers.
- How voicemail detection is exposed.
- How AI instructions and approved knowledge are configured programmatically.
- Appointment and calendar integration boundary.
- Transcript and recording availability and retention controls.
- Provider rate limits and retry semantics.
- Provider sandbox or test capability.

These are explicit discovery items, not assumptions.
