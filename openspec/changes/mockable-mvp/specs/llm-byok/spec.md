# Spec Delta

## Purpose

Lets each user supply their own LLM API key in a settings UI; the key is stored only in their browser, sent per request, used transiently by a provider-agnostic server-side proxy, and never persisted or logged server-side.

## ADDED Requirements

### Requirement: Configure provider, model, and API key in settings
The system SHALL provide a settings UI where the user enters an LLM provider, a model name, and an API key, and SHALL store these only in the user's browser.

#### Scenario: Saving settings enables LLM features
- **WHEN** the user saves a provider, model, and API key in settings
- **THEN** all subsequent generation and refinement requests use those settings

#### Scenario: Settings persist across visits
- **WHEN** the user reloads the app in the same browser
- **THEN** their saved provider, model, and key are still configured

### Requirement: API keys are never persisted server-side
The system SHALL NOT store, log, or transmit the user's API key anywhere except as a transient per-request credential to the chosen LLM provider.

#### Scenario: Key lives only in the browser
- **WHEN** a user's key is configured
- **THEN** no server-side storage or logs contain the key

### Requirement: The server runs without any LLM key
The application server SHALL start and serve the workspace, editor, and shared prototypes without any LLM credentials configured server-side.

#### Scenario: Fresh deployment without LLM credentials
- **WHEN** the app runs with no LLM key in its environment
- **THEN** all non-LLM features work and LLM features prompt the user to configure their key in settings

### Requirement: Key-related failures produce clear guidance
The system SHALL surface LLM failures caused by the key (invalid, expired, or quota-exhausted) as clear errors that direct the user to settings.

#### Scenario: Expired key is reported
- **WHEN** an LLM request fails because the key is invalid or expired
- **THEN** the user sees an error naming the key as the cause and a way to open settings

### Requirement: Switching providers requires no server changes
The system SHALL support changing the provider and model from the settings UI at runtime, with no server restart or redeploy.

#### Scenario: Provider switch mid-session
- **WHEN** the user changes the provider and model in settings
- **THEN** the next LLM request uses the new provider and model
