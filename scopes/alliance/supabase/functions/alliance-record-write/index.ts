const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "supabase_edge_not_configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const payload = normalizePayload(body);
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/alliance_records?select=id`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return json({
      ok: false,
      status: response.status,
      error: data?.message || data?.error || "alliance_record_insert_failed",
    }, 502);
  }

  return json({
    ok: true,
    id: Array.isArray(data) ? data[0]?.id : data?.id,
  });
});

function normalizePayload(input: Record<string, unknown>) {
  const values = typeof input.values === "object" && input.values ? input.values : {};
  return {
    entity: String(input.entity || "request"),
    label: String(input.label || ""),
    route: String(input.route || ""),
    local_dataset: String(input.local_dataset || ""),
    values,
    status: String(input.status || "draft"),
  };
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
