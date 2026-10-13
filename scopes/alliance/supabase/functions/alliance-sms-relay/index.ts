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
const unknownIntentReply = "I’m learning this request now and will shape it into a known Alliance route.";
const sectionStubReply = "Ok, we're still working on that section. We'll let you know once it is ready.";
const eventsApiUrl = trimSlash(Deno.env.get("ALLIANCE_EVENTS_API_URL") || `${hubBaseUrl}/api/events?canonical=true`);
const regexPilotPhones = parsePilotPhones(
  Deno.env.get("ALLIANCE_REGEX_TEST_PHONES")
    || Deno.env.get("ALLIANCE_REGEX_TEST_PHONE")
    || "9379854448",
);

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
      const pulse = await forwardPulse({
        bridge: String(url.searchParams.get("bridge") || body.bridge || ""),
        type: String(body.type || "minute"),
        timestamp: Number(body.timestamp || Date.now()),
        battery: body.battery,
      });
      // The guide has no clock of its own; the phone's minute pulse is the only
      // thing that arrives on time. Never allowed to fail the pulse.
      if (guideEnabled()) await sweepGuide().catch(() => null);
      return json(pulse);
    }

    if (route === "/guide/next" && req.method === "GET") {
      return json(await nextGuideQuestion());
    }

    if (route === "/guide/answer" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      return json(await applyGuideAnswer(required(body.id, "id"), body.response));
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

// Carrier consent keywords. Whole-message match only, never a substring, so a
// sentence containing "stop" never unsubscribes anybody. Kept byte-identical to
// the normalization in Alliance Hub and Telechurch's sms-bridge-inbound: if the
// three disagree, one acts on a keyword another ignores.
const SMS_CONSENT_KEYWORDS = new Set([
  "stop", "stopall", "unsubscribe", "cancel", "end", "quit",
  "start", "unstop", "yes",
]);

function isSmsConsentKeyword(body: string) {
  const normalized = String(body || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return SMS_CONSENT_KEYWORDS.has(normalized);
}

/**
 * Hands a consent keyword to Alliance Hub, which owns keyword policy and
 * forwards it on to Telechurch.
 *
 * THIS WAS THE MISSING HOP. The relay stored every inbound message and advanced
 * profile intake, but never called the Hub - so `/phone/inbound` was a live
 * route nothing in production ever reached, and no STOP or START on this line
 * has been honoured since the bridge was built. A real STOP from a member has
 * been sitting unactioned in alliance_sms_inbox since 2026-07-26.
 *
 * ONLY KEYWORDS ARE FORWARDED, deliberately. Forwarding every message would put
 * the Hub's conversational router and this function's own advanceProfileIntake
 * on the same text, and the bridge multiplexer doc is explicit that the relay
 * must not produce a second copy of a reply. Consent is the one thing the Hub
 * must see and the relay cannot decide, so consent is the one thing that goes.
 *
 * Never throws: a keyword is already stored by the time this runs, and losing
 * the whole inbound because the Hub was slow would trade a working record for a
 * failed one.
 */
async function forwardConsentKeywordToHub(from: string, body: string) {
  try {
    const response = await fetch(`${hubBaseUrl}/phone/inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Dispatcher-Token": relayToken,
      },
      body: JSON.stringify({ from, body, transport: "sms", registered: false }),
    });
    const hubBody = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, result: hubBody };
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message || error) };
  }
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

  // A consent keyword goes to the Hub and stops there - it is an instruction
  // about the number, not a conversation, so running it through profile intake
  // as well would answer it twice.
  if (isSmsConsentKeyword(body)) {
    const consent = await forwardConsentKeywordToHub(from, body);
    return { ok: true, message, consent, profile: { ok: true, routed: false, reason: "sms_consent_keyword" } };
  }

  // The guide, for the test numbers only. A number outside the gate costs no
  // lookup here and goes on exactly as before; so does anything the guide path
  // throws on.
  if (guideEnabled()) {
    const guide = await routeGuideInbound(from, body).catch(() => null);
    if (guide) return { ok: true, message, profile: guide };
  }

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

  const formula = await routeHubFormulaIntent(phone, inbound, normalized);
  if (formula) return formula;

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

  return {
    ok: true,
    routed: true,
    reason,
    script_id: "alliance.sms_unknown_intent.v1",
    router_script_id: "alliance.sms_router.v1",
    suggested_script_id: suggestedScriptId,
    intake_gap: gap,
    delivery: {
      ok: true,
      skipped: true,
      reason: "ai_handoff_only",
    },
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
  if (isRegexPilotPhone(phone)) {
    const regexRoute = await routeHubFormulaIntent(phone, inbound, normalized);
    if (regexRoute) return regexRoute;
  }
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
      delivery: {
        ok: true,
        skipped: true,
        reason: "hub_response_already_queued",
      },
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

function parsePilotPhones(value: string) {
  return new Set(
    String(value || "")
      .split(/[,\s]+/)
      .map((item) => onlyDigits(item))
      .filter((item) => item.length >= 10 && item.length <= 15),
  );
}

function isRegexPilotPhone(phone: string) {
  const digits = onlyDigits(phone);
  return regexPilotPhones.has(digits);
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

// ---- The guide: an answerer beside the carrier, gated to test numbers -------
//
// Design: refer-script-factory docs/sms-answerer-slot/README.md. Contract:
// assistant/1 (Telechurch, refer.app/refer.telechurch.assistant.contract.md).
//
// The relay is the DOOR. It never writes an answer. It writes the question down,
// an answerer somewhere collects it (/guide/next), and what comes back
// (/guide/answer) is sent unchanged or refused. The answerer is never given the
// sender's number.
//
// THE GATE. Nothing here runs unless both a visitor list and a pastor number are
// configured as secrets, and then only for those numbers. Every text this block
// sends goes through guideSend, which refuses any other destination - so a bug
// in here cannot text a stranger.
//
// To switch the guide off: unset ALLIANCE_GUIDE_TEST_VISITOR_PHONES and redeploy.
const guideVisitorPhones = new Set(
  String(Deno.env.get("ALLIANCE_GUIDE_TEST_VISITOR_PHONES") || "")
    .split(/[,\s]+/)
    .map((item) => lastTen(item))
    .filter((item) => item.length === 10),
);
const guidePastorPhone = lastTen(Deno.env.get("ALLIANCE_GUIDE_TEST_PASTOR_PHONE") || "");
const guideChurchId = String(Deno.env.get("ALLIANCE_GUIDE_CHURCH_ID") || "").trim();
const guideChurchName = String(Deno.env.get("ALLIANCE_GUIDE_CHURCH_NAME") || "").trim() || "the church";
// A guess, recorded as one in the contract's section 7: a sleeping phone takes
// 15 to 30 seconds a reply, and so does the first reply after the cards change.
const guideWaitSeconds = Math.max(20, Number(Deno.env.get("ALLIANCE_GUIDE_WAIT_SECONDS") || 90));
// Proposed at 24 hours and not ruled, so it is a setting.
const guideNudgeMinutes = Math.max(1, Number(Deno.env.get("ALLIANCE_GUIDE_NUDGE_MINUTES") || 1440));

const GUIDE_ENTITY = "sms_guide_question";
const GUIDE_REASONS = new Set(["crisis", "care", "asked_for_pastor", "not_saved", "fault"]);
// The contract's two fixed sentences for a door (section 5). Not to be reworded here.
const guideUnreachableReply = () =>
  `Thank you for your message. I am passing it to the pastor of ${guideChurchName}, who will respond to you.`;
const guideNotForgottenReply = () =>
  `Your message is with the pastor of ${guideChurchName} and has not been forgotten. A pastor will respond to you.`;
const guideCrisisLine = "If you are in danger or thinking of harming yourself, call or text 988 now, or call 911.";
// The door's own list. It decides nothing about the reply: it is the second
// guard of rule 3, used only when the answerer faulted or never came back.
const GUIDE_CRISIS_WORDS =
  /(kill(ing)? myself|suicid|end(ing)? (my life|it all)|better off without me|can'?t (keep going|go on)|think i can keep going|(hurt|harm)(ing)? myself|want to die|no reason to live|nobody would notice if i was gone)/i;

function lastTen(value: unknown) {
  return onlyDigits(String(value || "")).slice(-10);
}

function guideEnabled() {
  return guideVisitorPhones.size > 0 && guidePastorPhone.length === 10;
}

function guideHasCrisisLine(text: string) {
  return /\b988\b/.test(text) && /\b911\b/.test(text);
}

async function guideSend(to: string, message: string, raw: Record<string, unknown>) {
  const ten = lastTen(to);
  if (!(guideVisitorPhones.has(ten) || ten === guidePastorPhone)) {
    throw new Error("guide_refused_destination_outside_gate");
  }
  return queueSms(onlyDigits(to), message, { source: "alliance_sms_guide", ...raw });
}

async function routeGuideInbound(from: string, body: string) {
  const ten = lastTen(from);
  const inbound = String(body || "").trim();
  if (!inbound) return null;
  if (ten === guidePastorPhone) return routeGuidePastorReply(from, inbound);
  if (!guideVisitorPhones.has(ten)) return null;
  // RESET stays what it is today, so a test number can still restart its profile.
  if (isResetCommand(inbound)) return null;

  const phone = onlyDigits(from);
  const earlier = await rest(`/alliance_records?entity=eq.${GUIDE_ENTITY}&values->>visitor_phone=eq.${encodeURIComponent(phone)}&limit=1&select=id`);
  const inserted = await rest("/alliance_records?select=id", {
    method: "POST",
    body: {
      entity: GUIDE_ENTITY,
      label: `SMS guide question ${phone}`,
      route: `alliance-sms-guide:${phone}:${Date.now().toString(36)}`,
      local_dataset: "alliance-sms-guide",
      status: "waiting",
      values: {
        contract: "assistant/1",
        door: "sms",
        church_id: guideChurchId,
        church_name: guideChurchName,
        visitor_phone: phone,
        question: inbound,
        first_contact: !(Array.isArray(earlier) && earlier.length),
        door_reads_crisis: GUIDE_CRISIS_WORDS.test(inbound),
        asked_at: new Date().toISOString(),
      },
    },
  });
  const record = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!record?.id) throw new Error("guide_question_not_stored");
  return {
    ok: true,
    routed: true,
    reason: "guide_question_waiting",
    script_id: "alliance.sms_guide.v1",
    question_id: record.id,
    delivery: { ok: true, skipped: true, reason: "waiting_for_answerer" },
  };
}

// Moves a record from one of `fromStatuses` to `toStatus` and reports whether
// THIS call moved it. Two pulses, or a late answer racing a timeout, must not
// both send.
async function guideClaim(id: string, fromStatuses: string[], toStatus: string, values?: Record<string, unknown>) {
  const body: Record<string, unknown> = { status: toStatus };
  if (values) body.values = values;
  const rows = await rest(`/alliance_records?id=eq.${encodeURIComponent(id)}&entity=eq.${GUIDE_ENTITY}&status=in.(${fromStatuses.join(",")})&select=id,status,values`, {
    method: "PATCH",
    body,
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function nextGuideQuestion() {
  if (!guideEnabled()) return { ok: true, question: null, guide: "off" };
  const rows = await rest(`/alliance_records?entity=eq.${GUIDE_ENTITY}&status=eq.waiting&order=created_at.asc&limit=1&select=id,values,created_at`);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return { ok: true, question: null };
  const claimed = await guideClaim(row.id, ["waiting"], "claimed");
  if (!claimed) return { ok: true, question: null };
  const values = (row.values || {}) as Record<string, unknown>;
  // Exactly the contract's "what goes in", less the cards, which the collector
  // holds. No number, no name, no history.
  return {
    ok: true,
    question: {
      id: row.id,
      contract: "assistant/1",
      door: "sms",
      church_id: values.church_id || "",
      question: values.question || "",
      first_contact: Boolean(values.first_contact),
    },
  };
}

function guideReadResponse(response: unknown) {
  const r = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
  const text = typeof r.text === "string" ? r.text.trim() : "";
  if (r.contract !== "assistant/1" || !text || text.length > 900) return null;
  if (r.kind === "answer") {
    // Rule 6: an answer that names no saved fact is refused.
    const used = Array.isArray(r.used_facts) ? r.used_facts.filter((id) => typeof id === "string" && id) : [];
    return used.length ? { kind: "answer" as const, text, used_facts: used } : null;
  }
  if (r.kind === "handoff") {
    const handoff = (r.handoff && typeof r.handoff === "object" ? r.handoff : {}) as Record<string, unknown>;
    const reason = String(handoff.reason || "");
    if (!GUIDE_REASONS.has(reason)) return null;
    return {
      kind: "handoff" as const,
      text,
      reason,
      urgent: reason === "crisis",
      decided_by: String(handoff.decided_by || ""),
      gap: r.gap && typeof r.gap === "object" ? r.gap : null,
    };
  }
  return null;
}

async function applyGuideAnswer(id: string, response: unknown) {
  if (!guideEnabled()) return { ok: true, applied: false, reason: "guide_off" };
  const held = await guideClaim(id, ["waiting", "claimed"], "answering");
  // Already timed out and handed to the pastor, or answered twice.
  if (!held) return { ok: true, applied: false, reason: "late_or_unknown" };
  const values = (held.values || {}) as Record<string, unknown>;
  const read = guideReadResponse(response);
  if (!read) return guideHandOff(id, values, { text: "", reason: "fault", urgent: false, source: "refused_response", refused: response });
  if (read.kind === "answer") {
    const delivery = await guideSend(String(values.visitor_phone), read.text, { question_id: id, kind: "answer" });
    await rest(`/alliance_records?id=eq.${encodeURIComponent(id)}&select=id`, {
      method: "PATCH",
      body: {
        status: "answered",
        values: { ...values, response: { kind: "answer", text: read.text, used_facts: read.used_facts }, answered_at: new Date().toISOString() },
      },
    });
    return { ok: true, applied: true, kind: "answer", delivery };
  }
  return guideHandOff(id, values, { ...read, source: "answerer" });
}

// One handoff: the visitor hears the fixed words, the pastor is told, and the
// question stays open with its age until the pastor replies.
async function guideHandOff(
  id: string,
  values: Record<string, unknown>,
  h: { text: string; reason: string; urgent: boolean; source: string; decided_by?: string; gap?: unknown; refused?: unknown },
) {
  const question = String(values.question || "");
  const doorCrisis = Boolean(values.door_reads_crisis);
  const urgent = h.urgent || (h.reason === "fault" && doorCrisis);
  let text = h.text || guideUnreachableReply();
  // Rule 3: add the crisis line only when it is absent. Never twice.
  if (urgent && !guideHasCrisisLine(text)) text = `${text} ${guideCrisisLine}`;

  const open = await rest(`/alliance_records?entity=eq.${GUIDE_ENTITY}&status=eq.handoff_open&select=id,values`);
  const taken = new Set((Array.isArray(open) ? open : []).map((row) => Number(row?.values?.handoff?.short_no || 0)));
  let shortNo = 1;
  while (taken.has(shortNo)) shortNo += 1;

  const nowIso = new Date().toISOString();
  await rest(`/alliance_records?id=eq.${encodeURIComponent(id)}&select=id`, {
    method: "PATCH",
    body: {
      status: "handoff_open",
      values: {
        ...values,
        response: { kind: "handoff", text, reason: h.reason, urgent, decided_by: h.decided_by || "", source: h.source },
        gap: h.gap || null,
        refused_response: h.refused || null,
        handoff: { reason: h.reason, urgent, short_no: shortNo, opened_at: nowIso },
      },
    },
  });

  const visitor = await guideSend(String(values.visitor_phone), text, { question_id: id, kind: "handoff", reason: h.reason });
  // INFERRED, for the operator to overturn: the pastor is shown the visitor's
  // words (it is the pastor's job to answer them) and never the visitor's number.
  const notice = [
    `${urgent ? "URGENT. " : ""}Telechurch Live: someone texted ${guideChurchName} and needs you (#${shortNo}).`,
    `They wrote: "${question.slice(0, 600)}"`,
    `Reply to this text and your words go back to them. If more than one is open, start with #${shortNo}.`,
  ].join("\n");
  const pastor = await guideSend(guidePastorPhone, notice, { question_id: id, kind: "pastor_notice", short_no: shortNo });
  return { ok: true, applied: true, kind: "handoff", reason: h.reason, urgent, short_no: shortNo, delivery: visitor, pastor_notice: pastor };
}

async function routeGuidePastorReply(from: string, inbound: string) {
  const open = await rest(`/alliance_records?entity=eq.${GUIDE_ENTITY}&status=eq.handoff_open&order=created_at.asc&select=id,values`);
  const rows = Array.isArray(open) ? open : [];
  // Nothing waiting on this pastor: the text is not a reply, and takes today's path.
  if (!rows.length) return null;

  const tagged = inbound.match(/^#\s*(\d{1,3})\b[\s:.)\-]*([\s\S]*)$/);
  let target = null;
  let words = inbound;
  if (tagged) {
    target = rows.find((row) => Number(row?.values?.handoff?.short_no || 0) === Number(tagged[1])) || null;
    words = tagged[2].trim();
  } else if (rows.length === 1) {
    target = rows[0];
  }
  if (!target || !words) {
    // Never guessed. Asked.
    const numbers = rows.map((row) => `#${row?.values?.handoff?.short_no}`).join(", ");
    const ask = `More than one question is open (${numbers}). Start your reply with the number, like: #${rows[0]?.values?.handoff?.short_no} and then your answer.`;
    const delivery = await guideSend(from, ask, { kind: "pastor_which_one" });
    return { ok: true, routed: true, reason: "guide_pastor_reply_unplaced", script_id: "alliance.sms_guide.v1", delivery };
  }

  const values = (target.values || {}) as Record<string, unknown>;
  const closed = await guideClaim(target.id, ["handoff_open"], "handoff_closed", {
    ...values,
    pastor_reply: words,
    handoff: { ...(values.handoff as Record<string, unknown>), closed_at: new Date().toISOString() },
  });
  if (!closed) return null;
  // INFERRED wording, waiting on the guide's name and voice.
  const delivery = await guideSend(String(values.visitor_phone), `From the pastor of ${guideChurchName}: ${words}`, {
    question_id: target.id,
    kind: "pastor_reply",
  });
  const shortNo = (values.handoff as Record<string, unknown>)?.short_no;
  await guideSend(from, `Sent. Your reply to #${shortNo} is on its way to them.`, { question_id: target.id, kind: "pastor_confirm" }).catch(() => null);
  return { ok: true, routed: true, reason: "guide_pastor_reply_delivered", script_id: "alliance.sms_guide.v1", question_id: target.id, delivery };
}

// Run on the phone's pulse. Two jobs: a question nobody collected in time goes
// to the pastor with the fixed sentence, and a pastor who has not replied is
// reminded while the visitor is told, once, that they are not forgotten.
async function sweepGuide() {
  const cutoff = new Date(Date.now() - guideWaitSeconds * 1000).toISOString();
  const stale = await rest(`/alliance_records?entity=eq.${GUIDE_ENTITY}&status=in.(waiting,claimed)&created_at=lt.${encodeURIComponent(cutoff)}&order=created_at.asc&limit=5&select=id`);
  for (const row of Array.isArray(stale) ? stale : []) {
    const held = await guideClaim(row.id, ["waiting", "claimed"], "answering");
    if (!held) continue;
    await guideHandOff(row.id, (held.values || {}) as Record<string, unknown>, { text: "", reason: "fault", urgent: false, source: "answerer_unreachable" }).catch(() => null);
  }

  const open = await rest(`/alliance_records?entity=eq.${GUIDE_ENTITY}&status=eq.handoff_open&order=created_at.asc&limit=20&select=id,values`);
  for (const row of Array.isArray(open) ? open : []) {
    const values = (row.values || {}) as Record<string, unknown>;
    const handoff = (values.handoff || {}) as Record<string, unknown>;
    // Not for an urgent handoff: how fast a crisis must reach a person is unsettled.
    if (handoff.urgent || handoff.nudged_at) continue;
    const openedAt = Date.parse(String(handoff.opened_at || ""));
    if (!Number.isFinite(openedAt) || Date.now() - openedAt < guideNudgeMinutes * 60 * 1000) continue;
    const marked = await guideClaim(row.id, ["handoff_open"], "handoff_open", {
      ...values,
      handoff: { ...handoff, nudged_at: new Date().toISOString() },
    });
    if (!marked) continue;
    // The sentence is only true if the pastor is reminded at the same moment.
    await guideSend(guidePastorPhone, `Reminder: #${handoff.short_no} at ${guideChurchName} is still waiting for your reply. They wrote: "${String(values.question || "").slice(0, 400)}"`, {
      question_id: row.id,
      kind: "pastor_reminder",
    }).catch(() => null);
    await guideSend(String(values.visitor_phone), guideNotForgottenReply(), { question_id: row.id, kind: "not_forgotten" }).catch(() => null);
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
