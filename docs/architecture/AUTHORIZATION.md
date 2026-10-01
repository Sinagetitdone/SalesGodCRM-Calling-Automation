# Authorization

## Status

Architecture gate: OPEN.

The repository does not yet have an application identity model, user model, or tenant model. No authorization implementation should be inferred from this document.

## Required decision

Before protected application behavior is implemented, explicitly choose one JML-supported model:

- RBAC
- Permission-Based
- Hybrid Roles + Permissions
- Hybrid + attribute/relationship/resource policies

The decision must define role-to-permission mapping, multiple-role behavior, scopes, ownership, hierarchy, deny semantics, tenant boundaries, resource-level policy, and audit rules.

Backend enforcement is authoritative and deny-by-default.

## Provisional permission names

These are design candidates only:

- campaign.create
- campaign.read
- campaign.update
- campaign.launch
- campaign.stop
- contact.import
- contact.read
- contact.suppress
- call.read
- transcript.read
- recording.read
- reporting.read
- integration.manage
