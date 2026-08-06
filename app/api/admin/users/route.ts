import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    throw new Error("Persyaratan environment variable SUPABASE_SECRET_KEY / SUPABASE_URL tidak terkonfigurasi.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;
    const adminClient = getAdminClient();

    // ── 1. Create User ────────────────────────────────────────────────────────
    if (action === "create") {
      const { email, password, fullName, role, isActive } = body;

      if (!email || !password || !fullName) {
        return NextResponse.json(
          { error: "Nama lengkap, email, dan password wajib diisi." },
          { status: 400 }
        );
      }

      // Create in Supabase Auth via admin API
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), role: role || "employee" },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      const createdUser = authData.user;
      if (!createdUser) {
        return NextResponse.json({ error: "Gagal membuat user auth" }, { status: 500 });
      }

      // Ensure public.users table is updated with name, role, and is_active
      const { data: userRecord, error: dbError } = await adminClient
        .from("users")
        .upsert({
          id: createdUser.id,
          full_name: fullName.trim(),
          role: role || "employee",
          is_active: isActive !== undefined ? isActive : true,
        })
        .select()
        .single();

      if (dbError) {
        console.error("DB Upsert error after user create:", dbError.message);
      }

      return NextResponse.json({
        success: true,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          full_name: fullName.trim(),
          role: role || "employee",
          is_active: isActive !== undefined ? isActive : true,
          created_at: createdUser.created_at,
        },
      });
    }

    // ── 2. Reset Password ─────────────────────────────────────────────────────
    if (action === "reset_password") {
      const { userId, newPassword } = body;

      if (!userId || !newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: "ID user dan password baru (minimal 6 karakter) wajib diisi." },
          { status: 400 }
        );
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Password berhasil diperbarui." });
    }

    // ── 3. Update Profile ─────────────────────────────────────────────────────
    if (action === "update") {
      const { userId, fullName, role, isActive } = body;

      if (!userId || !fullName) {
        return NextResponse.json({ error: "ID User dan nama lengkap wajib diisi." }, { status: 400 });
      }

      // Update public.users
      const { data: dbData, error: dbError } = await adminClient
        .from("users")
        .update({
          full_name: fullName.trim(),
          role,
          is_active: isActive,
        })
        .eq("id", userId)
        .select()
        .single();

      if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 400 });
      }

      // Also update auth.users metadata
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: fullName.trim(), role },
      });

      return NextResponse.json({ success: true, user: dbData });
    }

    // ── 4. Delete User (Smart Delete / Force Delete) ──────────────────────────
    if (action === "delete") {
      const { userId, force } = body;

      if (!userId) {
        return NextResponse.json({ error: "ID User wajib diisi." }, { status: 400 });
      }

      if (!force) {
        // Check if user has entries in work_sessions
        const { count: sessionCount, error: sessionErr } = await adminClient
          .from("work_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);

        if (sessionErr) {
          console.error("Error checking work_sessions for user:", sessionErr.message);
        }

        // Check if user has entries in payroll_records
        const { count: payrollCount, error: payrollErr } = await adminClient
          .from("payroll_records")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);

        if (payrollErr) {
          console.error("Error checking payroll_records for user:", payrollErr.message);
        }

        const hasHistory = (sessionCount || 0) > 0 || (payrollCount || 0) > 0;

        if (hasHistory) {
          return NextResponse.json(
            {
              success: false,
              hasHistory: true,
              error: "Pengguna ini sudah memiliki riwayat sesi kerja / payroll di database.",
            },
            { status: 400 }
          );
        }
      }

      // Hard delete from public.users
      const { error: dbDeleteErr } = await adminClient
        .from("users")
        .delete()
        .eq("id", userId);

      if (dbDeleteErr) {
        return NextResponse.json({ error: dbDeleteErr.message }, { status: 400 });
      }

      // Hard delete from Supabase Auth
      const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(userId);
      if (authDeleteErr) {
        console.error("Warning: Failed to delete auth user:", authDeleteErr.message);
      }

      return NextResponse.json({ success: true, message: "Pengguna berhasil dihapus secara permanen." });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
