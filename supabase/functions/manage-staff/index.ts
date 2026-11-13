import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return json({ success: false, message: "Metode tidak diizinkan." }, 405);
    }

    const adminId = ctx.userClaims?.id;
    if (!adminId) return json({ success: false, message: "Sesi login tidak valid." }, 401);

    try {
      const { data: admin, error: adminError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("role,is_active")
        .eq("id", adminId)
        .maybeSingle();

      if (adminError || admin?.role !== "admin" || admin.is_active !== true) {
        return json({ success: false, message: "Hanya Admin aktif yang dapat mengelola petugas." }, 403);
      }

      const body = await req.json();
      const action = typeof body.action === "string" ? body.action : "";
      const staffId = typeof body.staff_id === "string" ? body.staff_id : "";

      if (action === "list") {
        const { data: profiles, error: profilesError } = await ctx.supabaseAdmin
          .from("profiles")
          .select("id,full_name,role,is_active")
          .eq("role", "staff")
          .order("full_name", { ascending: true });
        if (profilesError) throw profilesError;

        const { data: assignments, error: assignmentError } = await ctx.supabaseAdmin
          .from("event_staff")
          .select("id,staff_id,event_id,created_at,events:events!event_staff_event_id_fkey(name,status)")
          .order("created_at", { ascending: false });
        if (assignmentError) throw assignmentError;

        const members = await Promise.all((profiles ?? []).map(async (profile) => {
          const { data: authResult } = await ctx.supabaseAdmin.auth.admin.getUserById(profile.id);
          return {
            id: profile.id,
            full_name: profile.full_name,
            is_active: profile.is_active === true,
            email: authResult.user?.email ?? "Email tidak tersedia",
            assignments: (assignments ?? [])
              .filter((row) => row.staff_id === profile.id)
              .map((row) => ({
                id: row.id,
                event_id: row.event_id,
                created_at: row.created_at,
                event_name: Array.isArray(row.events) ? row.events[0]?.name : row.events?.name,
                event_status: Array.isArray(row.events) ? row.events[0]?.status : row.events?.status,
              })),
          };
        }));
        return json({ success: true, staff: members });
      }

      if (!staffId) return json({ success: false, message: "ID petugas tidak valid." }, 400);
      const { data: target, error: targetError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id,full_name,role,is_active")
        .eq("id", staffId)
        .maybeSingle();
      if (targetError || !target || target.role !== "staff") {
        return json({ success: false, message: "Akun petugas tidak ditemukan." }, 404);
      }

      if (action === "remove_assignment") {
        const assignmentId = typeof body.assignment_id === "string" ? body.assignment_id : "";
        if (!assignmentId) return json({ success: false, message: "Penugasan tidak valid." }, 400);
        const { data, error } = await ctx.supabaseAdmin
          .from("event_staff")
          .delete()
          .eq("id", assignmentId)
          .eq("staff_id", staffId)
          .select("id");
        if (error) throw error;
        if (!data?.length) return json({ success: false, message: "Penugasan tidak ditemukan." }, 404);
        return json({ success: true, message: "Penugasan berhasil dihapus." });
      }

      if (action === "deactivate") {
        if (target.is_active === false) {
          return json({ success: true, message: "Akun petugas sudah nonaktif." });
        }

        // Ban Auth terlebih dahulu. Status database menjadi pagar akses utama
        // untuk token lama yang belum kedaluwarsa.
        const { error: banError } = await ctx.supabaseAdmin.auth.admin.updateUserById(
          staffId,
          { ban_duration: "876000h" }
        );
        if (banError) throw banError;

        const { error: profileUpdateError } = await ctx.supabaseAdmin
          .from("profiles")
          .update({ is_active: false })
          .eq("id", staffId)
          .eq("role", "staff");
        if (profileUpdateError) {
          await ctx.supabaseAdmin.auth.admin.updateUserById(staffId, { ban_duration: "none" });
          throw profileUpdateError;
        }

        const { error: deleteAssignmentsError } = await ctx.supabaseAdmin
          .from("event_staff")
          .delete()
          .eq("staff_id", staffId);
        if (deleteAssignmentsError) {
          await ctx.supabaseAdmin.from("profiles").update({ is_active: true }).eq("id", staffId);
          await ctx.supabaseAdmin.auth.admin.updateUserById(staffId, { ban_duration: "none" });
          throw deleteAssignmentsError;
        }

        return json({
          success: true,
          message: "Akun dinonaktifkan. Profil dan seluruh riwayat check-in tetap dipertahankan.",
        });
      }

      if (action === "reset_password") {
        const password = typeof body.password === "string" ? body.password : "";
        if (password.length < 8 || password.length > 128) {
          return json({ success: false, message: "Password baru harus 8–128 karakter." }, 400);
        }
        const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(staffId, { password });
        if (error) throw error;
        return json({ success: true, message: "Password petugas berhasil diperbarui." });
      }

      return json({ success: false, message: "Aksi tidak dikenal." }, 400);
    } catch (error) {
      console.error("manage-staff error:", error);
      return json({
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      }, 500);
    }
  }),
};
