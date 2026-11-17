# Spec Delta

## Purpose

Home for managing mock projects: list, open, rename, and delete the flows the user is designing, with visibility of which projects are shared.

## ADDED Requirements

### Requirement: Projects home lists all projects
The system SHALL show all existing mock projects in a list with name, last-updated time, and a shared indicator, and allow opening any of them.

#### Scenario: Open an existing project
- **WHEN** the user clicks a project in the list
- **THEN** the editor opens for that project

#### Scenario: Shared projects are marked
- **WHEN** a project has an active share link
- **THEN** its entry in the projects list shows a shared indicator

### Requirement: Starting a new mock
The projects home SHALL provide a way to start a new mock, which begins the prompt-to-proposals flow.

#### Scenario: New mock from home
- **WHEN** the user chooses to create a new mock
- **THEN** the app presents the prompt input that starts proposal generation

### Requirement: Rename a project
The system SHALL let the user rename a project from the projects home, and the new name SHALL appear everywhere the project is listed.

#### Scenario: Rename reflects in the list
- **WHEN** the user renames a project
- **THEN** the projects list and the editor show the new name

### Requirement: Delete a project with confirmation
The system SHALL require an explicit confirmation before deleting a project, and deletion SHALL remove the project's pages and revoke its share link.

#### Scenario: Confirmed deletion cleans up
- **WHEN** the user confirms deletion of a project
- **THEN** the project disappears from the list, its pages are removed, and its share URL (if any) stops serving the flow
