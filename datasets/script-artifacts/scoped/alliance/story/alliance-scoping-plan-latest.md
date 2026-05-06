# Alliance Scoping Plan

Scoping converts the Alliance story into appable programs: each vision point becomes a trackable workflow, role, record, automation, or cadence inside the Hub.

## Source Documents

- The Alliance Hub: 6789 chars, sha256 789cbbd590a70f248c6aff1d90ac8d7a3eff0d289021b1e8e6c248fc80ee85e8
- The Alliance Structure: 4784 chars, sha256 f904efc268c3b9082e5f5e647c3836c08b3a33ac45f2e24ed7427ea700559d12
- The Alliance Rhythm: 3487 chars, sha256 8904db2f55c59b4df2bbe1a3f4e3bfaec13e49ea5192f209aa22c6127746f3dc
- The Alliance Leadership: 3592 chars, sha256 e3ce5519f4a53daab053e821568bec464387cc38c84bdb12a8f5383b3a43d905
- The Alliance Members: 3259 chars, sha256 37ec5b02f0ab32626f975ad2d1ca23d5c06fb5a5802d2da462d1bb16c62801ff
- The Alliance Gifts: 3259 chars, sha256 08ac67025ceeca5ae653bdc521a48f1859b70d37b9485349a06084200a79201c
- alliance_invisible_app_architecture.md: 11123 chars, sha256 c4b839bb59d0ab38c5afc6e12b2f8c8cdbbd6543b53275a5775a9d1e6d2e49d7

## Appable Programs

### Church Journey Program

- Outcome: Track every church from visitor to fellowship church to branch church.
- App module: Organizations
- Source docs: The Alliance Structure, The alliance Hub
- Operations: Create church profile and region; Assign branch pastor or relational covering; Record current journey stage; Schedule follow-up visits and invitations; Review readiness for next stage
- Records: organization, relationship, journey_stage, follow_up, readiness_review
- Automations: welcome church, stage review reminder, branch pastor follow-up

### Fellowship Cluster Program

- Outcome: Help each Branch Church nurture a manageable regional fellowship cluster.
- App module: Organizations
- Source docs: The Alliance Structure
- Operations: Map churches to cluster; Plan local fellowship services; Track shared outreach events; Monitor regional participation; Surface cluster health to leadership
- Records: branch_church, cluster, cluster_event, participation, health_note
- Automations: cluster activity digest, inactive church nudge, regional event reminder

### Seasonal Rhythm Program

- Outcome: Run the yearly cycle from outreach through conference, assimilation, review, and relaunch.
- App module: Calendar
- Source docs: The Alliance Rhythm, The Alliance Members
- Operations: Set seasonal focus; Open outreach phase; Publish conference schedule; Collect registrations and attendance; Launch assimilation follow-up; Prepare board review
- Records: season, focus, event, registration, attendance, assimilation_task, review_packet
- Automations: season launch brief, conference countdown, post-conference follow-up, council review packet

### Leadership And Governance Program

- Outcome: Keep board meetings, council responsibilities, decisions, care assignments, and accountability visible.
- App module: Governance
- Source docs: The Alliance Leadership, The Alliance Rhythm
- Operations: Prepare agenda; Track attendance and participation; Capture motions, decisions, and minutes; Assign care and crisis follow-up; Review leader engagement
- Records: meeting, agenda_item, motion, minutes, assignment, leader_engagement
- Automations: agenda close reminder, minutes draft reminder, leader absence follow-up, care assignment nudge

### Member Activation Program

- Outcome: Move members from awareness into outreach, service, training, fellowship, and belonging.
- App module: People
- Source docs: The Alliance Members
- Operations: Create member participation profile; Capture gifts and interests; Invite to seasonal outreach; Route service opportunities; Track discipleship and training progress
- Records: person, gift_profile, interest, invitation, service_assignment, training_progress
- Automations: new member welcome, gift match suggestion, service invitation, training reminder

### Gifts And Resource Exchange Program

- Outcome: Make ministry gifts, practical skills, business resources, and support requests visible and usable across churches.
- App module: Initiatives
- Source docs: The Alliance Gifts
- Operations: Catalog ministry gifts and practical skills; Receive church needs; Match helpers to requests; Track mentorship and training cohorts; Record testimony and outcomes
- Records: gift, skill, resource_need, match, mentorship, testimony
- Automations: resource match alert, mentor check-in, training cohort reminder, need aging alert

### Communications And Notification Program

- Outcome: Use email, SMS, notifications, and direct replies to keep participation simple.
- App module: Communications
- Source docs: The alliance Hub
- Operations: Segment audiences by role and church; Send seasonal briefs; Receive replies and confirmations; Notify leaders of needed action; Archive send history and response status
- Records: audience, message, channel, reply, notification, send_history
- Automations: welcome sequence, attendance confirmation, leader task alert, weekly Alliance brief

### Financial Stewardship Program

- Outcome: Support giving, sponsorships, offerings, event contributions, and designated causes with clarity.
- App module: Documents
- Source docs: The alliance Hub, The Alliance Gifts
- Operations: Define giving purpose; Route funds by church, event, ministry, outreach, or cause; Issue receipts and acknowledgements; Summarize support by initiative; Report stewardship to authorized leaders
- Records: giving_purpose, contribution, designation, receipt, stewardship_report
- Automations: gift acknowledgement, event contribution summary, sponsorship follow-up

### Zo Operational Assistance Program

- Outcome: Use Zo to watch activity, suggest next steps, prepare packets, and reduce repetitive administration.
- App module: Compliance
- Source docs: The alliance Hub
- Operations: Monitor new records and pending tasks; Detect missing follow-up; Prepare agendas and summaries; Queue reminders; Escalate stale or urgent work
- Records: automation_rule, watch_event, task_signal, summary_packet, escalation
- Automations: daily operational scan, stale task escalation, meeting packet draft, post-event follow-up queue

### Conversation-First Intake Program

- Outcome: Route every Alliance conversation through Script Factory intake, vocabulary matching, and governed capabilities.
- App module: Communications
- Source docs: alliance_invisible_app_architecture.md
- Operations: Normalize inbound SMS, email, and web chat; Identify or create the provisional user; Create or load the conversation thread; Match ordinary language to Alliance vocabulary; Select an approved capability or scaffold a script gap; Record evidence, memory summary, and follow-up
- Records: conversation_intake, user, conversation_thread, conversation_message, vocabulary_match, capability_run
- Automations: hello alliance intake, progressive identity prompt, capability routing, leader escalation

### Personal Link Engagement Program

- Outcome: Use secure personal links so the user's phone becomes the primary Alliance app surface.
- App module: People
- Source docs: alliance_invisible_app_architecture.md
- Operations: Generate signed continuation links; Validate token and purpose; Render personal chat and CTA cards; Handle attendance, prayer, service format, and giving actions; Expire, revoke, and audit link usage
- Records: personal_link, token_hash, thread, cta_card, link_audit
- Automations: send continuation link, attendance CTA, service-day link, expired-link recovery

## End To End Flow

1. A church visits or connects through a Branch Church.
2. The Branch Pastor records the relationship and invites the church into local fellowship.
3. The seasonal outreach phase opens and members receive simple prompts to invite, serve, and participate.
4. Fellowship events and training opportunities build toward the seasonal conference.
5. Conference registrations, attendance, giving, and ministry needs are tracked.
6. After the conference, assimilation tasks route new people and churches into discipleship and relationship follow-up.
7. The Board or Alliance Council reviews results, resolves decisions, and prepares the next season.
8. Zo watches gaps, drafts reminders, prepares packets, and helps keep the rhythm moving.
9. Conversation intake turns user replies and new directions into Script Factory records so future work grows the shared vocabulary instead of disappearing into chat.

## Hub Requirements

- Role-based experiences for public visitors, members, leaders, churches, and admins
- Church relationship graph with Visiting, Fellowship, and Branch stages
- Seasonal calendar engine with outreach, conference, assimilation, review, and relaunch states
- Member gift and service profile
- Resource request and matching workflow
- Board meeting agenda, minutes, motions, decisions, and assignments
- Email, SMS, notification, and reply intake lanes
- Giving and stewardship records
- Supabase Edge Function persistence for private records
- Zo automation monitoring and follow-up packets
- Conversation-first intake with vocabulary matching and capability routing
- Secure personal links for chat, attendance, giving, service formats, and uploads
