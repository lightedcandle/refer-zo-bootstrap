import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";

type Mode = "development" | "production";
const app = new Hono();
const proofDir = "./factory";
const proofPath = `${proofDir}/alliance-draft-proof.jsonl`;
loadDotEnvFile(".env.alliance");

const mode: Mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

app.get("/api/hello-zo", (c) => c.json({ msg: "Hello from Zo" }));

app.get("/api/alliance-drafts/status", (c) =>
  c.json({
    ok: true,
    persistence: hasSupabaseEdgeConfig() ? "supabase_edge_with_local_fallback" : "zo_site_local_file",
    target: proofPath,
    supabase_configured: hasSupabaseEdgeConfig(),
    dataset_write_capability: hasSupabaseEdgeConfig() ? "supabase_edge_function_configured" : "not_proven",
    edge_function: process.env.ALLIANCE_SUPABASE_FUNCTION || "alliance-record-write",
    note: "Zo calls a Supabase Edge Function. The service role key remains inside Supabase, not Zo or the browser.",
  }),
);

app.post("/api/alliance-drafts", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const record = {
    id: `site-draft-${Date.now()}`,
    received_at: new Date().toISOString(),
    source: "alliance_phase5_persistence_probe",
    draft: body,
  };
  await mkdir(proofDir, { recursive: true });
  await appendFile(proofPath, `${JSON.stringify(record)}\n`, "utf8");
  const supabase = await callAllianceEdgeFunction(record);
  return c.json({
    ok: true,
    record_id: supabase.id || record.id,
    local_record_id: record.id,
    persistence: supabase.ok ? "supabase" : "zo_site_local_file",
    supabase,
  });
});

app.get("/api/profile-intake/session/:token", (c) => {
  const session = decodeProfileToken(c.req.param("token"));
  if (!session.ok) return c.json(session, 400);
  return c.json({
    ok: true,
    phone: session.phone,
    phone_display: maskPhone(session.phone),
    distinctions: profileDistinctions(),
  });
});

app.post("/api/profile-intake/submit", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const session = decodeProfileToken(String(body.token || ""));
  if (!session.ok) return c.json(session, 400);
  const firstName = cleanText(body.first_name);
  const lastName = cleanText(body.last_name);
  const email = cleanText(body.email);
  const distinction = cleanText(body.distinction);
  const imageUrl = cleanText(body.image_url);
  if (!firstName || !lastName || !distinction) {
    return c.json({ ok: false, error: "missing_required_profile_fields" }, 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ ok: false, error: "invalid_email" }, 400);
  }
  if (!profileDistinctions().includes(distinction)) {
    return c.json({ ok: false, error: "invalid_distinction" }, 400);
  }

  const profileId = `user-${session.phone.slice(-4)}-${Date.now().toString(36)}`;
  const profileValues = {
    id: profileId,
    phone: session.phone,
    first_name: firstName,
    last_name: lastName,
    email: email || null,
    distinction,
    image_url: imageUrl || null,
    sms_authorized: true,
    profile_url: `/profile/${profileId}`,
    source: "alliance_profile_intake_form",
    submitted_at: new Date().toISOString(),
  };

  const profile = await persistAllianceRecord({
    entity: "alliance_profile",
    label: `Alliance profile ${firstName} ${lastName}`,
    route: `alliance-profile:${profileId}`,
    local_dataset: "alliance-profile-intake",
    status: "active",
    values: profileValues,
  });
  const context = await persistAllianceRecord({
    entity: "sms_profile_context",
    label: `SMS profile context ${session.phone}`,
    route: `alliance-profile-context:${session.phone}`,
    local_dataset: "alliance-sms-profile-intake",
    status: "completed",
    values: {
      phone: session.phone,
      script_id: "alliance.profile_setup.sms.v1",
      state: "completed",
      status: "completed",
      form_token: body.token,
      profile_id: profileId,
      profile: profileValues,
      completed_at: new Date().toISOString(),
    },
  });

  return c.json({
    ok: profile.ok,
    profile_id: profileId,
    profile_url: profileValues.profile_url,
    profile,
    context,
  }, profile.ok ? 200 : 502);
});

if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

export default { fetch: app.fetch, port, idleTimeout: 255 };

function loadDotEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function hasSupabaseEdgeConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

function decodeProfileToken(token: string): { ok: true; phone: string } | { ok: false; error: string } {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(token.length / 4) * 4, "=");
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    const phone = String(parsed.p || "").replace(/\D/g, "");
    if (phone.length < 10 || phone.length > 15) return { ok: false, error: "invalid_profile_token" };
    return { ok: true, phone };
  } catch {
    return { ok: false, error: "invalid_profile_token" };
  }
}

function maskPhone(phone: string) {
  return phone.length > 4 ? `***${phone.slice(-4)}` : phone;
}

function cleanText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function profileDistinctions() {
  return [
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
}

async function callAllianceEdgeFunction(record: Record<string, unknown>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, configured: false };
  const draft = (record.draft && typeof record.draft === "object" ? record.draft : {}) as Record<string, unknown>;
  const payload = {
    entity: String(draft.entity || "request"),
    label: String(draft.label || ""),
    route: String(draft.route || ""),
    local_dataset: String(draft.local_dataset || ""),
    values: typeof draft.values === "object" && draft.values ? draft.values : {},
    status: String(draft.status || "draft"),
  };
  const functionName = process.env.ALLIANCE_SUPABASE_FUNCTION || "alliance-record-write";
  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      configured: true,
      edge_function: functionName,
      error: error instanceof Error ? error.message : "supabase_edge_request_failed",
    };
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      configured: true,
      edge_function: functionName,
      status: response.status,
      error: json?.message || json?.error || "supabase_edge_call_failed",
    };
  }
  return {
    ok: true,
    configured: true,
    edge_function: functionName,
    id: Array.isArray(json) ? json[0]?.id : json?.id,
  };
}

async function persistAllianceRecord(draft: Record<string, unknown>) {
  const supabase = await callAllianceEdgeFunction({ draft });
  if (supabase.ok) return { ...supabase, persistence: "supabase" };

  try {
    await mkdir(proofDir, { recursive: true });
    const localRecord = {
      id: `site-record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      received_at: new Date().toISOString(),
      source: "alliance_profile_fallback",
      draft,
      supabase,
    };
    await appendFile(proofPath, `${JSON.stringify(localRecord)}\n`, "utf8");
    return {
      ok: true,
      configured: supabase.configured,
      id: localRecord.id,
      persistence: "zo_site_local_file",
      warning: "supabase_edge_unavailable",
      supabase,
    };
  } catch (error) {
    return {
      ok: false,
      configured: supabase.configured,
      persistence: "failed",
      error: error instanceof Error ? error.message : "profile_fallback_write_failed",
      supabase,
    };
  }
}

function configureProduction(app: Hono) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();

    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/assets/")) return next();

    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) {
        return new Response(file);
      }
    }

    return serveStatic({ path: "./dist/index.html" })(c, next);
  });
}

async function configureDevelopment(app: Hono): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    if (c.req.path === "/favicon.ico") return c.redirect("/favicon.svg", 302);

    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        let template = await Bun.file("./index.html").text();
        template = await vite.transformIndexHtml(url, template);
        return c.html(template, {
          headers: { "Cache-Control": "no-store, must-revalidate" },
        });
      }

      const publicFile = Bun.file(`./public${url}`);
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, {
            headers: { "Cache-Control": "no-store, must-revalidate" },
          });
        }
      }

      let result;
      try {
        result = await vite.transformRequest(url);
      } catch {
        result = null;
      }

      if (result) {
        return new Response(result.code, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store, must-revalidate",
          },
        });
      }

      let template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, {
        headers: { "Cache-Control": "no-store, must-revalidate" },
      });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
}
