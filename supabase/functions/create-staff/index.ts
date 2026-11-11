
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { success: false, message: "Metode tidak diizinkan." },
        { status: 405 }
      );
    }

    const userId = ctx.userClaims?.id;

    if (!userId) {
      return Response.json(
        { success: false, message: "Sesi login tidak valid." },
        { status: 401 }
      );
    }

    try {
      const body = await req.json();

      const fullName =
        typeof body.full_name === "string" ? body.full_name.trim() : "";
      const email =
        typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password =
        typeof body.password === "string" ? body.password : "";
      const eventId =
        typeof body.event_id === "string" ? body.event_id : "";

      if (!fullName || !email || !password || !eventId) {
        return Response.json(
          { success: false, message: "Semua kolom wajib diisi." },
          { status: 400 }
        );
      }

      if (fullName.length > 120 || !email.includes("@")) {
        return Response.json(
          { success: false, message: "Nama atau email tidak valid." },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return Response.json(
          {
            success: false,
            message: "Password awal minimal 8 karakter."
          },
          { status: 400 }
        );
      }

      // 1. Pastikan pemanggil adalah Admin.
      const { data: adminProfile, error: adminError } =
        await ctx.supabase
          .from("profiles")
          .select("id, role")
          .eq("id", userId)
          .maybeSingle();

      if (adminError || adminProfile?.role !== "admin") {
        return Response.json(
          {
            success: false,
            message: "Hanya Admin yang boleh membuat akun Petugas."
          },
          { status: 403 }
        );
      }

      // 2. Pastikan acara tersedia dan belum diarsipkan.
      const { data: event, error: eventError } =
        await ctx.supabase
          .from("events")
          .select("id, name, status")
          .eq("id", eventId)
          .maybeSingle();

      if (eventError || !event) {
        return Response.json(
          { success: false, message: "Acara tidak ditemukan." },
          { status: 404 }
        );
      }

      if (event.status === "archived") {
        return Response.json(
          {
            success: false,
            message: "Petugas tidak dapat ditugaskan ke acara arsip."
          },
          { status: 400 }
        );
      }

      // 3. Buat akun Supabase Auth.
      const { data: authData, error: authError } =
        await ctx.supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName
          }
        });

      if (authError || !authData.user) {
        return Response.json(
          {
            success: false,
            message: authError?.message ?? "Gagal membuat akun Petugas."
          },
          { status: 400 }
        );
      }

      const newStaffId = authData.user.id;

      // 4. Buat profil Petugas.
      const { error: profileError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .insert({
            id: newStaffId,
            full_name: fullName,
            role: "staff"
          });

      if (profileError) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(newStaffId);

        return Response.json(
          {
            success: false,
            message: "Gagal membuat profil Petugas."
          },
          { status: 500 }
        );
      }

      // 5. Hubungkan Petugas dengan acara.
      const { error: assignmentError } =
        await ctx.supabaseAdmin
          .from("event_staff")
          .insert({
            event_id: eventId,
            staff_id: newStaffId,
            assigned_by: userId
          });

      if (assignmentError) {
        // Bersihkan profil dan akun Auth jika penugasan gagal.
        await ctx.supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", newStaffId);

        await ctx.supabaseAdmin.auth.admin.deleteUser(newStaffId);

        return Response.json(
          {
            success: false,
            message: "Gagal menghubungkan Petugas dengan acara."
          },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        message: "Akun Petugas berhasil dibuat.",
        staff: {
          id: newStaffId,
          full_name: fullName,
          email,
          role: "staff"
        },
        event: {
          id: event.id,
          name: event.name
        }
      });
    } catch (error) {
      console.error("create-staff error:", error);

      return Response.json(
        {
          success: false,
          message: "Terjadi kesalahan pada server."
        },
        { status: 500 }
      );
    }
  })
};
