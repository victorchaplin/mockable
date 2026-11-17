# Spec Delta

## Purpose

Turns a single natural-language prompt into five layout-divergent, self-contained HTML/CSS entry-screen proposals, presented as live previews the user compares before picking one to become a project.

## ADDED Requirements

### Requirement: Generate five layout-divergent proposals from one prompt
The system SHALL generate exactly five distinct proposals for the entry screen of the app described by the user's prompt, with variants differing primarily in page layout while all representing the same described app.

#### Scenario: Prompt produces five proposals
- **WHEN** the user submits a natural-language app description
- **THEN** the system generates five proposals, each a valid web page depicting the described app

#### Scenario: Variants differ by layout archetype
- **WHEN** the five proposals are generated
- **THEN** each follows a different layout archetype (e.g. sidebar shell, top nav with cards, dashboard grid, wizard/stepper, master-detail)

### Requirement: Proposals are self-contained testable pages
Each proposal SHALL be a single self-contained HTML page with inline CSS, no external dependencies, no JavaScript, and in-flow links that reference other mock pages by name.

#### Scenario: Proposal renders without external resources
- **WHEN** a proposal is rendered in a preview
- **THEN** it displays correctly with no network requests beyond the app itself

### Requirement: Proposals are presented as live previews for comparison
The system SHALL present the five proposals simultaneously as scaled, rendered live previews the user can inspect and compare before choosing.

#### Scenario: Pick grid shows live previews
- **WHEN** proposal generation completes
- **THEN** the user sees five live, rendered previews side by side and can interact with each before picking

### Requirement: Picking a proposal creates the project
The system SHALL create a project from the picked proposal, using it as the entry page and recording the chosen layout archetype and the original prompt, then take the user to the refinement editor.

#### Scenario: Pick starts refinement
- **WHEN** the user selects one of the five proposals
- **THEN** a project is created with the picked proposal as its entry page and the editor opens for that project

### Requirement: Generation failures show actionable errors
The system SHALL report generation failures with a message that tells the user what failed and what to do next.

#### Scenario: Invalid LLM key
- **WHEN** proposal generation is requested and the LLM rejects the configured key
- **THEN** the user sees an error identifying the key problem and is directed to settings
