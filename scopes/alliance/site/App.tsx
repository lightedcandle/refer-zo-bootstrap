import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpenText,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HandCoins,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
  Network,
  Route,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  UsersRound,
  Workflow,
} from "lucide-react";

const site = {
  "schema": "refer.alliance.site-manifest.v1",
  "phase": "phase1",
  "site": {
    "title": "Alliance",
    "description": "Alliance hub for churches, pastors, leaders, members, and administrators.",
    "dynamic_fields": {
      "allianceName": "Alliance",
      "featuredChurch": "Grace Covenant Church",
      "pendingChurch": "New Hope Fellowship",
      "gatheringName": "spring gathering",
      "briefName": "weekly Alliance brief"
    }
  },
  "auth": {
    "behavior": "public_now",
    "later_note": "Access is open while the hub is being prepared. Sign-in will be added after the Alliance confirms the daily workflow."
  },
  "roles": [
    {
      "id": "admin",
      "label": "Admin",
      "title": "Alliance administration",
      "summary": "Review church requests, confirm documents, prepare decisions, and keep the Alliance moving in order.",
      "metrics": [
        [
          "3",
          "approval queues"
        ],
        [
          "8",
          "open tasks"
        ],
        [
          "2",
          "standards due"
        ]
      ],
      "work": [
        "Approve New Hope Fellowship profile",
        "Assign governance follow-up",
        "Review credentialing evidence",
        "Publish the weekly Alliance brief"
      ]
    },
    {
      "id": "church",
      "label": "Church",
      "title": "Church workspace",
      "summary": "Maintain church records, leader rosters, ministries, event registrations, documents, and participation status.",
      "metrics": [
        [
          "6",
          "member churches"
        ],
        [
          "4",
          "active ministries"
        ],
        [
          "11",
          "shared documents"
        ]
      ],
      "work": [
        "Update Grace Covenant Church profile",
        "Confirm pastor and elder assignments",
        "Submit annual ministry report",
        "Register for regional gathering"
      ]
    },
    {
      "id": "leader",
      "label": "Pastor / Leader",
      "title": "Leadership operating lane",
      "summary": "Track meetings, pastoral assignments, votes, announcements, and ministry responsibilities.",
      "metrics": [
        [
          "14",
          "leaders tracked"
        ],
        [
          "5",
          "meetings planned"
        ],
        [
          "4",
          "decisions pending"
        ]
      ],
      "work": [
        "Prepare board meeting packet",
        "Review motion before vote",
        "Coordinate ministry training",
        "Send approved pastors update"
      ]
    },
    {
      "id": "member",
      "label": "Member",
      "title": "Member participation view",
      "summary": "See events, announcements, resources, training, volunteer paths, and the status of personal requests.",
      "metrics": [
        [
          "7",
          "upcoming events"
        ],
        [
          "3",
          "training tracks"
        ],
        [
          "2",
          "member requests"
        ]
      ],
      "work": [
        "Register for the spring gathering",
        "View approved announcements",
        "Download member resources",
        "Submit participation request"
      ]
    }
  ],
  "access_cards": [
    [
      "Public",
      "Approved announcements, public gatherings, and Alliance information"
    ],
    [
      "Member",
      "Resources, event signups, requests, and participation status"
    ],
    [
      "Leader",
      "Church rosters, meetings, documents, and ministry coordination"
    ],
    [
      "Admin",
      "Approvals, settings, standards, decisions, and full Alliance oversight"
    ]
  ],
  "modules": [
    [
      "Building2",
      "Organizations",
      "Churches, ministries, partners, regions, status, and relationship history."
    ],
    [
      "UsersRound",
      "People",
      "Pastors, elders, leaders, staff, contacts, member roles, and lifecycle state."
    ],
    [
      "CalendarDays",
      "Calendar",
      "Meetings, conferences, trainings, registration windows, and operating cycles."
    ],
    [
      "BookOpenText",
      "Initiatives",
      "Ministries, programs, missions, projects, owners, milestones, and participation."
    ],
    [
      "FileText",
      "Documents",
      "Policies, minutes, charters, reports, templates, and approved resource libraries."
    ],
    [
      "ShieldCheck",
      "Compliance",
      "Credentialing, standards, evidence, due dates, reviews, and exceptions."
    ],
    [
      "ClipboardCheck",
      "Governance",
      "Motions, votes, decisions, approvals, assignments, and board follow-up."
    ],
    [
      "Megaphone",
      "Communications",
      "Announcements, briefs, audience targeting, approval queues, and send history."
    ]
  ],
  "today": [
    [
      "Today",
      "New Hope Fellowship onboarding packet is ready for review"
    ],
    [
      "Tomorrow",
      "Pastors council agenda closes for comments"
    ],
    [
      "May cycle",
      "Credentialing reminders go to church offices"
    ],
    [
      "This week",
      "Member requests and event registrations move through review"
    ]
  ],
  "churches": [
    [
      "Grace Covenant Church",
      "Profile updated",
      "Pastor and elder roster confirmed"
    ],
    [
      "New Hope Fellowship",
      "Onboarding review",
      "Church packet ready for admin review"
    ],
    [
      "River House Chapel",
      "Annual report due",
      "Ministry summary requested"
    ],
    [
      "Kingdom Life Assembly",
      "Credentialing review",
      "Safeguarding policy evidence requested"
    ],
    [
      "Mercy Gate Fellowship",
      "Gathering host",
      "Venue and hospitality team confirmed"
    ],
    [
      "Living Water Church",
      "Member resources",
      "Training cohort enrollment open"
    ]
  ],
  "gatherings": [
    [
      "Spring Gathering",
      "May 18",
      "Registration open"
    ],
    [
      "Pastors Council",
      "May 21",
      "Agenda in review"
    ],
    [
      "Member Training",
      "May 25",
      "Resource packet posted"
    ],
    [
      "Governance Workshop",
      "May 28",
      "Board packet in preparation"
    ],
    [
      "Church Admin Roundtable",
      "June 3",
      "Office teams invited"
    ]
  ],
  "documents": [
    [
      "Alliance Bylaws",
      "Leaders",
      "Current"
    ],
    [
      "Church Onboarding Packet",
      "Admin",
      "Review"
    ],
    [
      "Member Resource Guide",
      "Members",
      "Published"
    ],
    [
      "Credentialing Checklist",
      "Churches",
      "Due May cycle"
    ],
    [
      "Pastors Council Minutes",
      "Leaders",
      "Draft"
    ],
    [
      "Safeguarding Policy Template",
      "Admins",
      "Available"
    ]
  ],
  "work_queues": [
    [
      "Admin",
      "Church onboarding",
      "New Hope Fellowship profile needs final approval",
      "Due today"
    ],
    [
      "Church",
      "Annual report",
      "Grace Covenant Church ministry report is in progress",
      "Due May 12"
    ],
    [
      "Pastor / Leader",
      "Council motion",
      "Training budget motion is open for comments",
      "Closes tomorrow"
    ],
    [
      "Member",
      "Event signup",
      "spring gathering registration is open",
      "Open"
    ],
    [
      "Admin",
      "Credentialing",
      "Two leadership files need evidence review",
      "Due Friday"
    ],
    [
      "Church",
      "Resource library",
      "Upload revised ministry handbook",
      "Due May 16"
    ],
    [
      "Pastor / Leader",
      "Care assignment",
      "Member care follow-up list needs owners",
      "Assign today"
    ],
    [
      "Member",
      "Training",
      "Serving Teams track has new session materials",
      "Open"
    ]
  ],
  "pastor_council": [
    [
      "Agenda review",
      "Pastors council agenda closes tomorrow",
      "Comment"
    ],
    [
      "Credentialing",
      "Two leaders need document confirmation",
      "Review"
    ],
    [
      "Training",
      "Regional ministry training needs session hosts",
      "Volunteer"
    ],
    [
      "Care",
      "Member care follow-up list is ready",
      "Assign"
    ],
    [
      "Church planting",
      "New fellowship assessment needs council notes",
      "Discuss"
    ],
    [
      "Communications",
      "Approved pastors update is ready for final read",
      "Approve"
    ]
  ],
  "member_resources": [
    [
      "Member Resource Guide",
      "Published",
      "View guide"
    ],
    [
      "Spring Gathering Registration",
      "Open",
      "Register"
    ],
    [
      "Training Track: Serving Teams",
      "Open",
      "Start track"
    ],
    [
      "Request Help or Prayer",
      "Available",
      "Submit request"
    ],
    [
      "Volunteer Interest Form",
      "Available",
      "Share interest"
    ],
    [
      "Family Care Directory",
      "Published",
      "View contacts"
    ]
  ],
  "forms": [
    [
      "Church update",
      "Share church profile changes, leadership updates, and ministry notes."
    ],
    [
      "Member request",
      "Send a request for care, resources, event help, or participation."
    ],
    [
      "Event registration",
      "Register for gatherings, trainings, and Alliance meetings."
    ],
    [
      "Document submission",
      "Send reports, credentialing evidence, minutes, or policy updates."
    ],
    [
      "Pastor council item",
      "Submit motions, agenda notes, care assignments, or council discussion items."
    ],
    [
      "Resource request",
      "Ask for training materials, templates, ministry support, or family care resources."
    ]
  ],
  "about": {
    "headline": "The Alliance is a living body moving in shared rhythm.",
    "intro": "The Alliance Hub exists to make the vision of the Alliance visible, understandable, and actionable. It gathers churches, pastors, members, gifts, outreach, governance, giving, communication, and follow-up into one coordinated digital ecosystem.",
    "scripture": "From whom the whole body fitly joined together and compacted by that which every joint supplieth... maketh increase of the body unto the edifying of itself in love. - Ephesians 4:16",
    "chapters": [
      {
        "title": "The Living Hub",
        "source": "The Alliance Hub",
        "color": "emerald",
        "narrative": "The Hub is the visible operating system for the Alliance. It codifies mission, relationships, rhythms, communications, records, giving, and AI-assisted follow-up so the Alliance can move with order instead of scattered administration."
      },
      {
        "title": "Church Structure",
        "source": "The Alliance Structure",
        "color": "indigo",
        "narrative": "Branch Churches shepherd fellowship clusters. Visiting Churches become Fellowship Churches, Fellowship Churches mature into Branch Churches, and all clusters converge through the shared Alliance calendar."
      },
      {
        "title": "Seasonal Rhythm",
        "source": "The Alliance Rhythm",
        "color": "amber",
        "narrative": "The year moves through outreach, fellowship, harvest, conference, assimilation, review, and relaunch. Winter emphasizes leadership, spring women, summer men, and autumn youth."
      },
      {
        "title": "Leadership Brotherhood",
        "source": "The Alliance Leadership",
        "color": "rose",
        "narrative": "Pastors and board members carry the governing heartbeat. The system must help them stay present, accountable, encouraged, prepared, and connected to the needs of every church."
      },
      {
        "title": "Member Movement",
        "source": "The Alliance Members",
        "color": "sky",
        "narrative": "Members become the grassroots force of outreach and fellowship. The app must help them know where they belong, what season they are in, how to serve, and what next step to take."
      },
      {
        "title": "Gifts And Provision",
        "source": "The Alliance Gifts",
        "color": "violet",
        "narrative": "The Alliance circulates spiritual gifts, practical skills, business resources, training, mentorship, and support so each church is strengthened by what the wider body supplies."
      }
    ]
  },
  "scoping": {
    "summary": "Scoping converts the Alliance story into appable programs: each vision point becomes a trackable workflow, role, record, automation, or cadence inside the Hub.",
    "scripture_frame": [
      "Ephesians 4:11-16 - gifts are given for the equipping of the saints and the building up of the body.",
      "1 Corinthians 12:12-27 - many members form one body, and each part supplies what another part lacks.",
      "Acts 2:42-47 - fellowship, prayer, generosity, and daily witness create a living community.",
      "Proverbs 11:14 - wise counsel and shared governance preserve the people."
    ],
    "programs": [
      {
        "id": "church-journey",
        "name": "Church Journey Program",
        "source_docs": [
          "The Alliance Structure",
          "The alliance Hub"
        ],
        "app_module": "Organizations",
        "outcome": "Track every church from visitor to fellowship church to branch church.",
        "operations": [
          "Create church profile and region",
          "Assign branch pastor or relational covering",
          "Record current journey stage",
          "Schedule follow-up visits and invitations",
          "Review readiness for next stage"
        ],
        "records": [
          "organization",
          "relationship",
          "journey_stage",
          "follow_up",
          "readiness_review"
        ],
        "automations": [
          "welcome church",
          "stage review reminder",
          "branch pastor follow-up"
        ]
      },
      {
        "id": "fellowship-clusters",
        "name": "Fellowship Cluster Program",
        "source_docs": [
          "The Alliance Structure"
        ],
        "app_module": "Organizations",
        "outcome": "Help each Branch Church nurture a manageable regional fellowship cluster.",
        "operations": [
          "Map churches to cluster",
          "Plan local fellowship services",
          "Track shared outreach events",
          "Monitor regional participation",
          "Surface cluster health to leadership"
        ],
        "records": [
          "branch_church",
          "cluster",
          "cluster_event",
          "participation",
          "health_note"
        ],
        "automations": [
          "cluster activity digest",
          "inactive church nudge",
          "regional event reminder"
        ]
      },
      {
        "id": "seasonal-rhythm",
        "name": "Seasonal Rhythm Program",
        "source_docs": [
          "The Alliance Rhythm",
          "The Alliance Members"
        ],
        "app_module": "Calendar",
        "outcome": "Run the yearly cycle from outreach through conference, assimilation, review, and relaunch.",
        "operations": [
          "Set seasonal focus",
          "Open outreach phase",
          "Publish conference schedule",
          "Collect registrations and attendance",
          "Launch assimilation follow-up",
          "Prepare board review"
        ],
        "records": [
          "season",
          "focus",
          "event",
          "registration",
          "attendance",
          "assimilation_task",
          "review_packet"
        ],
        "automations": [
          "season launch brief",
          "conference countdown",
          "post-conference follow-up",
          "council review packet"
        ]
      },
      {
        "id": "leadership-governance",
        "name": "Leadership And Governance Program",
        "source_docs": [
          "The Alliance Leadership",
          "The Alliance Rhythm"
        ],
        "app_module": "Governance",
        "outcome": "Keep board meetings, council responsibilities, decisions, care assignments, and accountability visible.",
        "operations": [
          "Prepare agenda",
          "Track attendance and participation",
          "Capture motions, decisions, and minutes",
          "Assign care and crisis follow-up",
          "Review leader engagement"
        ],
        "records": [
          "meeting",
          "agenda_item",
          "motion",
          "minutes",
          "assignment",
          "leader_engagement"
        ],
        "automations": [
          "agenda close reminder",
          "minutes draft reminder",
          "leader absence follow-up",
          "care assignment nudge"
        ]
      },
      {
        "id": "member-activation",
        "name": "Member Activation Program",
        "source_docs": [
          "The Alliance Members"
        ],
        "app_module": "People",
        "outcome": "Move members from awareness into outreach, service, training, fellowship, and belonging.",
        "operations": [
          "Create member participation profile",
          "Capture gifts and interests",
          "Invite to seasonal outreach",
          "Route service opportunities",
          "Track discipleship and training progress"
        ],
        "records": [
          "person",
          "gift_profile",
          "interest",
          "invitation",
          "service_assignment",
          "training_progress"
        ],
        "automations": [
          "new member welcome",
          "gift match suggestion",
          "service invitation",
          "training reminder"
        ]
      },
      {
        "id": "gifts-resource-exchange",
        "name": "Gifts And Resource Exchange Program",
        "source_docs": [
          "The Alliance Gifts"
        ],
        "app_module": "Initiatives",
        "outcome": "Make ministry gifts, practical skills, business resources, and support requests visible and usable across churches.",
        "operations": [
          "Catalog ministry gifts and practical skills",
          "Receive church needs",
          "Match helpers to requests",
          "Track mentorship and training cohorts",
          "Record testimony and outcomes"
        ],
        "records": [
          "gift",
          "skill",
          "resource_need",
          "match",
          "mentorship",
          "testimony"
        ],
        "automations": [
          "resource match alert",
          "mentor check-in",
          "training cohort reminder",
          "need aging alert"
        ]
      },
      {
        "id": "communications-notifications",
        "name": "Communications And Notification Program",
        "source_docs": [
          "The alliance Hub"
        ],
        "app_module": "Communications",
        "outcome": "Use email, SMS, notifications, and direct replies to keep participation simple.",
        "operations": [
          "Segment audiences by role and church",
          "Send seasonal briefs",
          "Receive replies and confirmations",
          "Notify leaders of needed action",
          "Archive send history and response status"
        ],
        "records": [
          "audience",
          "message",
          "channel",
          "reply",
          "notification",
          "send_history"
        ],
        "automations": [
          "welcome sequence",
          "attendance confirmation",
          "leader task alert",
          "weekly Alliance brief"
        ]
      },
      {
        "id": "financial-stewardship",
        "name": "Financial Stewardship Program",
        "source_docs": [
          "The alliance Hub",
          "The Alliance Gifts"
        ],
        "app_module": "Documents",
        "outcome": "Support giving, sponsorships, offerings, event contributions, and designated causes with clarity.",
        "operations": [
          "Define giving purpose",
          "Route funds by church, event, ministry, outreach, or cause",
          "Issue receipts and acknowledgements",
          "Summarize support by initiative",
          "Report stewardship to authorized leaders"
        ],
        "records": [
          "giving_purpose",
          "contribution",
          "designation",
          "receipt",
          "stewardship_report"
        ],
        "automations": [
          "gift acknowledgement",
          "event contribution summary",
          "sponsorship follow-up"
        ]
      },
      {
        "id": "zo-operational-assist",
        "name": "Zo Operational Assistance Program",
        "source_docs": [
          "The alliance Hub"
        ],
        "app_module": "Compliance",
        "outcome": "Use Zo to watch activity, suggest next steps, prepare packets, and reduce repetitive administration.",
        "operations": [
          "Monitor new records and pending tasks",
          "Detect missing follow-up",
          "Prepare agendas and summaries",
          "Queue reminders",
          "Escalate stale or urgent work"
        ],
        "records": [
          "automation_rule",
          "watch_event",
          "task_signal",
          "summary_packet",
          "escalation"
        ],
        "automations": [
          "daily operational scan",
          "stale task escalation",
          "meeting packet draft",
          "post-event follow-up queue"
        ]
      }
    ],
    "end_to_end_flow": [
      "A church visits or connects through a Branch Church.",
      "The Branch Pastor records the relationship and invites the church into local fellowship.",
      "The seasonal outreach phase opens and members receive simple prompts to invite, serve, and participate.",
      "Fellowship events and training opportunities build toward the seasonal conference.",
      "Conference registrations, attendance, giving, and ministry needs are tracked.",
      "After the conference, assimilation tasks route new people and churches into discipleship and relationship follow-up.",
      "The Board or Alliance Council reviews results, resolves decisions, and prepares the next season.",
      "Zo watches gaps, drafts reminders, prepares packets, and helps keep the rhythm moving."
    ],
    "hub_requirements": [
      "Role-based experiences for public visitors, members, leaders, churches, and admins",
      "Church relationship graph with Visiting, Fellowship, and Branch stages",
      "Seasonal calendar engine with outreach, conference, assimilation, review, and relaunch states",
      "Member gift and service profile",
      "Resource request and matching workflow",
      "Board meeting agenda, minutes, motions, decisions, and assignments",
      "Email, SMS, notification, and reply intake lanes",
      "Giving and stewardship records",
      "Supabase Edge Function persistence for private records",
      "Zo automation monitoring and follow-up packets"
    ],
    "source_documents": [
      {
        "id": "alliance-hub",
        "title": "The Alliance Hub",
        "file": "The alliance Hub",
        "chars": 6789,
        "sha256": "789cbbd590a70f248c6aff1d90ac8d7a3eff0d289021b1e8e6c248fc80ee85e8"
      },
      {
        "id": "alliance-structure",
        "title": "The Alliance Structure",
        "file": "The Alliance Structure",
        "chars": 4784,
        "sha256": "f904efc268c3b9082e5f5e647c3836c08b3a33ac45f2e24ed7427ea700559d12"
      },
      {
        "id": "alliance-rhythm",
        "title": "The Alliance Rhythm",
        "file": "The Alliance Rhythm",
        "chars": 3487,
        "sha256": "8904db2f55c59b4df2bbe1a3f4e3bfaec13e49ea5192f209aa22c6127746f3dc"
      },
      {
        "id": "alliance-leadership",
        "title": "The Alliance Leadership",
        "file": "The Alliance Leadership",
        "chars": 3592,
        "sha256": "e3ce5519f4a53daab053e821568bec464387cc38c84bdb12a8f5383b3a43d905"
      },
      {
        "id": "alliance-members",
        "title": "The Alliance Members",
        "file": "The Alliance Members",
        "chars": 3259,
        "sha256": "37ec5b02f0ab32626f975ad2d1ca23d5c06fb5a5802d2da462d1bb16c62801ff"
      },
      {
        "id": "alliance-gifts",
        "title": "The Alliance Gifts",
        "file": "The Alliance Gifts",
        "chars": 3259,
        "sha256": "08ac67025ceeca5ae653bdc521a48f1859b70d37b9485349a06084200a79201c"
      }
    ]
  }
};
const dataModel = {
  "schema": "refer.alliance.phase2-data-contract.v1",
  "phase": "phase2",
  "purpose": "Define the Alliance data model and persistence decision gates before adding hosted auth or a cloud database.",
  "source_authority": [
    "scopes/alliance/site-manifest.json",
    "docs/hdp-1-open-items.md",
    "docs/zo-vipc-bootstrap-blueprint.md"
  ],
  "persistence_strategy": {
    "current": "supabase_edge_selected",
    "local_surfaces": [
      "scopes/alliance/site-manifest.json",
      "datasets/script-artifacts/scoped/alliance/site/",
      "datasets/script-artifacts/scoped/alliance/phase2/"
    ],
    "remote_surface": "/home/workspace/Projects/Alliance-Hub/alliance/factory/phase2-data-contract.json",
    "cloud_database": "supabase",
    "supabase_gate": "Supabase is selected for persistent private records. Zo must call Supabase Edge Functions; direct Supabase table writes from Zo are not allowed.",
    "selected_backend": "supabase_edge_functions",
    "edge_function": "alliance-record-write"
  },
  "auth_policy": {
    "phase2_behavior": "public_read_mock_write",
    "phase2_rule": "Do not collect private user data in Phase 2. Forms may be represented as structured draft records only.",
    "phase5_gate": "auth_required",
    "roles": [
      "public",
      "member",
      "leader",
      "church",
      "admin"
    ]
  },
  "entities": [
    {
      "id": "organization",
      "label": "Organization",
      "route": "/dashboard/organizations",
      "local_dataset": "alliance-organizations",
      "source_manifest_key": "churches",
      "fields": [
        "id",
        "name",
        "status",
        "summary",
        "region",
        "primary_contact",
        "updated_at"
      ],
      "role_access": {
        "public": [
          "read_public"
        ],
        "member": [
          "read_public"
        ],
        "leader": [
          "read_public",
          "read_internal"
        ],
        "church": [
          "read_public",
          "read_own",
          "update_own"
        ],
        "admin": [
          "read_all",
          "create",
          "update",
          "archive"
        ]
      }
    },
    {
      "id": "person",
      "label": "Person",
      "route": "/dashboard/people",
      "local_dataset": "alliance-people",
      "source_manifest_key": "roles",
      "fields": [
        "id",
        "display_name",
        "role",
        "organization_id",
        "status",
        "contact_scope",
        "updated_at"
      ],
      "role_access": {
        "public": [],
        "member": [
          "read_self"
        ],
        "leader": [
          "read_ministry_contacts"
        ],
        "church": [
          "read_own_people",
          "update_own_people"
        ],
        "admin": [
          "read_all",
          "create",
          "update",
          "archive"
        ]
      }
    },
    {
      "id": "event",
      "label": "Event",
      "route": "/dashboard/calendar",
      "local_dataset": "alliance-events",
      "source_manifest_key": "gatherings",
      "fields": [
        "id",
        "title",
        "starts_at",
        "status",
        "audience",
        "location",
        "registration_state"
      ],
      "role_access": {
        "public": [
          "read_public"
        ],
        "member": [
          "read_public",
          "register_self"
        ],
        "leader": [
          "read_public",
          "manage_assigned"
        ],
        "church": [
          "read_public",
          "register_group"
        ],
        "admin": [
          "read_all",
          "create",
          "update",
          "archive"
        ]
      }
    },
    {
      "id": "initiative",
      "label": "Initiative",
      "route": "/dashboard/initiatives",
      "local_dataset": "alliance-initiatives",
      "source_manifest_key": "modules",
      "fields": [
        "id",
        "title",
        "owner_role",
        "status",
        "goal",
        "start_date",
        "target_date"
      ],
      "role_access": {
        "public": [
          "read_public"
        ],
        "member": [
          "read_public",
          "join_open"
        ],
        "leader": [
          "read_all",
          "update_assigned"
        ],
        "church": [
          "read_all",
          "join_as_church"
        ],
        "admin": [
          "read_all",
          "create",
          "update",
          "archive"
        ]
      }
    },
    {
      "id": "document",
      "label": "Document",
      "route": "/dashboard/documents",
      "local_dataset": "alliance-documents",
      "source_manifest_key": "documents",
      "fields": [
        "id",
        "title",
        "audience",
        "status",
        "document_type",
        "storage_ref",
        "updated_at"
      ],
      "role_access": {
        "public": [
          "read_public"
        ],
        "member": [
          "read_member"
        ],
        "leader": [
          "read_leader"
        ],
        "church": [
          "read_church",
          "submit_own"
        ],
        "admin": [
          "read_all",
          "create",
          "update",
          "archive"
        ]
      }
    },
    {
      "id": "governance_item",
      "label": "Governance Item",
      "route": "/dashboard/governance",
      "local_dataset": "alliance-governance",
      "source_manifest_key": "pastor_council",
      "fields": [
        "id",
        "title",
        "status",
        "owner_role",
        "decision_state",
        "due_at",
        "updated_at"
      ],
      "role_access": {
        "public": [],
        "member": [],
        "leader": [
          "read_council",
          "comment"
        ],
        "church": [
          "read_relevant"
        ],
        "admin": [
          "read_all",
          "create",
          "update",
          "close"
        ]
      }
    },
    {
      "id": "compliance_task",
      "label": "Compliance Task",
      "route": "/dashboard/compliance",
      "local_dataset": "alliance-compliance",
      "source_manifest_key": "work_queues",
      "fields": [
        "id",
        "title",
        "organization_id",
        "standard",
        "status",
        "due_at",
        "evidence_ref"
      ],
      "role_access": {
        "public": [],
        "member": [],
        "leader": [
          "read_assigned"
        ],
        "church": [
          "read_own",
          "submit_own"
        ],
        "admin": [
          "read_all",
          "create",
          "update",
          "approve"
        ]
      }
    },
    {
      "id": "communication",
      "label": "Communication",
      "route": "/dashboard/communications",
      "local_dataset": "alliance-communications",
      "source_manifest_key": "today",
      "fields": [
        "id",
        "title",
        "audience",
        "status",
        "channel",
        "scheduled_at",
        "approved_by"
      ],
      "role_access": {
        "public": [
          "read_public"
        ],
        "member": [
          "read_member"
        ],
        "leader": [
          "read_leader",
          "draft"
        ],
        "church": [
          "read_church"
        ],
        "admin": [
          "read_all",
          "create",
          "update",
          "publish"
        ]
      }
    },
    {
      "id": "request",
      "label": "Request",
      "route": "/dashboard/requests",
      "local_dataset": "alliance-requests",
      "source_manifest_key": "forms",
      "fields": [
        "id",
        "request_type",
        "submitted_by_scope",
        "status",
        "summary",
        "assigned_role",
        "created_at"
      ],
      "role_access": {
        "public": [
          "create_public_draft"
        ],
        "member": [
          "create_self",
          "read_self"
        ],
        "leader": [
          "read_assigned",
          "update_assigned"
        ],
        "church": [
          "create_church",
          "read_own"
        ],
        "admin": [
          "read_all",
          "assign",
          "close"
        ]
      }
    }
  ],
  "phase2_minimums": {
    "entities": 8,
    "roles": 5,
    "routes": 8,
    "datasets": 8,
    "supabase_decision_gates": 4
  },
  "supabase_decision_gates": [
    "private_member_records",
    "persistent_form_writes",
    "multi_user_admin_workflow",
    "role_scoped_row_access"
  ],
  "next_phase": {
    "phase3": "Generate route-level create/edit mock forms from this contract while writes remain local drafts.",
    "phase5": "Add auth provider and role enforcement after the Alliance approves the private data model."
  }
};

const icons = {
  BadgeCheck,
  BookOpenText,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HandCoins,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
  Network,
  Route,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  UsersRound,
  Workflow,
};

const chapterStyles = {
  emerald: "border-[#2f7d68] bg-[#e8f1ed] text-[#17453b]",
  indigo: "border-[#5b62b1] bg-[#eceefe] text-[#303679]",
  amber: "border-[#c68b2c] bg-[#fff4df] text-[#7a4d16]",
  rose: "border-[#c7637d] bg-[#fdebf0] text-[#8a2945]",
  sky: "border-[#3d86b8] bg-[#e7f4fb] text-[#155577]",
  violet: "border-[#8063b8] bg-[#f0ebfb] text-[#4d347a]",
};

const views = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "operations", label: "Operations" },
  { id: "records", label: "Records" },
  { id: "drafts", label: "Drafts" },
  { id: "access", label: "Access" },
];

const profileDistinctions = [
  "Member",
  "Volunteer",
  "Ministry Worker",
  "Deacon",
  "Elder",
  "Minister",
  "Pastor",
  "Bishop",
  "Apostle",
  "Church Administrator",
  "Guest",
];

function ProfileIntakeForm({ token }) {
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState({
    first_name: "",
    last_name: "",
    email: "",
    image_url: "",
    distinction: "Member",
  });
  const [status, setStatus] = useState({ state: "loading", message: "Loading profile link..." });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile-intake/session/${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return;
        if (!result?.ok) {
          setStatus({ state: "error", message: "This profile link is not valid." });
          return;
        }
        setSession(result);
        setDraft((current) => ({ ...current, distinction: result.distinctions?.[0] || "Member" }));
        setStatus({ state: "ready", message: "" });
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: "error", message: "This profile link could not be loaded." });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setStatus({ state: "saving", message: "Saving profile..." });
    const response = await fetch("/api/profile-intake/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...draft }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      const reason = result?.error || result?.profile?.error || result?.profile?.supabase?.error;
      setStatus({
        state: "error",
        message: reason
          ? `We could not save this profile: ${reason}.`
          : "We could not save this profile. Check the required fields and try again.",
      });
      return;
    }
    setStatus({
      state: "done",
      message: result.profile?.persistence === "zo_site_local_file"
        ? "Your Alliance profile is saved locally and queued for Supabase sync."
        : "Your Alliance profile is set up. Thank you.",
    });
  }

  const distinctions = session?.distinctions || profileDistinctions;

  return (
    <main className="min-h-screen bg-[#f5f6f2] text-[#18212f]">
      <section className="mx-auto grid min-h-screen max-w-3xl content-center px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <img src="/assets/pastors-alliance-mark.png" alt="" className="h-11 w-11 rounded-md object-cover" />
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-[#17453b]">Alliance Hub</div>
            <h1 className="text-2xl font-semibold text-[#101828]">Complete your profile</h1>
          </div>
        </div>
        <form onSubmit={submit} className="grid gap-4 rounded-md border border-[#d2d8ce] bg-white p-4 shadow-sm">
          <p className="text-sm leading-6 text-[#667085]">
            Your phone number is attached to this secure setup link. It cannot be changed here.
          </p>
          <label className="grid gap-2 text-sm font-semibold text-[#344054]">
            <span>Phone</span>
            <input
              value={session?.phone_display || ""}
              disabled
              className="h-11 rounded-md border border-[#d0d5dd] bg-[#f2f4f7] px-3 text-sm text-[#667085]"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#344054]">
              <span>First name</span>
              <input
                value={draft.first_name}
                onChange={(event) => update("first_name", event.target.value)}
                required
                className="h-11 rounded-md border border-[#d0d5dd] px-3 text-sm font-normal text-[#101828] outline-none focus:border-[#17453b]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#344054]">
              <span>Last name</span>
              <input
                value={draft.last_name}
                onChange={(event) => update("last_name", event.target.value)}
                required
                className="h-11 rounded-md border border-[#d0d5dd] px-3 text-sm font-normal text-[#101828] outline-none focus:border-[#17453b]"
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-[#344054]">
            <span>Email optional</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => update("email", event.target.value)}
              className="h-11 rounded-md border border-[#d0d5dd] px-3 text-sm font-normal text-[#101828] outline-none focus:border-[#17453b]"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#344054]">
            <span>Profile image link optional</span>
            <input
              value={draft.image_url}
              onChange={(event) => update("image_url", event.target.value)}
              placeholder="https://..."
              className="h-11 rounded-md border border-[#d0d5dd] px-3 text-sm font-normal text-[#101828] outline-none focus:border-[#17453b]"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#344054]">
            <span>Distinction</span>
            <select
              value={draft.distinction}
              onChange={(event) => update("distinction", event.target.value)}
              required
              className="h-11 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm font-normal text-[#101828] outline-none focus:border-[#17453b]"
            >
              {distinctions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="flex gap-3 rounded-md border border-[#e0e4dc] bg-[#fbfcfa] p-3 text-sm leading-6 text-[#344054]">
            <input type="checkbox" required className="mt-1" />
            <span>I authorize the Alliance to message this phone number about my profile and Alliance access.</span>
          </label>
          <button
            type="submit"
            disabled={status.state === "loading" || status.state === "saving" || status.state === "done"}
            className="rounded-md bg-[#17453b] px-4 py-3 text-sm font-semibold text-white disabled:bg-[#98a2b3]"
          >
            {status.state === "saving" ? "Saving..." : status.state === "done" ? "Profile saved" : "Complete profile"}
          </button>
          {status.message && (
            <div className={`rounded-md p-3 text-sm ${
              status.state === "error" ? "bg-[#fef3f2] text-[#912018]" : status.state === "done" ? "bg-[#ecfdf3] text-[#05603a]" : "bg-[#f2f4f7] text-[#344054]"
            }`}>
              {status.message}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

function App() {
  const profileMatch = typeof window === "undefined" ? null : window.location.pathname.match(/^\/(?:a|profile\/start)\/([^/]+)$/);
  if (profileMatch) return <ProfileIntakeForm token={decodeURIComponent(profileMatch[1])} />;

  const initialView = typeof window === "undefined" ? "home" : window.location.hash.replace("#", "") || "home";
  const [activeView, setActiveView] = useState(views.some((view) => view.id === initialView) ? initialView : "home");
  const [activeRole, setActiveRole] = useState(site.roles[0].id);
  const [activeOperation, setActiveOperation] = useState(dataModel.entities[0]?.id || "");
  const [formDraft, setFormDraft] = useState({});
  const [localDrafts, setLocalDrafts] = useState([]);
  const role = useMemo(() => site.roles.find((item) => item.id === activeRole) || site.roles[0], [activeRole]);
  const activeEntity = useMemo(
    () => dataModel.entities.find((item) => item.id === activeOperation) || dataModel.entities[0],
    [activeOperation]
  );
  const formFields = useMemo(
    () => (activeEntity?.fields || []).filter((field) => !["id", "updated_at", "created_at"].includes(field)),
    [activeEntity]
  );

  useEffect(() => {
    function syncHash() {
      const nextView = window.location.hash.replace("#", "") || "home";
      if (views.some((view) => view.id === nextView)) setActiveView(nextView);
    }
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function openView(viewId) {
    setActiveView(viewId);
    if (typeof window !== "undefined") {
      window.location.hash = viewId;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function updateFormDraft(field, value) {
    setFormDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveLocalDraft(event) {
    event.preventDefault();
    if (!activeEntity) return;
    const record = {
      id: `draft-${Date.now()}`,
      entity: activeEntity.id,
      label: activeEntity.label,
      route: activeEntity.route,
      local_dataset: activeEntity.local_dataset,
      values: formDraft,
      status: "local_draft"
    };
    setLocalDrafts((current) => [record, ...current].slice(0, 6));
    setFormDraft({});
    try {
      const response = await fetch("/api/alliance-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
      const result = await response.json();
      if (result?.ok) {
        setLocalDrafts((current) =>
          current.map((item) =>
            item.id === record.id ? { ...item, status: "site_file_draft", server_record_id: result.record_id } : item
          )
        );
      }
    } catch {
      setLocalDrafts((current) =>
        current.map((item) => (item.id === record.id ? { ...item, status: "browser_only_draft" } : item))
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f2] text-[#18212f]">
      <header className="border-b border-[#d9ded6] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#17453b] text-white">
              <img src="/assets/pastors-alliance-mark.png" alt="" className="h-8 w-8 rounded-md object-cover" />
            </span>
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-[#17453b]">Pastor's Alliance</div>
              <div className="text-xs text-[#667085]">Churches, leaders, and members</div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 text-sm font-medium text-[#475467] md:flex">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => openView(view.id)}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  activeView === view.id ? "bg-[#e8f1ed] text-[#17453b]" : "text-[#475467]"
                }`}
              >
                {view.label}
              </button>
            ))}
          </nav>
          <button type="button" onClick={() => openView("access")} className="rounded-md bg-[#17453b] px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </button>
        </div>
      </header>

      {/* --- PHASE4_ROUTED_VIEWS:START --- */}
      <div className="border-b border-[#d9ded6] bg-[#fbfcfa] md:hidden">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => openView(view.id)}
              className={`shrink-0 rounded-md border px-3 py-2 text-sm font-semibold ${
                activeView === view.id
                  ? "border-[#17453b] bg-[#17453b] text-white"
                  : "border-[#d0d5dd] bg-white text-[#344054]"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {activeView === "about" && (
      <>
      <section className="border-b border-[#d9ded6] bg-[#10231f] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="order-2 lg:order-1">
            <img
              src="/assets/pastors-alliance-logo.jpg"
              alt="Pastor's Alliance logo"
              className="h-auto w-full rounded-md border border-[#31514a] bg-[#f8f1df] object-cover"
            />
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#8fd3bf]">About the Pastor's Alliance</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
              A fellowship of churches moving together in one body, one rhythm, and one mission.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[#d8e7e2]">
              The Alliance exists to strengthen churches, support pastors, activate members, and help gifts flow through the body of Christ. The Hub is the digital expression of that calling: a place where relationships, outreach, conferences, resources, governance, and follow-up become visible and actionable.
            </p>
            <div className="mt-6 border-l-4 border-[#c68b2c] bg-[#17342e] p-5">
              <p className="text-lg font-semibold leading-8 text-[#fff4df]">{site.about?.scripture}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">What this is</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#101828]">Not only an organization. A living system of fellowship, order, and shared labor.</h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-[#475467]">
            <p>
              The Alliance is built on the biblical truth that the body is strengthened when every joint supplies. No single church carries every gift, every resource, every worker, or every answer alone. In the Alliance, churches remain rooted in their own local covering while becoming part of a wider spiritual family.
            </p>
            <p>
              Branch Churches nurture regional fellowship clusters. Visiting Churches are welcomed without pressure. Fellowship Churches grow through relationship and support. Mature churches can become new Branch Churches that help expand the same pattern in another region.
            </p>
            <p>
              The Hub gives this movement memory and rhythm. It helps leaders see the work, members understand their next step, churches track their relationships, and the Alliance preserve the fruit of each season.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d9ded6] bg-[#edf0ea] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">How it moves</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#101828]">The Alliance year has a rhythm people can follow.</h2>
            <p className="mt-3 text-sm leading-7 text-[#667085]">
              Every season carries a focus, every focus creates outreach, and every outreach moves toward harvest, conference, assimilation, review, and relaunch.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Winter", "Leadership Conference", "Pastors, board members, and leaders align the year with counsel and responsibility."],
              ["Spring", "Women's Conference", "Women are gathered, strengthened, equipped, and connected through outreach and fellowship."],
              ["Summer", "Men's Conference", "Men are called into brotherhood, service, stability, and visible spiritual responsibility."],
              ["Autumn", "Youth Conference", "Young people are reached, discipled, activated, and brought into shared expectation."],
            ].map(([season, title, body]) => (
              <article key={season} className="rounded-md border border-[#d2d8ce] bg-white p-4">
                <div className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">{season}</div>
                <h3 className="mt-2 text-xl font-semibold text-[#101828]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#667085]">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 grid gap-3 rounded-md border border-[#d2d8ce] bg-white p-4 md:grid-cols-4">
            {["Outreach", "Fellowship", "Conference", "Assimilation and review"].map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#17453b] text-sm font-semibold text-white">{index + 1}</div>
                <div className="text-sm font-semibold text-[#344054]">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Who belongs here</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#101828]">The Alliance makes room for churches, leaders, members, and gifts.</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-md border border-[#d2d8ce] bg-[#fbfcfa] p-5">
              <Network className="text-[#2f7d68]" size={24} aria-hidden="true" />
              <h3 className="mt-3 text-2xl font-semibold text-[#101828]">Churches</h3>
              <p className="mt-3 text-sm leading-7 text-[#667085]">
                Churches are welcomed into a journey: visiting, fellowship, and branch. Each step is relational, accountable, and paced by trust rather than pressure.
              </p>
            </article>
            <article className="rounded-md border border-[#d2d8ce] bg-[#fbfcfa] p-5">
              <HeartHandshake className="text-[#c7637d]" size={24} aria-hidden="true" />
              <h3 className="mt-3 text-2xl font-semibold text-[#101828]">Leaders</h3>
              <p className="mt-3 text-sm leading-7 text-[#667085]">
                Pastors and board members carry the governing heartbeat through meetings, counsel, care, accountability, and shared responsibility for the whole body.
              </p>
            </article>
            <article className="rounded-md border border-[#d2d8ce] bg-[#fbfcfa] p-5">
              <HandCoins className="text-[#8063b8]" size={24} aria-hidden="true" />
              <h3 className="mt-3 text-2xl font-semibold text-[#101828]">Members and gifts</h3>
              <p className="mt-3 text-sm leading-7 text-[#667085]">
                Members become the grassroots force of outreach. Gifts, skills, mentorship, business resources, and practical support circulate so churches and families are strengthened.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d9ded6] bg-[#10231f] py-10 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#8fd3bf]">What the Hub does</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight">The Hub turns vision into follow-through.</h2>
            <p className="mt-4 text-sm leading-7 text-[#d8e7e2]">
              People should not need to understand the entire system to participate. The Hub guides each person through simple prompts, clear records, timely reminders, and familiar communication channels.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              "Tracks church relationships, stages, clusters, and regional fellowship.",
              "Coordinates seasonal outreach, conferences, registrations, attendance, and follow-up.",
              "Supports board meetings, agendas, minutes, motions, decisions, and assignments.",
              "Helps members discover gifts, training paths, service opportunities, and belonging.",
              "Routes communication through briefs, email, SMS, notifications, and reply intake.",
              "Uses Zo to watch gaps, prepare packets, nudge follow-up, and reduce administrative burden.",
            ].map((item) => (
              <div key={item} className="rounded-md border border-[#31514a] bg-[#17342e] p-4 text-sm leading-7 text-[#e8f1ed]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Biblical frame</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#101828]">The body builds itself in love when every part supplies.</h2>
            <p className="mt-4 text-sm leading-7 text-[#667085]">
              The Alliance is not trying to replace the local church. It strengthens local churches by connecting pastors, members, resources, and ministries into a wider pattern of fellowship and mutual support.
            </p>
          </div>
          <div className="grid gap-3">
            {(site.scoping?.scripture_frame || []).map((line) => (
              <div key={line} className="border-l-4 border-[#c68b2c] bg-[#fff4df] p-4 text-sm font-semibold leading-7 text-[#7a4d16]">
                {line}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#d9ded6] bg-[#edf0ea] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 grid gap-3 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Scoping preview</p>
              <h2 className="mt-2 text-3xl font-semibold text-[#101828]">What this becomes inside the app</h2>
            </div>
            <p className="text-sm leading-7 text-[#475467]">{site.scoping?.summary}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(site.scoping?.programs || []).slice(0, 6).map((program) => (
              <article key={program.id} className="rounded-md border border-[#d2d8ce] bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#7a4d16]">{program.app_module}</div>
                <h3 className="mt-2 text-lg font-semibold leading-6 text-[#101828]">{program.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#667085]">{program.outcome}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      </>
      )}

      {activeView === "home" && (
      <>
      <section className="border-b border-[#d9ded6] bg-[#edf0ea]">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex min-h-[420px] flex-col justify-between rounded-md border border-[#d2d8ce] bg-white p-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Welcome back</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-[#101828] md:text-5xl">
                {site.site.dynamic_fields.allianceName} is gathered here for churches, pastors, leaders, members, and administrators.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#475467]">
                Check today's requests, upcoming gatherings, church updates, leadership items, documents,
                and member resources from the view prepared for your role.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {site.access_cards.map(([level, body]) => (
                <div key={level} className="rounded-md border border-[#e0e4dc] bg-[#fbfcfa] p-3">
                  <div className="text-sm font-semibold text-[#101828]">{level}</div>
                  <p className="mt-2 text-xs leading-5 text-[#667085]">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[#d2d8ce] bg-[#10231f] p-5 text-white">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#b8d6ce]">Current operations</div>
                <div className="text-2xl font-semibold">Today in the Alliance</div>
              </div>
              <BadgeCheck className="text-[#8fd3bf]" size={28} aria-hidden="true" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {role.metrics.map(([value, label]) => (
                <div key={label} className="rounded-md border border-[#31514a] bg-[#17342e] p-3">
                  <div className="text-3xl font-semibold">{value}</div>
                  <div className="mt-1 text-xs leading-5 text-[#c8d8d3]">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-md border border-[#31514a] bg-[#f5f6f2] p-4 text-[#18212f]">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <UserRoundCog size={16} aria-hidden="true" />
                {role.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#475467]">{role.summary}</p>
              <div className="mt-4 grid gap-2">
                {role.work.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-[#344054]">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-[#2f7d68]" size={16} aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Role workspace</p>
            <h2 className="mt-1 text-3xl font-semibold text-[#101828]">Different roles, one Alliance calendar and workflow</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#667085]">
            Choose the view that matches your place in the Alliance. Each view brings forward the work,
            notices, and records that person needs today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {site.roles.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveRole(item.id)}
              className={`rounded-md border px-4 py-2 text-sm font-semibold ${
                activeRole === item.id
                  ? "border-[#17453b] bg-[#17453b] text-white"
                  : "border-[#d0d5dd] bg-white text-[#344054]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      </>
      )}

      {activeView === "operations" && (
      <>
      <section id="modules" className="border-y border-[#d9ded6] bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Operating modules</p>
              <h2 className="mt-1 text-3xl font-semibold text-[#101828]">Alliance work areas</h2>
            </div>
            <span className="rounded-md border border-[#d0d5dd] px-3 py-2 text-sm font-semibold text-[#344054]">
              Updated this week
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {site.modules.map(([icon, title, body]) => {
              const Icon = icons[icon] || LayoutDashboard;
              return (
                <article key={title} className="rounded-md border border-[#e0e4dc] bg-[#fbfcfa] p-4">
                  <Icon className="text-[#2f7d68]" size={22} aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-[#101828]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#667085]">{body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="churches" className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-[#d2d8ce] bg-white">
          <div className="border-b border-[#edf0ea] p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Churches</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#101828]">Church updates</h2>
          </div>
          {site.churches.map(([name, status, detail]) => (
            <div key={name} className="grid gap-1 border-b border-[#edf0ea] p-4 last:border-b-0">
              <div className="font-semibold text-[#101828]">{name}</div>
              <div className="text-sm font-medium text-[#17453b]">{status}</div>
              <div className="text-sm text-[#667085]">{detail}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5">
          <div className="rounded-md border border-[#d2d8ce] bg-white">
            <div className="border-b border-[#edf0ea] p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Gatherings</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#101828]">Upcoming calendar</h2>
            </div>
            {site.gatherings.map(([name, date, status]) => (
              <div key={name} className="grid grid-cols-[1fr_90px_120px] gap-3 border-b border-[#edf0ea] p-4 text-sm last:border-b-0">
                <div className="font-semibold text-[#101828]">{name}</div>
                <div className="text-[#667085]">{date}</div>
                <div className="font-medium text-[#17453b]">{status}</div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-[#d2d8ce] bg-white">
            <div className="border-b border-[#edf0ea] p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Documents</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#101828]">Recently used</h2>
            </div>
            {site.documents.map(([name, audience, status]) => (
              <div key={name} className="grid grid-cols-[1fr_90px_90px] gap-3 border-b border-[#edf0ea] p-4 text-sm last:border-b-0">
                <div className="font-semibold text-[#101828]">{name}</div>
                <div className="text-[#667085]">{audience}</div>
                <div className="font-medium text-[#17453b]">{status}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="governance" className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Governed operations</p>
          <h2 className="mt-1 text-3xl font-semibold text-[#101828]">Admin oversight without flattening the roles</h2>
          <p className="mt-3 text-sm leading-6 text-[#667085]">
            Administrators keep the Alliance in order, but the work is shared. Churches update their records,
            pastors and leaders coordinate ministry, and members stay connected to gatherings and resources.
          </p>
        </div>
        <div className="rounded-md border border-[#d2d8ce] bg-white">
          {site.today.map(([time, item]) => (
            <div key={item} className="grid grid-cols-[96px_1fr] border-b border-[#edf0ea] p-4 last:border-b-0">
              <div className="text-sm font-semibold text-[#17453b]">{time}</div>
              <div className="text-sm text-[#344054]">{item}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="queues" className="border-y border-[#d9ded6] bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Work queues</p>
              <h2 className="mt-1 text-3xl font-semibold text-[#101828]">What each group is carrying now</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[#667085]">
              These are the everyday handoffs that keep churches, leaders, members, and administrators moving together.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            {site.work_queues.map(([lane, title, detail, status]) => (
              <article key={lane} className="rounded-md border border-[#e0e4dc] bg-[#fbfcfa] p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#7a4d16]">{lane}</div>
                <h3 className="mt-2 font-semibold text-[#101828]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#667085]">{detail}</p>
                <div className="mt-3 inline-flex rounded-md bg-[#e8f1ed] px-2 py-1 text-xs font-semibold text-[#17453b]">
                  {status}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      </>
      )}

      {activeView === "records" && (
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-[#d2d8ce] bg-white">
          <div className="border-b border-[#edf0ea] p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Pastors and leaders</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#101828]">Council table</h2>
          </div>
          {site.pastor_council.map(([title, detail, action]) => (
            <div key={title} className="grid grid-cols-[1fr_96px] gap-3 border-b border-[#edf0ea] p-4 last:border-b-0">
              <div>
                <div className="font-semibold text-[#101828]">{title}</div>
                <div className="mt-1 text-sm text-[#667085]">{detail}</div>
              </div>
              <div className="self-start rounded-md border border-[#d0d5dd] px-3 py-2 text-center text-sm font-semibold text-[#344054]">
                {action}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-[#d2d8ce] bg-white">
          <div className="border-b border-[#edf0ea] p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Members</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#101828]">Resources and requests</h2>
          </div>
          {site.member_resources.map(([title, status, action]) => (
            <div key={title} className="grid grid-cols-[1fr_90px_110px] gap-3 border-b border-[#edf0ea] p-4 text-sm last:border-b-0">
              <div className="font-semibold text-[#101828]">{title}</div>
              <div className="text-[#667085]">{status}</div>
              <div className="font-medium text-[#17453b]">{action}</div>
            </div>
          ))}
        </div>
      </section>
      )}

      {activeView === "drafts" && (
      <>
      <section id="forms" className="border-t border-[#d9ded6] bg-[#edf0ea] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Open forms</p>
            <h2 className="mt-1 text-3xl font-semibold text-[#101828]">Send updates and requests</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {site.forms.map(([title, body]) => (
              <article key={title} className="rounded-md border border-[#d2d8ce] bg-white p-4">
                <h3 className="font-semibold text-[#101828]">{title}</h3>
                <p className="mt-2 min-h-[72px] text-sm leading-6 text-[#667085]">{body}</p>
                <button type="button" className="mt-4 w-full rounded-md bg-[#17453b] px-3 py-2 text-sm font-semibold text-white">
                  Open
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --- PHASE3_SITE_FORMS:START --- */}
      <section id="phase3" className="border-t border-[#d9ded6] bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">Phase 3 operations</p>
              <h2 className="mt-1 text-3xl font-semibold text-[#101828]">Create and edit local drafts</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[#667085]">
              These forms follow the Phase 2 data contract. They keep records in this browser session only
              until the Alliance approves private auth and persistent storage.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-md border border-[#d2d8ce] bg-[#fbfcfa] p-3">
              <div className="grid gap-2">
                {dataModel.entities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => {
                      setActiveOperation(entity.id);
                      setFormDraft({});
                    }}
                    className={`rounded-md border px-3 py-3 text-left text-sm ${
                      activeOperation === entity.id
                        ? "border-[#17453b] bg-[#17453b] text-white"
                        : "border-[#d0d5dd] bg-white text-[#344054]"
                    }`}
                  >
                    <span className="block font-semibold">{entity.label}</span>
                    <span className="mt-1 block text-xs opacity-80">{entity.route}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-[#d2d8ce] bg-white">
              <div className="border-b border-[#edf0ea] p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#7a4d16]">{activeEntity?.local_dataset}</p>
                <h3 className="mt-1 text-2xl font-semibold text-[#101828]">{activeEntity?.label} draft</h3>
                <p className="mt-2 text-sm leading-6 text-[#667085]">
                  Mock route: {activeEntity?.route}. Access rules are declared, but enforcement waits for Phase 5 auth.
                </p>
              </div>
              <form onSubmit={saveLocalDraft} className="grid gap-4 p-4 md:grid-cols-2">
                {formFields.map((field) => (
                  <label key={field} className="grid gap-2 text-sm font-semibold text-[#344054]">
                    <span>{field.replace(/_/g, " ")}</span>
                    <input
                      value={formDraft[field] || ""}
                      onChange={(event) => updateFormDraft(field, event.target.value)}
                      className="h-10 rounded-md border border-[#d0d5dd] px-3 text-sm font-normal text-[#101828] outline-none focus:border-[#17453b]"
                      placeholder={`Enter ${field.replace(/_/g, " ")}`}
                    />
                  </label>
                ))}
                <div className="md:col-span-2">
                  <button type="submit" className="rounded-md bg-[#17453b] px-4 py-2 text-sm font-semibold text-white">
                    Save local draft
                  </button>
                </div>
              </form>
              <div className="border-t border-[#edf0ea] p-4">
                <div className="mb-3 text-sm font-semibold text-[#101828]">Local draft queue</div>
                {localDrafts.length === 0 ? (
                  <p className="text-sm leading-6 text-[#667085]">No drafts in this browser session.</p>
                ) : (
                  <div className="grid gap-2">
                    {localDrafts.map((draft) => (
                      <div key={draft.id} className="rounded-md border border-[#e0e4dc] bg-[#fbfcfa] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-[#101828]">{draft.label}</div>
                          <div className="rounded-md bg-[#e8f1ed] px-2 py-1 text-xs font-semibold text-[#17453b]">
                            {draft.status}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-[#667085]">{draft.local_dataset}</div>
                        {draft.server_record_id && (
                          <div className="mt-1 text-xs text-[#667085]">{draft.server_record_id}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* --- PHASE3_SITE_FORMS:END --- */}
      </>
      )}

      {activeView === "access" && (
      <section id="access" className="border-t border-[#d9ded6] bg-[#17453b]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 text-white sm:px-6 lg:grid-cols-[1fr_0.7fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Ready for today's Alliance work.</h2>
            <p className="mt-2 text-sm leading-6 text-[#d8e7e2]">
              Sign in to continue with church updates, leadership items, member requests, documents,
              approvals, and upcoming gatherings.
            </p>
            <p className="mt-3 text-sm leading-6 text-[#d8e7e2]">{site.auth.later_note}</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <span className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#17453b]">Open items: 8</span>
            <span className="rounded-md border border-[#8fb8ac] px-4 py-2 text-sm font-semibold text-white">
              Gatherings: 7
            </span>
          </div>
        </div>
      </section>
      )}
      {/* --- PHASE4_ROUTED_VIEWS:END --- */}
    </main>
  );
}

export default App;
