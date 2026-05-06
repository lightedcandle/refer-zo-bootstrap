# Alliance Vocabulary

This vocabulary routes Alliance conversations through Script Factory terms before implementation.

## Terms

### Invisible App

- Category: architecture
- Meaning: The Alliance experience where the user's phone, SMS, email, chat links, and personal pages act as the primary app surface.
- Routes to: conversation-intake, transport-layer, personal-link-system
- Source: alliance_invisible_app_architecture.md

### Conversation Intake

- Category: script-factory
- Meaning: Every user message, planning prompt, or ministry request is converted into a structured intake record before work proceeds.
- Routes to: script-factory-intake, capability-engine, audit-log
- Source: alliance_invisible_app_architecture.md

### Capability

- Category: workflow
- Meaning: A bounded app action such as collecting email, creating an appointment, confirming attendance, sending a giving link, or escalating to a leader.
- Routes to: capability-registry, supabase-edge-function, zo-follow-up
- Source: alliance_invisible_app_architecture.md

### Capability Engine

- Category: workflow
- Meaning: The governed layer that selects and executes approved capabilities from classified conversation intent.
- Routes to: intent-classifier, capability-registry, policy-guard
- Source: alliance_invisible_app_architecture.md

### Transport Adapter

- Category: integration
- Meaning: A provider-neutral wrapper for inbound and outbound messages across SMS, email, web chat, WhatsApp, and push.
- Routes to: android-bridge, email, web-chat
- Source: alliance_invisible_app_architecture.md

### Android Bridge

- Category: integration
- Meaning: A low-cost provisional SMS provider that forwards phone messages into the Alliance transport layer.
- Routes to: transport-adapter, sms-inbound-webhook
- Source: alliance_invisible_app_architecture.md

### Personal Link

- Category: identity
- Meaning: A signed, non-raw-ID URL that lets a user continue a chat, confirm attendance, upload, give, or read a message.
- Routes to: token-system, dynamic-chat-page, security-policy
- Source: alliance_invisible_app_architecture.md

### Progressive Identity

- Category: identity
- Meaning: The user is recognized and completed over time through natural conversation rather than a large registration form.
- Routes to: users, profiles, conversation-thread
- Source: alliance_invisible_app_architecture.md

### Journey

- Category: ministry-model
- Meaning: A trackable ministry progression such as new visitor, service attendance, training, prayer follow-up, or giving follow-up.
- Routes to: journey-system, reminders, follow-up-tasks
- Source: alliance_invisible_app_architecture.md

### Church Journey

- Category: ministry-model
- Meaning: The church progression from Visiting Church to Fellowship Church to Branch Church.
- Routes to: organizations, fellowship-clusters, branch-covering
- Source: The Alliance Structure

### Seasonal Rhythm

- Category: ministry-model
- Meaning: The Alliance year cycle of outreach, fellowship, conference, assimilation, review, and relaunch.
- Routes to: calendar, events, reminders, board-review
- Source: The Alliance Rhythm

### Gift Flow

- Category: ministry-model
- Meaning: The movement of spiritual gifts, practical skills, mentorship, labor, and resources across churches for the strengthening of the body.
- Routes to: member-gifts, resource-exchange, training
- Source: The Alliance Gifts

### Leader Escalation

- Category: safety
- Meaning: A guarded handoff from AI or automation to an approved leader for urgent prayer, counseling, crisis language, onboarding, or leadership matters.
- Routes to: follow-up-tasks, policy-guard, notification
- Source: alliance_invisible_app_architecture.md

### STOP Policy

- Category: safety
- Meaning: Transport-level unsubscribe and communication consent handling for SMS and future channels.
- Routes to: transport-layer, message-policy, audit-log
- Source: alliance_invisible_app_architecture.md

