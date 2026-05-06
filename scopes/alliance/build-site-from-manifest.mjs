#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const manifestPath = resolve("scopes", "alliance", "site-manifest.json");
const phase2Path = resolve("scopes", "alliance", "phase2-data-contract.json");
const appPath = resolve("scopes", "alliance", "site", "App.tsx");
const artifactDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "site");

function applyFields(value, fields) {
  if (typeof value === "string") {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => fields[key] || "");
  }
  if (Array.isArray(value)) return value.map((item) => applyFields(item, fields));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, applyFields(item, fields)]));
  }
  return value;
}

function renderApp(manifest, phase2) {
  const resolved = applyFields(manifest, manifest.site.dynamic_fields);
  const data = JSON.stringify(resolved, null, 2);
  const dataModel = JSON.stringify(phase2 || { entities: [], auth_policy: {}, persistence_strategy: {} }, null, 2);

  return `import { useEffect, useMemo, useState } from "react";
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

const site = ${data};
const dataModel = ${dataModel};

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

function App() {
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
      id: \`draft-\${Date.now()}\`,
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
                className={\`rounded-md px-3 py-2 text-sm font-semibold \${
                  activeView === view.id ? "bg-[#e8f1ed] text-[#17453b]" : "text-[#475467]"
                }\`}
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
              className={\`shrink-0 rounded-md border px-3 py-2 text-sm font-semibold \${
                activeView === view.id
                  ? "border-[#17453b] bg-[#17453b] text-white"
                  : "border-[#d0d5dd] bg-white text-[#344054]"
              }\`}
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
              className={\`rounded-md border px-4 py-2 text-sm font-semibold \${
                activeRole === item.id
                  ? "border-[#17453b] bg-[#17453b] text-white"
                  : "border-[#d0d5dd] bg-white text-[#344054]"
              }\`}
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
                    className={\`rounded-md border px-3 py-3 text-left text-sm \${
                      activeOperation === entity.id
                        ? "border-[#17453b] bg-[#17453b] text-white"
                        : "border-[#d0d5dd] bg-white text-[#344054]"
                    }\`}
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
                      placeholder={\`Enter \${field.replace(/_/g, " ")}\`}
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
`;
}

function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.schema !== "refer.alliance.site-manifest.v1") {
    throw new Error(`Unsupported manifest schema: ${manifest.schema}`);
  }
  const phase2 = existsSync(phase2Path) ? JSON.parse(readFileSync(phase2Path, "utf8")) : null;
  const app = renderApp(manifest, phase2);
  mkdirSync(dirname(appPath), { recursive: true });
  writeFileSync(appPath, app);
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = resolve(artifactDir, `phase1-site-build-${Date.now()}.json`);
  writeFileSync(artifactPath, JSON.stringify({
    schema: "refer.alliance.site-build-artifact.v1",
    ok: true,
    phase: manifest.phase,
    source_manifest: manifestPath,
    source_data_contract: phase2Path,
    output: appPath,
    auth_behavior: manifest.auth.behavior,
    phase3_forms: Boolean(phase2?.entities?.length),
    generated_at: new Date().toISOString(),
    evidence: [
      "site_manifest:loaded",
      phase2 ? "phase2_contract:loaded" : "phase2_contract:missing",
      "dynamic_fields:resolved",
      "app_tsx:generated",
      "auth_behavior:public_now",
      phase2?.entities?.length ? "phase3_site_forms:generated" : "phase3_site_forms:skipped",
      "phase4_routed_views:generated"
    ]
  }, null, 2));
  console.log(JSON.stringify({ ok: true, phase: manifest.phase, manifest: manifestPath, output: appPath, artifact: artifactPath }, null, 2));
}

main();
