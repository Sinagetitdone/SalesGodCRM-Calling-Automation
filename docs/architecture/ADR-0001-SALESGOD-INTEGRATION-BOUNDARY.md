# ADR-0001: SalesGodCRM Integration Boundary

- Status: Proposed
- Date: 2026-09-29

## Context

The product requirement is to automate outbound calling while using SalesGodCRM's native AI caller.

The repository must not assume undocumented provider APIs, payloads, authentication mechanisms, or browser automation.

The user supplied a SalesGodCRM webhook URL and credential for this account. That is configuration evidence, but it does not document the webhook payload or prove that the endpoint initiates an outbound AI call.

## Decision

Treat SalesGodCRM as an external provider behind a dedicated adapter.

The application domain depends only on a normalized provider interface. Provider-specific identifiers, payloads, authentication, retries, webhook verification, and error mapping remain inside the adapter.

The supplied webhook URL is supported by a generic authenticated webhook client, but live call initiation remains blocked until the provider's call-initiation payload and event contract are verified.

## Evidence

SalesGodCRM publicly describes AI Sales Agents as able to follow up, qualify leads, handle objections, and book appointments. Its public compliance material also describes permission-based communications and DNC handling. These public pages do not establish the request schema for the supplied webhook or a documented outbound call-initiation API.

## Acceptance evidence still required

- Official SalesGodCRM call-initiation/integration documentation, or
- Provider confirmation of the supported automation mechanism and exact payload/event contract for this account.
