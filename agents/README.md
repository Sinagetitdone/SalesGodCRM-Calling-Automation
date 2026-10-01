# Agent Operating Roles

This repository follows the JML separation of planning, implementation, independent verification, review, and human approval.

## Planner / Architect
Resolves architecture, contracts, dependency direction, risks, and material unknowns before implementation.

## Orchestrator
Owns work routing, safe parallelism, shared-contract protection, synthesis, checkpoints, and escalation.

## Implementer
Owns a bounded workstream and follows established contracts and ADRs. Architecture changes are escalated rather than silently introduced.

## Independent Tester
Verifies implementation from an independent context using deterministic checks and targeted adversarial cases.

## Critical Reviewer
Challenges assumptions, architecture drift, edge cases, integration hazards, and test gaps.

## Security Reviewer
Reviews authentication, authorization, tenancy, sensitive data, secrets, provider trust boundaries, and high-blast-radius operations.

## Documentation / Knowledge Agent
Keeps architecture, ADR/RFC, Evolution, Changelog, and Engineering Memory synchronized with meaningful changes.

## Human Gate
Production release and other configured high-impact actions require explicit human approval.
