import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}

function nowBrasilia(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z';
}

function toBrasiliaISO(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // POST /login
    if (req.method === "POST" && path === "login") {
      const { email, password, tenantId } = await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "E-mail e senha são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanEmail = email.trim().toLowerCase();

      // Find all licensees with this email
      const { data: licensees, error: licenseeError } = await supabase
        .from("licensees")
        .select("id, name, cpf, email, commission, portal_password_hash, must_change_password, tenant_id, active, tenants(id, name, slug)")
        .eq("email", cleanEmail)
        .eq("active", true)
        .not("portal_password_hash", "is", null);

      if (licenseeError) {
        console.error("Error finding licensee:", licenseeError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar licenciado" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!licensees || licensees.length === 0) {
        return new Response(
          JSON.stringify({ error: "E-mail não encontrado ou acesso ao portal não configurado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If multiple licensees found with same CPF, need to select tenant
      if (licensees.length > 1 && !tenantId) {
        const tenants = licensees.map(l => ({
          id: (l.tenants as any)?.id,
          name: (l.tenants as any)?.name,
          slug: (l.tenants as any)?.slug,
        }));
        
        return new Response(
          JSON.stringify({ requiresTenantSelection: true, tenants }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let licensee;
      if (tenantId) {
        licensee = licensees.find(l => l.tenant_id === tenantId);
        if (!licensee) {
          return new Response(
            JSON.stringify({ error: "Licenciado não encontrado nesta empresa" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        licensee = licensees[0];
      }

      const tenant = licensee.tenants as any;

      const isValid = await verifyPassword(password, licensee.portal_password_hash!);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Senha incorreta" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const { error: sessionError } = await supabase
        .from("licensee_sessions")
        .insert({
          licensee_id: licensee.id,
          session_token: sessionToken,
          expires_at: toBrasiliaISO(expiresAt),
        });

      if (sessionError) {
        console.error("Error creating session:", sessionError);
        return new Response(
          JSON.stringify({ error: "Erro ao criar sessão" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("licensees")
        .update({ last_login_at: nowBrasilia() })
        .eq("id", licensee.id);

      console.log(`Licensee ${licensee.name} logged in successfully`);

      return new Response(
        JSON.stringify({
          token: sessionToken,
          licensee: { id: licensee.id, name: licensee.name, cpf: licensee.cpf, commission: licensee.commission },
          tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
          mustChangePassword: licensee.must_change_password,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /change-password
    if (req.method === "POST" && path === "change-password") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Token de sessão obrigatório" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sessionToken = authHeader.replace("Bearer ", "");
      const { newPassword } = await req.json();

      if (!newPassword || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await supabase
        .from("licensee_sessions")
        .select("licensee_id, expires_at")
        .eq("session_token", sessionToken)
        .maybeSingle();

      if (!session || new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Sessão inválida ou expirada" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newPasswordHash = await hashPassword(newPassword);
      await supabase
        .from("licensees")
        .update({ portal_password_hash: newPasswordHash, must_change_password: false })
        .eq("id", session.licensee_id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /logout
    if (req.method === "POST" && path === "logout") {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const sessionToken = authHeader.replace("Bearer ", "");
        await supabase.from("licensee_sessions").delete().eq("session_token", sessionToken);
      }
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /validate-session
    if (req.method === "POST" && path === "validate-session") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sessionToken = authHeader.replace("Bearer ", "");
      const { data: session } = await supabase
        .from("licensee_sessions")
        .select("licensee_id, expires_at, licensees(id, name, cpf, commission, must_change_password, tenant_id, tenants(id, name, slug))")
        .eq("session_token", sessionToken)
        .maybeSingle();

      if (!session || new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const licensee = session.licensees as any;
      const tenant = licensee?.tenants as any;

      return new Response(
        JSON.stringify({
          valid: true,
          licensee: { id: licensee.id, name: licensee.name, cpf: licensee.cpf, commission: licensee.commission },
          tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
          mustChangePassword: licensee.must_change_password,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /set-password (admin sets initial password)
    if (req.method === "POST" && path === "set-password") {
      const { licenseeId, password, resetRequired } = await req.json();

      if (!licenseeId || !password) {
        return new Response(
          JSON.stringify({ error: "ID do licenciado e senha são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordHash = await hashPassword(password);
      await supabase
        .from("licensees")
        .update({ portal_password_hash: passwordHash, must_change_password: resetRequired !== false })
        .eq("id", licenseeId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Endpoint não encontrado" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in licensee-auth:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
