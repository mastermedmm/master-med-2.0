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

    const results = { success: [] as string[], failed: [] as { email: string; error: string }[] };

    for (const user of USERS) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name },
        ...(user.id ? { id: user.id } : {}),
      });

      if (error) {
        results.failed.push({ email: user.email, error: error.message });
        continue;
      }

      results.success.push(user.email);

      // Wait for handle_new_user trigger
      await new Promise((r) => setTimeout(r, 300));

      // Update profile full_name
      await supabase
        .from("profiles")
        .update({ full_name: user.full_name })
        .eq("user_id", data.user.id);

      // Register super admin
      if (user.is_super_admin) {
        await supabase
          .from("super_admins")
          .upsert({ user_id: data.user.id, name: user.full_name }, { onConflict: "user_id" });
      }
    }

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
