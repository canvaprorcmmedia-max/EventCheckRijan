import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Metode tidak diizinkan." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitPepper = Deno.env.get("PORTAL_RATE_LIMIT_PEPPER");

  if (!supabaseUrl || !serviceRoleKey || !rateLimitPepper) {
    console.error("Konfigurasi lookup-invitation belum lengkap.");
    return jsonResponse({ success: false, message: "Layanan portal belum siap." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, message: "Permintaan tidak valid." }, 400);
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) {
    return jsonResponse({ success: false, message: "Link portal tidak valid." }, 400);
  }

  // Format kode baru ER- + 12 karakter. Kode lama yang formatnya berbeda
  // tetap dapat dicari secara persis, dengan batas panjang yang ketat.
  if (!/^[A-Z0-9-]{4,40}$/.test(code)) {
    return jsonResponse({ success: false, message: "Kode undangan tidak ditemukan." }, 404);
  }

  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = req.headers.get("cf-connecting-ip")?.trim() || forwardedFor || "unknown-client";
  const rateKey = await sha256(`${rateLimitPepper}:${clientIp}:${slug}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: allowed, error: rateError } = await supabase.rpc(
    "consume_portal_lookup",
    { p_ip_hash: rateKey },
  );

  if (rateError) {
    console.error("Rate limit check failed:", rateError.message);
    return jsonResponse({ success: false, message: "Layanan pencarian sedang bermasalah. Coba lagi nanti." }, 503);
  }

  if (allowed !== true) {
    return jsonResponse({ success: false, message: "Terlalu banyak percobaan. Silakan coba kembali sekitar 15 menit lagi." }, 429);
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, description, event_date, location, status, portal_slug")
    .eq("portal_slug", slug)
    .maybeSingle();

  if (eventError) {
    console.error("Portal event lookup failed:", eventError.message);
    return jsonResponse({ success: false, message: "Layanan pencarian sedang bermasalah." }, 503);
  }

  // Event arsip tidak menerima pencarian. Draft dan aktif boleh digunakan
  // untuk distribusi undangan sebelum hari acara.
  if (!event || event.status === "archived") {
    return jsonResponse({ success: false, message: "Kode undangan tidak ditemukan." }, 404);
  }

  const { data: guest, error: guestError } = await supabase
    .from("guests")
    .select("name, institution, category, guest_group, invitation_code, invite_token, status")
    .eq("event_id", event.id)
    .eq("invitation_code", code)
    .maybeSingle();

  if (guestError) {
    console.error("Guest lookup failed:", guestError.message);
    return jsonResponse({ success: false, message: "Layanan pencarian sedang bermasalah." }, 503);
  }

  if (!guest) {
    return jsonResponse({ success: false, message: "Kode undangan tidak ditemukan." }, 404);
  }

  // Branding resmi lembaga dan branding event dibaca di server.
  // UUID event tetap tidak dikirim ke browser.
  const [organizationResult, eventBrandingResult, eventAssetsResult] = await Promise.all([
    supabase
      .from("organization_branding")
      .select("organization_name, official_logo_path")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("event_branding")
      .select("color_primary, color_secondary, color_accent, color_background, color_surface, color_text")
      .eq("event_id", event.id)
      .maybeSingle(),
    supabase
      .from("event_branding_assets")
      .select("display_name, object_path")
      .eq("event_id", event.id)
      .eq("show_on_invitation", true)
      .order("sort_order", { ascending: true }),
  ])

  if (organizationResult.error || eventBrandingResult.error || eventAssetsResult.error) {
    console.error("Portal branding lookup warning:",
      organizationResult.error?.message,
      eventBrandingResult.error?.message,
      eventAssetsResult.error?.message,
    )
  }

  const publicStorageUrl = (path: string | null | undefined) => path
    ? supabase.storage.from("eventcheck-branding").getPublicUrl(path).data.publicUrl
    : null

  const organization = organizationResult.data
  const eventBranding = eventBrandingResult.data
  const eventLogos = (eventAssetsResult.data || []).map((asset) => ({
    display_name: asset.display_name,
    logo_url: publicStorageUrl(asset.object_path),
  })).filter((asset) => asset.logo_url !== null)

  // Hanya data milik kode yang cocok yang dikembalikan. Tidak ada daftar tamu,
  // UUID internal, atau data petugas yang dikirim ke browser.
  return jsonResponse({
    success: true,
    event: {
      name: event.name,
      description: event.description,
      event_date: event.event_date,
      location: event.location,
      branding: {
        organization_name: organization?.organization_name || "Riyadlul Jannah",
        official_logo_url: publicStorageUrl(organization?.official_logo_path),
        color_primary: eventBranding?.color_primary || "#2868D8",
        color_secondary: eventBranding?.color_secondary || "#3978DF",
        color_accent: eventBranding?.color_accent || "#20A36F",
        color_background: eventBranding?.color_background || "#F7F9FC",
        color_surface: eventBranding?.color_surface || "#FFFFFF",
        color_text: eventBranding?.color_text || "#172B4D",
        event_logos: eventLogos,
      },
    },
    guest: {
      name: guest.name,
      institution: guest.institution,
      category: guest.category,
      guest_group: guest.guest_group,
      invitation_code: guest.invitation_code,
      invite_token: guest.invite_token,
      status: guest.status,
    },
  });
});
