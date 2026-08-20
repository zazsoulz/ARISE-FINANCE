import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED = ["USD", "EUR", "RUB"] as const;

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { "accept": "application/json" },
    });
    if (!response.ok) throw new Error(`FX provider HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.result !== "success" || !payload?.rates) {
      throw new Error("FX provider returned an invalid response");
    }

    const rates: Record<string, number> = { USD: 1 };
    for (const code of ALLOWED) {
      const value = Number(payload.rates[code]);
      if (!Number.isFinite(value) || value <= 0) throw new Error(`Missing ${code} rate`);
      rates[code] = value;
    }

    const fetchedAt = payload.time_last_update_unix
      ? new Date(Number(payload.time_last_update_unix) * 1000).toISOString()
      : new Date().toISOString();

    return new Response(JSON.stringify({
      base: "USD",
      rates,
      fetchedAt,
      source: "open.er-api.com",
    }), {
      headers: {
        "content-type": "application/json",
        "cache-control": "private, max-age=900",
      },
    });
  } catch (error) {
    console.error("ARISE fx-rates", error);
    return new Response(JSON.stringify({ error: "Exchange rates are temporarily unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
});
