import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USERS = [
  { id: "99b0f549-8562-4f85-93e3-993c71ea6c71", email: "manoeljunior51@gmail.com", password: "102030", full_name: "Manoel Junior", is_super_admin: true },
  { id: "ec0f195d-9731-456e-b9b1-67b4b9180aac", email: "viviane@email.com", password: "102030", full_name: "Viviane Bittecourt" },
  { id: "233916e6-5c63-4463-855e-bfe83120a763", email: "vivianecarvalho@email.com", password: "102030", full_name: "Viviane Bitencourt" },
  { id: "6a363751-ca74-4c26-b6d8-9f4fa23969d8", email: "maismedgestao@gmail.com", password: "102030", full_name: "Viviane Carvalho" },
  { id: "2720867e-29b6-4fcc-897e-8f3648084945", email: "admmedcenter@email.com", password: "102030", full_name: "Manoel Junior - MEDCENTER" },
  { id: "729aae38-4f24-474e-b9fb-d1976a3f47a6", email: "admsaude@email.com", password: "102030", full_name: "Manoel Junior - SAUDEMED" },
  { id: "5c118377-f848-4792-8ca0-ff3b0ad5aea9", email: "admmastermed@email.com", password: "102030", full_name: "Manoel Jr - MASTERMED" },
  { id: "c8f74adc-b794-457a-9110-5ce78b5be248", email: "admgestaomed@email.com", password: "102030", full_name: "Manoel Jr - GESTÃOMED" },
  { id: "db3a0fae-ec46-49bc-8939-9859f1da21ee", email: "claudia.gestaomed@email.com", password: "102030", full_name: "Ana Cláudia" },
];

async function adminFetch(
  supabaseUrl: string,
  serviceRoleKey: string,
  method: string,
  path: string,
  body?: unknown
) {
  const url = `${supabaseUrl}/auth/v1/admin${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results = {
      success: [] as { email: string; uuid: string }[],
      failed: [] as { email: string; error: string; detail?: unknown }[],
      skipped: [] as { email: string; uuid: string; reason: string }[],
    };

    // Fetch all existing auth users once
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUsers = listData?.users ?? [];

    for (const user of USERS) {
      console.log(`\n--- Processing: ${user.email} (target UUID: ${user.id}) ---`);

      // Check if target UUID already exists in auth.users
      const byUUID = existingAuthUsers.find((u) => u.id === user.id);
      if (byUUID) {
        if (byUUID.email === user.email) {
          console.log(`  ✓ Already exists with correct UUID and email. Skipping.`);
          results.skipped.push({ email: user.email, uuid: user.id, reason: "Já existe com UUID e email corretos" });
          continue;
        } else {
          console.log(`  ✗ UUID ${user.id} taken by another email: ${byUUID.email}`);
          results.failed.push({ email: user.email, error: `UUID ${user.id} já está em uso por ${byUUID.email}` });
          continue;
        }
      }

      // Step 1: Delete orphaned profile with this UUID (from previous data migration)
      console.log(`  → Removing orphaned profile/roles for UUID ${user.id}...`);
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("user_id", user.id);
      console.log(`  → Orphaned records cleaned`);

      // Step 2: Delete existing auth user by email if different UUID
      const byEmail = existingAuthUsers.find((u) => u.email === user.email);
      if (byEmail && byEmail.id !== user.id) {
        console.log(`  → Email exists with UUID ${byEmail.id}, deleting auth user...`);
        const del = await adminFetch(supabaseUrl, serviceRoleKey, "DELETE", `/users/${byEmail.id}`);
        if (!del.ok) {
          console.log(`  ✗ Delete failed: ${JSON.stringify(del.data)}`);
          results.failed.push({ email: user.email, error: "Falha ao deletar usuário auth existente", detail: del.data });
          continue;
        }
        // Also clean up their orphaned profile if any
        await supabase.from("user_roles").delete().eq("user_id", byEmail.id);
        await supabase.from("profiles").delete().eq("user_id", byEmail.id);
        console.log(`  → Deleted auth user ${byEmail.id} and their records`);
        await new Promise((r) => setTimeout(r, 300));
      }

      // Step 3: Create user with forced UUID via REST API
      console.log(`  → Creating with forced UUID ${user.id}...`);
      const create = await adminFetch(supabaseUrl, serviceRoleKey, "POST", "/users", {
        id: user.id,
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name },
      });

      if (!create.ok) {
        console.log(`  ✗ Create failed (${create.status}): ${JSON.stringify(create.data)}`);
        results.failed.push({
          email: user.email,
          error: create.data?.msg || create.data?.message || "Erro ao criar usuário",
          detail: create.data,
        });
        continue;
      }

      const createdId = create.data.id;
      console.log(`  ✓ Created with UUID: ${createdId}`);

      // Step 4: Wait for handle_new_user trigger to create profile + user_role
      await new Promise((r) => setTimeout(r, 600));

      // Step 5: Update profile full_name
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: user.full_name })
        .eq("user_id", createdId);

      if (profileError) {
        console.log(`  ⚠ Profile update warning: ${profileError.message}`);
      } else {
        console.log(`  → Profile full_name updated`);
      }

      // Step 6: Register super admin if needed
      if (user.is_super_admin) {
        const { error: saError } = await supabase
          .from("super_admins")
          .upsert({ user_id: createdId, name: user.full_name }, { onConflict: "user_id" });

        if (saError) {
          console.log(`  ⚠ Super admin warning: ${saError.message}`);
        } else {
          console.log(`  → Registered as super admin`);
        }
      }

      results.success.push({ email: user.email, uuid: createdId });
    }

    console.log(`\n=== SUMMARY: ${results.success.length} success | ${results.skipped.length} skipped | ${results.failed.length} failed ===`);

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
