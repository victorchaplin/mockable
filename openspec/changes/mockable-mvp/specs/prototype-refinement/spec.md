# Spec Delta

## Purpose

Refines a picked proposal into a multi-page, clickable flow: a chat pane with a live preview side by side, natural-language edits, direct HTML/CSS editing, and organic growth of the flow as pages are added.

## ADDED Requirements

### Requirement: Chat and live preview side by side
The editor SHALL show a chat pane and a live preview of the current mock page side by side, and the preview SHALL reflect the current saved state of the page.

#### Scenario: Edit updates the preview
- **WHEN** a page's content changes (via chat or direct edit)
- **THEN** the live preview re-renders the updated page

### Requirement: Natural-language page refinement
The system SHALL update the current page's HTML based on a user's natural-language request, keeping the page self-contained, and show the result in the preview.

#### Scenario: Requested change is applied
- **WHEN** the user sends a chat message describing a change to the current page
- **THEN** the page is updated to match the request and the preview refreshes

### Requirement: Direct HTML/CSS editing
The editor SHALL provide a code panel where the user can view and edit the current page's HTML/CSS and save it directly.

#### Scenario: Manual code edit persists
- **WHEN** the user edits the page's HTML in the code panel and saves
- **THEN** the page content is updated and the preview re-renders

### Requirement: Multi-page flow navigation
A project SHALL support multiple named pages with a single entry page, and the preview SHALL navigate between pages when the user clicks in-flow links.

#### Scenario: In-flow link navigates
- **WHEN** the user clicks an in-flow link inside the preview
- **THEN** the preview renders the referenced page

#### Scenario: Page tabs
- **WHEN** a project has more than one page
- **THEN** the editor lists all pages as selectable tabs, with the entry page marked

### Requirement: Growing the flow with new pages
The system SHALL create new pages when requested in chat, generated to be visually consistent with the project's picked layout archetype, and add them to the flow with resolving links.

#### Scenario: New page requested in chat
- **WHEN** the user asks in chat for a new page (e.g. "add a settings page")
- **THEN** a new page is created consistent with the project's layout archetype and appears as a tab

#### Scenario: Clicking a link to a missing page offers creation
- **WHEN** the user clicks an in-flow link in the preview that references a page that does not exist yet
- **THEN** the editor offers to create that page, and accepting creates it in the project's layout archetype
