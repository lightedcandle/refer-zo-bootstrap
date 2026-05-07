const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dispatcher-token",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || "";
const relayToken = Deno.env.get("ALLIANCE_SMS_RELAY_TOKEN") || "";
const profileBaseUrl = trimSlash(Deno.env.get("ALLIANCE_PROFILE_BASE_URL") || "https://telechurchlive.com/allianceprofile");
const profileUploadBaseUrl = trimSlash(Deno.env.get("ALLIANCE_PROFILE_UPLOAD_BASE_URL") || `${profileBaseUrl}/upload`);
const profileFormBaseUrl = trimSlash(Deno.env.get("ALLIANCE_PROFILE_FORM_BASE_URL") || "https://alliance.telechurchlive.com/profile");
const hubBaseUrl = trimSlash(profileFormBaseUrl.replace(/\/profile$/, ""));
const profileFormSecret = Deno.env.get("ALLIANCE_PROFILE_FORM_SECRET") || relayToken;
const bridgePhoneNumber = onlyDigits(Deno.env.get("ALLIANCE_BRIDGE_PHONE_NUMBER") || "");
const unknownIntentReply = "I'm not sure about that one yet. You can find a full guide on how to use the Alliance Hub here:\nhttps://alliance.telechurchlive.com/help";
const sectionStubReply = "Ok, we're still working on that section. We'll let you know once it is ready.";
const eventsApiUrl = trimSlash(Deno.env.get("ALLIANCE_EVENTS_API_URL") || `${hubBaseUrl}/api/events?canonical=true`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  const url = new URL(req.url);
  const route = routePath(url.pathname);

  if (route === "/health" && req.method === "GET") {
    return json({
      ok: Boolean(supabaseUrl && serviceKey && relayToken),
      service: "alliance-sms-relay",
      tables: ["alliance_sms_outbox", "alliance_sms_inbox", "alliance_sms_delivery_events"],
    });
  }

  if (!authorized(req)) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "sms_relay_not_configured" }, 500);

  try {
    if (route === "/sms/send" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      return json(await queueSms(required(body.to, "to"), required(body.message, "message"), body));
    }

    if (route === "/phone/next" && req.method === "GET") {
      return json(await nextJob());
    }

    if (route === "/phone/report" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      return json(await reportJob(required(body.id, "id"), String(body.status || "unknown"), body.error));
    }

    if (route === "/phone/inbound" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      return json(await recordInbound(required(body.from, "from"), required(body.body, "body"), body.date));
    }

    if (route === "/phone/pulse" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      return json(await forwardPulse({
        bridge: String(url.searchParams.get("bridge") || body.bridge || ""),
        type: String(body.type || "minute"),
        timestamp: Number(body.timestamp || Date.now()),
        battery: body.battery,
      }));
    }

    if (route === "/sms/latest" && req.method === "GET") {
      return json(await latestInbound(required(url.searchParams.get("from"), "from")));
    }

    return json({ ok: false, error: "not_found" }, 404);
  } catch (error) {
    return json({ ok: false, error: error?.message || "sms_relay_failed" }, 500);
  }
});

async function queueSms(to: string, message: string, raw: Record<string, unknown>) {
  const inserted = await rest("/alliance_sms_outbox?select=id,to_phone,message,status,queued_at", {
    method: "POST",
    body: {
      to_phone: to,
      message,
      status: "queued",
      metadata: { source: "alliance_sms_relay", raw },
    },
  });
  const job = Array.isArray(inserted) ? inserted[0] : inserted;
  await writeRecord("outbound", to, message, { transport: "supabase_edge_relay", job_id: job?.id });
  return { ok: true, delivery: "queued_for_phone_relay", job };
}

async function nextJob() {
  const rows = await rest("/alliance_sms_outbox?status=eq.queued&order=queued_at.asc&limit=1&select=id,to_phone,message,status,queued_at");
  const job = Array.isArray(rows) ? rows[0] : null;
  if (!job) return { ok: true, job: null };

  await rest(`/alliance_sms_outbox?id=eq.${encodeURIComponent(job.id)}`, {
    method: "PATCH",
    body: { status: "claimed", claimed_at: new Date().toISOString() },
  });

  return {
    ok: true,
    job: {
      id: job.id,
      to: job.to_phone,
      message: job.message,
      status: "claimed",
      queued_at: job.queued_at,
    },
  };
}

async function reportJob(id: string, status: string, error?: unknown) {
  const patch: Record<string, unknown> = {
    status,
    error: error ? String(error) : null,
    metadata: { reported_at: new Date().toISOString() },
  };
  if (status === "sent") patch.sent_at = new Date().toISOString();

  await rest(`/alliance_sms_outbox?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
  const event = await rest("/alliance_sms_delivery_events?select=id,status", {
    method: "POST",
    body: {
      outbox_id: id,
      status,
      error: error ? String(error) : null,
      metadata: { source: "android_phone_relay" },
    },
  });
  return { ok: true, event: Array.isArray(event) ? event[0] : event };
}

async function recordInbound(from: string, body: string, date: unknown) {
  const messageDate = Number(date || Date.now());
  if (isBridgeSelfPhone(from)) {
    return {
      ok: true,
      ignored: true,
      reason: "bridge_self_message",
      from_phone: from,
      message_date: messageDate,
    };
  }
  const duplicate = await existingInbound(from, body, messageDate);
  if (duplicate) {
    return {
      ok: true,
      ignored: true,
      reason: "duplicate_inbound",
      message: duplicate,
      profile: { ok: true, routed: false, reason: "duplicate_inbound" },
    };
  }
  const inserted = await rest("/alliance_sms_inbox?select=id,from_phone,body,message_date,received_at", {
    method: "POST",
    body: {
      from_phone: from,
      body,
      message_date: messageDate,
      metadata: { source: "android_phone_relay" },
    },
  });
  const message = Array.isArray(inserted) ? inserted[0] : inserted;
  await writeRecord("inbound", from, body, { transport: "supabase_edge_relay", message_date: messageDate });
  const profile = await advanceProfileIntake(from, body);
  return { ok: true, message, profile };
}

async function existingInbound(from: string, body: string, messageDate: number) {
  const digits = onlyDigits(from);
  const rows = await rest(`/alliance_sms_inbox?from_phone=ilike.*${encodeURIComponent(digits)}&message_date=eq.${encodeURIComponent(String(messageDate))}&body=eq.${encodeURIComponent(body)}&limit=1&select=id,from_phone,body,message_date,received_at`);
  return Array.isArray(rows) ? rows[0] : null;
}

async function latestInbound(from: string) {
  const digits = onlyDigits(from);
  const rows = await rest(`/alliance_sms_inbox?from_phone=ilike.*${encodeURIComponent(digits)}&order=message_date.desc&limit=1&select=id,from_phone,body,message_date,received_at`);
  const message = Array.isArray(rows) ? rows[0] : null;
  return { ok: true, message };
}

async function forwardPulse(input: { bridge: string; type: string; timestamp: number; battery?: unknown }) {
  const bridge = onlyDigits(input.bridge);
  const payload = {
    type: input.type || "minute",
    bridge,
    timestamp: Number.isFinite(input.timestamp) ? input.timestamp : Date.now(),
    battery: input.battery,
    transport: "cloud_relay",
  };

  const hubResponse = await fetch(`${hubBaseUrl}/phone/pulse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dispatcher-Token": relayToken,
    },
    body: JSON.stringify(payload),
  });

  const hubBody = await hubResponse.json().catch(() => null);
  await rest("/alliance_records?select=id", {
    method: "POST",
    body: {
      entity: "sms_message",
      label: `SMS pulse ${bridge || "unknown"}`,
      route: "alliance-sms-relay:/phone/pulse",
      local_dataset: "alliance-sms-relay",
      status: hubResponse.ok ? "received" : "failed",
      values: {
        direction: "pulse",
        phone: bridge || null,
        body: JSON.stringify(payload),
        source: "alliance_sms_relay_edge",
        recorded_at: new Date().toISOString(),
        response_status: hubResponse.status,
        response_body: hubBody,
      },
    },
  });

  if (!hubResponse.ok || !hubBody?.ok) {
    return {
      ok: false,
      forwarded: false,
      bridge: bridge || null,
      hub_status: hubResponse.status,
      hub: hubBody,
    };
  }

  return {
    ok: true,
    forwarded: true,
    bridge: bridge || null,
    hub_status: hubResponse.status,
    hub: hubBody,
  };
}

async function writeRecord(direction: string, phone: string, body: string, values: Record<string, unknown>) {
  await rest("/alliance_records?select=id", {
    method: "POST",
    body: {
      entity: "sms_message",
      label: `SMS ${direction} ${phone}`,
      route: `alliance-sms-relay:/sms/${direction}`,
      local_dataset: "alliance-sms-relay",
      status: direction === "outbound" ? "queued" : "received",
      values: {
        direction,
        phone,
        body,
        source: "alliance_sms_relay_edge",
        recorded_at: new Date().toISOString(),
        ...values,
      },
    },
  });
}

async function advanceProfileIntake(from: string, inboundBody: string) {
  const phone = onlyDigits(from);
  const inbound = String(inboundBody || "").trim();
  const existing = await latestProfileContext(phone);
  const publicRoute = await routePublicSmsIntent(phone, inbound);
  if (publicRoute) return publicRoute;
  if (isResetCommand(inbound)) {
    return resetProfileIntake(phone, existing);
  }
  if (isCompletedProfileContext(existing)) {
    const known = await routeRegisteredSmsIntent(phone, inbound, existing);
    if (known) return known;
    const formula = await routeHubFormulaIntent(phone, inbound);
    if (formula) return formula;
    return recordSmsIntakeGap(phone, inbound, "registered_phone_unknown_intent");
  }

  const context = existing || {
    id: null,
    values: {
      phone,
      script_id: "alliance.profile_setup.sms.v1",
      state: "awaiting_start",
      collected_values: {},
      events: [],
      status: "active",
    },
  };

  const values = context.values as ProfileContextValues;
  const transition = await advanceProfileState(values, inbound);
  values.events = [...(values.events || []), {
    direction: "inbound",
    body: inbound,
    at: new Date().toISOString(),
  }, {
    direction: "outbound",
    body: transition.outbound,
    at: new Date().toISOString(),
  }].slice(-50);

  const saved = await saveProfileContext(context.id, phone, values);
  const delivery = transition.outbound ? await queueSms(phone, transition.outbound, {
    source: "alliance_profile_intake",
    script_id: values.script_id,
    state: values.state,
  }) : { ok: true, skipped: true, reason: transition.reason || "no_outbound" };

  let profileRecord = null;
  if (transition.profile) {
    profileRecord = await rest("/alliance_records?select=id,entity,label,status,values", {
      method: "POST",
      body: {
        entity: "alliance_profile",
        label: `Alliance profile ${transition.profile.first_name} ${transition.profile.last_name}`,
        route: `alliance-profile:${transition.profile.id}`,
        local_dataset: "alliance-sms-profile-intake",
        status: "active",
        values: transition.profile,
      },
    });
  }

  return {
    ok: true,
    routed: true,
    state: values.state,
    context_id: saved.id,
    outbound: transition.outbound,
    delivery,
    profile: transition.profile || null,
    profile_record: Array.isArray(profileRecord) ? profileRecord[0] : profileRecord,
  };
}

async function routeRegisteredSmsIntent(phone: string, inbound: string, context: Record<string, unknown>) {
  const normalized = normalizeSmsIntentText(inbound);
  const values = (context.values || {}) as ProfileContextValues;
  const profile = (values.profile || {}) as Record<string, unknown>;
  const firstName = cleanName(profile.first_name) || "there";
  const eventRoute = await routeEventsIntent(phone, inbound, normalized);
  if (eventRoute) return eventRoute;

  if (isGreetingIntent(normalized)) {
    const message = [
      `Hello ${firstName}, how are you today?`,
      "How can I help? You can quickly reply:",
      "Profile, Events, Give, About, My Church, Next Event",
    ].join("\n");
    const delivery = await queueSms(phone, message, {
      source: "alliance_sms_greeting_menu",
      script_id: "alliance.sms_greeting_menu.v1",
      router_script_id: "alliance.sms_router.v1",
    });
    await recordSmsRouteDecision(phone, inbound, {
      script_id: "alliance.sms_greeting_menu.v1",
      normalized_body: normalized,
      response: message,
    });
    return {
      ok: true,
      routed: true,
      reason: "registered_phone_greeting_menu",
      script_id: "alliance.sms_greeting_menu.v1",
      router_script_id: "alliance.sms_router.v1",
      outbound: message,
      delivery,
    };
  }

  if (/\b(profile|account|info|settings|name)\b/.test(normalized) || /\b(update|edit|change)\b/.test(normalized)) {
    const profileIdValue = cleanName(values.profile_id || profile.id);
    const isEdit = /\b(edit|update|change)\b/.test(normalized);
    if (isEdit && profileIdValue) {
      const issuedAt = Date.now();
      const expiresAt = issuedAt + 30 * 60 * 1000;
      const editToken = await createProfileToken({
        p: phone,
        m: "edit",
        pid: profileIdValue,
        iat: issuedAt,
        exp: expiresAt,
      }, profileFormSecret);
      values.edit_form_token = editToken;
      values.edit_form_token_expires_at = new Date(expiresAt).toISOString();
      values.edit_form_token_used_at = null;
      values.edit_requested_at = new Date(issuedAt).toISOString();
      const shortLink = await createShortProfileLink(editToken, {
        mode: "edit",
        phone,
        profile_id: profileIdValue,
        expires_at: values.edit_form_token_expires_at,
      }).catch(() => null);
      const editUrl = shortLink?.short_url || `${profileFormBaseUrl}/${encodeURIComponent(editToken)}`;
      values.edit_form_short_url = editUrl;
      values.edit_form_short_code = shortLink?.code || "";
      await saveProfileContext(String(context.id || "") || null, phone, values);

      const message = [
        "Alliance profile edit link:",
        editUrl,
        "This secure link expires in 30 minutes.",
      ].join("\n");
      const delivery = await queueSms(phone, message, {
        source: "alliance_sms_profile_edit",
        script_id: "alliance.profile_edit.question.v1",
        router_script_id: "alliance.sms_router.v1",
        profile_id: profileIdValue,
      });

      await recordSmsRouteDecision(phone, inbound, {
        script_id: "alliance.profile_edit.question.v1",
        normalized_body: normalized,
        response: message,
        profile_id: profileIdValue,
      });

      return {
        ok: true,
        routed: true,
        reason: "registered_phone_profile_edit_request",
        script_id: "alliance.profile_edit.question.v1",
        router_script_id: "alliance.sms_router.v1",
        outbound: message,
        delivery,
      };
    }

    const message = profileIdValue
      ? [
        "Alliance profile link:",
        `https://alliance.telechurchlive.com/member/${encodeURIComponent(profileIdValue)}`,
        "Open it to view your profile, edit it, or manage your church connection.",
      ].join("\n")
      : unknownIntentReply;
    const delivery = await queueSms(phone, message, {
      source: "alliance_sms_profile_link",
      script_id: "alliance.profile_link.question.v1",
      router_script_id: "alliance.sms_router.v1",
      profile_id: profileIdValue,
    });
    await recordSmsRouteDecision(phone, inbound, {
      script_id: "alliance.profile_link.question.v1",
      normalized_body: normalized,
      response: message,
      profile_id: profileIdValue,
    });
    return {
      ok: true,
      routed: true,
      reason: "registered_phone_profile_link",
      script_id: "alliance.profile_link.question.v1",
      router_script_id: "alliance.sms_router.v1",
      outbound: message,
      delivery,
    };
  }

  const stub = stubIntent(normalized);
  if (!stub) return null;

  const formula = await routeHubFormulaIntent(phone, inbound, normalized);
  if (formula) return formula;

  await recordNotificationInterest(phone, inbound, stub.section, stub.script_id);
  const delivery = await queueSms(phone, sectionStubReply, {
    source: "alliance_sms_section_stub",
    script_id: "alliance.sms_section_stub.v1",
    router_script_id: "alliance.sms_router.v1",
    suggested_script_id: stub.script_id,
    section: stub.section,
  });
  await recordSmsRouteDecision(phone, inbound, {
    script_id: "alliance.sms_section_stub.v1",
    normalized_body: normalized,
    suggested_script_id: stub.script_id,
    section: stub.section,
    response: sectionStubReply,
  });
  return {
    ok: true,
    routed: true,
    reason: "registered_phone_section_stub",
    script_id: "alliance.sms_section_stub.v1",
    router_script_id: "alliance.sms_router.v1",
    suggested_script_id: stub.script_id,
    section: stub.section,
    outbound: sectionStubReply,
    delivery,
  };
}

async function recordSmsRouteDecision(phone: string, inbound: string, values: Record<string, unknown>) {
  await rest("/alliance_records?select=id", {
    method: "POST",
    body: {
      entity: "sms_route_decision",
      label: `SMS route decision ${phone}`,
      route: `alliance-sms-router:${values.script_id || "unknown"}:${phone}`,
      local_dataset: "alliance-sms-intake",
      status: "routed",
      values: {
        phone,
        body: inbound,
        router_script_id: "alliance.sms_router.v1",
        routed_at: new Date().toISOString(),
        ...values,
      },
    },
  });
}

async function recordNotificationInterest(phone: string, inbound: string, section: string, scriptId: string) {
  await rest("/alliance_records?select=id", {
    method: "POST",
    body: {
      entity: "sms_notification_interest",
      label: `SMS notify interest ${section} ${phone}`,
      route: `alliance-notify-interest:${section}:${phone}`,
      local_dataset: "alliance-sms-intake",
      status: "waiting",
      values: {
        phone,
        body: inbound,
        section,
        script_id: "alliance.sms_section_stub.v1",
        requested_script_id: scriptId,
        notify_when_ready: true,
        created_at: new Date().toISOString(),
      },
    },
  });
}

async function recordSmsIntakeGap(phone: string, inbound: string, reason: string) {
  const nowIso = new Date().toISOString();
  const normalized = normalizeSmsIntentText(inbound);
  const suggestedScriptId = suggestSmsScriptId(normalized);
  const gapValues = {
    phone,
    body: inbound,
    normalized_body: normalized,
    reason,
    script_id: "alliance.sms_unknown_intent.v1",
    router_script_id: "alliance.sms_router.v1",
    suggested_script_id: suggestedScriptId,
    suggested_response: unknownIntentReply,
    status: "queued_for_script_factory_review",
    created_at: nowIso,
  };

  const inserted = await rest("/alliance_records?select=id,entity,label,status,values", {
    method: "POST",
    body: {
      entity: "sms_intake_gap",
      label: `SMS intake gap ${phone}`,
      route: `alliance-sms-router:unknown:${phone}`,
      local_dataset: "alliance-sms-intake",
      status: "queued",
      values: gapValues,
    },
  });
  const gap = Array.isArray(inserted) ? inserted[0] : inserted;
  const delivery = await queueSms(phone, unknownIntentReply, {
    source: "alliance_sms_unknown_intent",
    script_id: "alliance.sms_unknown_intent.v1",
    router_script_id: "alliance.sms_router.v1",
    intake_gap_id: gap?.id,
    suggested_script_id: suggestedScriptId,
  });

  return {
    ok: true,
    routed: true,
    reason,
    script_id: "alliance.sms_unknown_intent.v1",
    router_script_id: "alliance.sms_router.v1",
    suggested_script_id: suggestedScriptId,
    outbound: unknownIntentReply,
    intake_gap: gap,
    delivery,
  };
}

function normalizeSmsIntentText(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ");
}

function isGreetingIntent(normalized: string) {
  return /^(hello|hi|hey|hey there|hey alliance|hello alliance|hi alliance)$/.test(normalized);
}

function stubIntent(normalized: string) {
  if (/^(events?|event list|calendar)$/.test(normalized)) {
    return { section: "events", script_id: "alliance.events.section.v1" };
  }
  if (/^(give|giving|donate|offering)$/.test(normalized)) {
    return { section: "give", script_id: "alliance.give.section.v1" };
  }
  if (/^(about|about alliance|the alliance)$/.test(normalized)) {
    return { section: "about", script_id: "alliance.about.section.v1" };
  }
  if (/^(my church|church|organization|my organization)$/.test(normalized)) {
    return { section: "my_church", script_id: "alliance.my_church.section.v1" };
  }
  if (/^(next event|next service|when is the next event|when is church)$/.test(normalized)) {
    return { section: "next_event", script_id: "alliance.next_event.question.v1" };
  }
  return null;
}

function isEventIntent(normalized: string) {
  return /\b(events?|calendar|service|services|upcoming|next event|next service|what is happening|what's happening|meeting|gathering|schedule)\b/.test(normalized);
}

async function fetchUpcomingEvents(limit = 3) {
  try {
    const response = await fetch(eventsApiUrl);
    if (!response.ok) {
      return { ok: false, events: [], source: `events_api_http_${response.status}` };
    }
    const body = await response.json().catch(() => null);
    const rows = Array.isArray(body?.events) ? body.events : [];
    const events = rows
      .filter((event) => String(event?.event_status || "active").toLowerCase() !== "cancelled")
      .filter((event) => {
        const start = parseEventTime(event?.event_start_time || event?.date || event?.startDate);
        return !start || start.getTime() > Date.now();
      })
      .sort((left, right) => {
        const leftTime = parseEventTime(left?.event_start_time || left?.date || left?.startDate).getTime() || 0;
        const rightTime = parseEventTime(right?.event_start_time || right?.date || right?.startDate).getTime() || 0;
        return leftTime - rightTime;
      })
      .slice(0, Math.max(1, Math.min(Number(limit) || 3, 5)));
    return { ok: true, events, source: body?.shape || "canonical" };
  } catch (_error) {
    return { ok: false, events: [], source: "events_api_failed" };
  }
}

function formatEventReply(events: Array<Record<string, unknown>>) {
  const safeEvents = Array.isArray(events) ? events.slice(0, 3) : [];
  if (!safeEvents.length) {
    return [
      "I couldn't find upcoming events right now.",
      `Calendar: ${hubBaseUrl}/calendar`,
    ].join("\n");
  }

  const lines = ["Upcoming events:"];
  for (const event of safeEvents) {
    const title = String(event.event_title || event.title || "Upcoming event");
    const date = formatEventDate(event.event_start_time || event.date || event.startDate);
    const location = String(event.event_location || event.location || "").trim();
    const link = String(event.event_public_url || `${hubBaseUrl}/calendar`);
    const summary = [date, location].filter(Boolean).join(" · ");
    lines.push(summary ? `${title}\n${summary}\n${link}` : `${title}\n${link}`);
  }
  lines.push(`Calendar: ${hubBaseUrl}/calendar`);
  return lines.join("\n");
}

function formatEventDate(value: unknown) {
  if (!value) return "";
  const date = parseEventTime(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function parseEventTime(value: unknown) {
  if (!value) return new Date(NaN);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00`);
  }
  return new Date(raw);
}

async function routePublicSmsIntent(phone: string, inbound: string) {
  const normalized = normalizeSmsIntentText(inbound);
  return routeEventsIntent(phone, inbound, normalized);
}

async function routeEventsIntent(phone: string, inbound: string, normalized?: string) {
  const clean = normalized || normalizeSmsIntentText(inbound);
  if (!isEventIntent(clean)) return null;

  const upcoming = await fetchUpcomingEvents();
  const message = formatEventReply(upcoming.events);
  const delivery = await queueSms(phone, message, {
    source: "alliance_sms_events",
    script_id: "alliance.events.section.v1",
    router_script_id: "alliance.sms_router.v1",
    event_count: upcoming.events.length,
    event_source: upcoming.source,
  });
  await recordSmsRouteDecision(phone, inbound, {
    script_id: "alliance.events.section.v1",
    normalized_body: clean,
    response: message,
    event_count: upcoming.events.length,
    event_source: upcoming.source,
  });
  return {
    ok: true,
    routed: true,
    reason: "events_intent",
    script_id: "alliance.events.section.v1",
    router_script_id: "alliance.sms_router.v1",
    outbound: message,
    delivery,
  };
}

async function routeHubFormulaIntent(phone: string, inbound: string, normalized?: string) {
  const clean = normalized || normalizeSmsIntentText(inbound);
  try {
    const response = await fetch(`${hubBaseUrl}/phone/inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Dispatcher-Token": relayToken,
      },
      body: JSON.stringify({
        from: phone,
        body: inbound,
        date: Date.now(),
        registered: true,
        phone,
        transport: "cloud_relay",
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) return null;

    const outbound = String(
      body.response_text
        || body.clarification_question
        || body.error
        || body.response
        || sectionStubReply,
    ).trim();

    if (!outbound) return null;

    const delivery = await queueSms(phone, outbound, {
      source: "alliance_sms_hub_formula",
      script_id: "alliance.formula.intake.v1",
      router_script_id: "alliance.sms_router.v1",
      normalized_body: clean,
      response_kind: body.response_kind || "",
      execution_mode: body.execution_mode || "",
      clarification_token: body.clarification_token || "",
      formula_id: body.formula?.formula_id || "",
    });
    await recordSmsRouteDecision(phone, inbound, {
      script_id: "alliance.formula.intake.v1",
      normalized_body: clean,
      response: outbound,
      response_kind: body.response_kind || "",
      execution_mode: body.execution_mode || "",
      clarification_token: body.clarification_token || "",
      formula_id: body.formula?.formula_id || "",
    });
    return {
      ok: true,
      routed: true,
      reason: body.response_kind === "clarify" ? "formula_clarify" : "formula_response",
      script_id: "alliance.formula.intake.v1",
      router_script_id: "alliance.sms_router.v1",
      outbound,
      delivery,
      hub: body,
    };
  } catch (_error) {
    return null;
  }
}

function suggestSmsScriptId(normalized: string) {
  if (isGreetingIntent(normalized)) {
    return "alliance.sms_greeting_menu.v1";
  }
  const stub = stubIntent(normalized);
  if (stub) return stub.script_id;
  if (/\b(next|nxt|upcoming)\b/.test(normalized) && /\b(event|service|meeting|calendar)\b/.test(normalized)) {
    return "alliance.next_event.question.v1";
  }
  if (/\b(profile|profle|account)\b/.test(normalized) && /\b(link|edit|change|update|send)\b/.test(normalized)) {
    return "alliance.profile_link.question.v1";
  }
  if (/\b(group|groups|join|class|team)\b/.test(normalized)) {
    return "alliance.group_list.question.v1";
  }
  if (/\b(register|signup|sign up|rsvp)\b/.test(normalized) && /\b(event|service|sunday|meeting)\b/.test(normalized)) {
    return "alliance.event_register.sms.v1";
  }
  return "alliance.sms_script_draft.v1";
}

async function resetProfileIntake(phone: string, existing: Record<string, unknown> | null) {
  const nowIso = new Date().toISOString();
  const values: ProfileContextValues = {
    phone,
    script_id: "alliance.profile_setup.sms.v1",
    state: "awaiting_start",
    status: "active",
    collected_values: {},
    request_count: 0,
    form_token: await profileFormToken(phone),
    form_url: "",
    events: [{
      direction: "system",
      body: "Profile setup reset by SMS command.",
      at: nowIso,
    }],
    reset_at: nowIso,
  };
  values.form_url = `${profileFormBaseUrl}/${encodeURIComponent(values.form_token || "")}`;
  const transition = await advanceProfileState(values, "Hello Alliance");
  values.events = [...(values.events || []), {
    direction: "outbound",
    body: transition.outbound,
    at: new Date().toISOString(),
  }].slice(-50);
  const saved = await saveProfileContext(String(existing?.id || "") || null, phone, values);
  const delivery = transition.outbound ? await queueSms(phone, transition.outbound, {
    source: "alliance_profile_intake_reset",
    script_id: values.script_id,
    state: values.state,
  }) : { ok: true, skipped: true };
  return {
    ok: true,
    routed: true,
    reason: "profile_setup_reset",
    state: values.state,
    context_id: saved.id,
    outbound: transition.outbound,
    delivery,
  };
}

async function latestProfileContext(phone: string) {
  const rows = await rest(`/alliance_records?entity=eq.sms_profile_context&route=eq.${encodeURIComponent(`alliance-profile-context:${phone}`)}&order=updated_at.desc&limit=1&select=id,values`);
  return Array.isArray(rows) ? rows[0] : null;
}

async function saveProfileContext(id: string | null, phone: string, values: ProfileContextValues) {
  const body = {
    entity: "sms_profile_context",
    label: `SMS profile context ${phone}`,
    route: `alliance-profile-context:${phone}`,
    local_dataset: "alliance-sms-profile-intake",
    status: values.status || "active",
    values,
  };
  if (id) {
    const rows = await rest(`/alliance_records?id=eq.${encodeURIComponent(id)}&select=id`, {
      method: "PATCH",
      body,
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }
  const rows = await rest("/alliance_records?select=id", {
    method: "POST",
    body,
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function createShortProfileLink(token: string, options: Record<string, unknown> = {}) {
  const cleanToken = cleanName(token);
  if (!cleanToken) return null;
  const targetPath = `/profile/${encodeURIComponent(cleanToken)}`;
  const nowIso = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = shortCode();
    const existing = await latestShortLink(code).catch(() => null);
    if (existing) continue;
    const inserted = await rest("/alliance_records?select=id", {
      method: "POST",
      body: {
        entity: "alliance_short_link",
        label: `Alliance short link ${code}`,
        route: `alliance-short-link:${code}`,
        local_dataset: "alliance-short-links",
        status: "active",
        values: {
          code,
          token: cleanToken,
          target_path: targetPath,
          mode: cleanName(options.mode),
          profile_id: cleanName(options.profile_id),
          phone: onlyDigits(String(options.phone || "")),
          expires_at: cleanName(options.expires_at),
          created_at: nowIso,
        },
      },
    });
    return {
      code,
      short_url: `${hubBaseUrl}/a/${encodeURIComponent(code)}`,
      record: Array.isArray(inserted) ? inserted[0] : inserted,
    };
  }
  return null;
}

async function latestShortLink(code: string) {
  const rows = await rest(`/alliance_records?entity=eq.alliance_short_link&route=eq.${encodeURIComponent(`alliance-short-link:${code}`)}&order=updated_at.desc&limit=1&select=id,status,values`);
  return Array.isArray(rows) ? rows[0] : null;
}

async function advanceProfileState(values: ProfileContextValues, inbound: string) {
  const command = inbound.toUpperCase();
  values.collected_values = values.collected_values || {};
  values.request_count = Number(values.request_count || 0);
  if (command === "STOP" || command === "CANCEL") {
    values.state = "cancelled";
    values.status = "cancelled";
    return {
      ok: true,
      outbound: "Profile setup cancelled. You can text Hello Alliance later to begin again.",
    };
  }

  if (values.status === "paused") {
    return {
      ok: true,
      reason: "profile_setup_paused",
      outbound: null,
    };
  }

  if (values.state === "completed") {
    return {
      ok: true,
      outbound: "Your Alliance profile is already set up. Thank you.",
    };
  }

  values.request_count += 1;
  values.state = "profile_link_sent";
  values.status = values.request_count >= 3 ? "paused" : "active";
  values.form_token = values.form_token || await profileFormToken(values.phone);
  values.form_url = `${profileFormBaseUrl}/${encodeURIComponent(values.form_token)}`;
  const shortLink = await createShortProfileLink(values.form_token, {
    mode: "register",
    phone: values.phone,
  }).catch(() => null);
  values.short_form_url = shortLink?.short_url || values.form_url;
  values.short_form_code = shortLink?.code || "";
  const smsFormUrl = values.short_form_url || values.form_url;

  if (values.request_count >= 3) {
    return {
      ok: true,
      outbound: [
        "This number is paused from receiving more Alliance profile prompts until setup is complete.",
        "Please click the link below to complete your profile and authorize us to message you.",
        smsFormUrl,
        "Thank you.",
      ].join("\n"),
    };
  }

  if (values.request_count === 2) {
    return {
      ok: true,
      outbound: [
        "Please complete your Alliance profile to gain access.",
        "Your phone number is already attached to this secure form and cannot be changed there.",
        smsFormUrl,
      ].join("\n"),
    };
  }

  return {
    ok: true,
    outbound: [
      "Hi, got your message. Please register here so your message can be passed on to the admin.",
      smsFormUrl,
    ].join("\n"),
  };
}

function isCompletedProfileContext(context: Record<string, unknown> | null) {
  if (!context) return false;
  const values = (context.values || {}) as ProfileContextValues;
  return values.state === "completed" || values.status === "completed" || Boolean(values.profile_id || values.profile);
}

function isResetCommand(value: string) {
  return /^reset$/i.test(String(value || "").trim());
}

function cleanName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateName(value: string, label: string): { ok: true; value: string } | { ok: false; message: string } {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return { ok: false, message: `Please send your ${label}.` };
  if (normalized.length > 80) return { ok: false, message: `That ${label} is too long. Please send a shorter ${label}.` };
  if (!/^[A-Za-z][A-Za-z '\-]*$/.test(normalized)) {
    return { ok: false, message: `Please send only your ${label}. Letters, spaces, apostrophes, and hyphens are okay.` };
  }
  return { ok: true, value: normalized };
}

function profileId(phone: string) {
  return `user-${onlyDigits(phone).slice(-4)}-${crypto.randomUUID().slice(0, 8)}`;
}

async function createProfileToken(claims: Record<string, unknown>, secret: string) {
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signature = await hmacSha256(payload, secret);
  return `v1.${payload}.${base64UrlEncode(signature)}`;
}

async function profileFormToken(phone: string) {
  return createProfileToken({ p: onlyDigits(phone), iat: Date.now() }, profileFormSecret);
}

function base64UrlEncode(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}

async function rest(path: string, init: { method?: string; body?: Record<string, unknown> } = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1${path}`, {
    method: init.method || "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.error || "supabase_rest_failed");
  return data;
}

function authorized(req: Request) {
  return Boolean(relayToken && req.headers.get("x-dispatcher-token") === relayToken);
}

function routePath(pathname: string) {
  const marker = "/alliance-sms-relay";
  const index = pathname.indexOf(marker);
  return index >= 0 ? pathname.slice(index + marker.length) || "/" : pathname;
}

function required(value: unknown, name: string) {
  if (!value) throw new Error(`missing_${name}`);
  return String(value);
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function shortCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  let code = "A";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

function trimSlash(value: string) {
  return String(value || "").replace(/\/$/, "");
}

function isBridgeSelfPhone(from: string) {
  if (!bridgePhoneNumber) return false;
  const fromDigits = onlyDigits(from);
  return fromDigits === bridgePhoneNumber || fromDigits.endsWith(bridgePhoneNumber) || bridgePhoneNumber.endsWith(fromDigits);
}

type ProfileContextValues = {
  phone: string;
  script_id: string;
  state: string;
  status: string;
  collected_values: Record<string, string | null>;
  request_count?: number;
  form_token?: string;
  form_url?: string;
  short_form_url?: string;
  short_form_code?: string;
  events?: Array<Record<string, unknown>>;
  profile?: Record<string, unknown>;
  profile_id?: string;
  edit_form_token?: string | null;
  edit_form_short_url?: string;
  edit_form_short_code?: string;
  edit_form_token_expires_at?: string | null;
  edit_form_token_used_at?: string | null;
  edit_requested_at?: string;
  reset_at?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
