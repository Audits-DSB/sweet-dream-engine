import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const extKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY");
    if (!extUrl || !extKey) {
      return new Response(JSON.stringify({ error: "External Supabase credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = createClient(extUrl, extKey);

    // Try all three table names
    const tables = ["materials", "products", "items"];
    const results: Record<string, any> = {};

    for (const table of tables) {
      const { data, error } = await ext.from(table).select("*").limit(5);
      if (!error && data) {
        results[table] = { count: data.length, sample: data, columns: data.length > 0 ? Object.keys(data[0]) : [] };
      } else {
        results[table] = { error: error?.message };
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
