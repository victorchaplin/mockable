# Spec Delta

## Purpose

Publishes a project's multi-page flow as a public, interactive prototype anyone with the link can click through — no login — and lets the owner revoke access.

## ADDED Requirements

### Requirement: Create a public share link
The system SHALL produce a public URL for a project's flow when the user shares it, without requiring any login for viewers.

#### Scenario: Sharing produces a copyable link
- **WHEN** the user clicks Share on a project
- **THEN** a public URL is created and shown so the user can copy it

### Requirement: Interactive flow player for viewers
Opening a share link SHALL render the flow's entry page and let the viewer click through all pages of the flow via in-flow links, without logging in.

#### Scenario: Teammate walks the flow
- **WHEN** a person opens the share link
- **THEN** the entry page renders and in-flow links navigate between the flow's pages

### Requirement: Shared link serves the current state of the flow
The shared prototype SHALL always serve the project's current pages, with no snapshot or version selection.

#### Scenario: Edits are reflected
- **WHEN** the owner refines the project after sharing
- **THEN** opening the share link shows the updated pages

### Requirement: Revoking sharing
The system SHALL let the user revoke a project's share link, after which the URL no longer serves the flow.

#### Scenario: Revoked link stops working
- **WHEN** the user revokes sharing for a project
- **THEN** opening the previous share URL shows that the prototype is no longer available
