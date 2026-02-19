import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function for password (in production, use bcrypt via a library)
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

// Helper para gerar timestamps no fuso de Brasília
function nowBrasilia(): string {
  return new Date().toLocaleString('sv-SE', { 
    timeZone: 'America/Sao_Paulo' 
  }).replace(' ', 'T') + '.000Z';
}

function toBrasiliaISO(date: Date): string {
  return date.toLocaleString('sv-SE', { 
    timeZone: 'America/Sao_Paulo' 
  }).replace(' ', 'T') + '.000Z';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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
      const { crm, password, tenantId } = await req.json();

      if (!crm || !password) {
        return new Response(
          JSON.stringify({ error: "CRM e senha são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find all doctors with this CRM (could be in multiple tenants)
      const { data: doctors, error: doctorError } = await supabase
        .from("doctors")
        .select("id, name, crm, portal_password_hash, must_change_password, tenant_id, tenants(id, name, slug)")
        .eq("crm", crm.trim().toUpperCase())
        .not("portal_password_hash", "is", null);

      if (doctorError) {
        console.error("Error finding doctor:", doctorError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar médico" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!doctors || doctors.length === 0) {
        return new Response(
          JSON.stringify({ error: "CRM não encontrado ou acesso ao portal não configurado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If multiple doctors found with same CRM, need to select tenant
      if (doctors.length > 1 && !tenantId) {
        // Return list of tenants for user to select
        const tenants = doctors.map(d => ({
          id: (d.tenants as any)?.id,
          name: (d.tenants as any)?.name,
          slug: (d.tenants as any)?.slug,
        }));
        
        return new Response(
          JSON.stringify({ 
            requiresTenantSelection: true,
            tenants: tenants,
            message: "Selecione a empresa para continuar"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find the correct doctor (either single result or selected tenant)
      let doctor;
      if (tenantId) {
        doctor = doctors.find(d => d.tenant_id === tenantId);
        if (!doctor) {
          return new Response(
            JSON.stringify({ error: "Médico não encontrado nesta empresa" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        doctor = doctors[0];
      }

      const tenant = doctor.tenants as any;

      // Verify password
      const isValid = await verifyPassword(password, doctor.portal_password_hash!);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Senha incorreta" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create session
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const { error: sessionError } = await supabase
        .from("doctor_sessions")
        .insert({
          doctor_id: doctor.id,
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

      // Update last login
      await supabase
        .from("doctors")
        .update({ last_login_at: nowBrasilia() })
        .eq("id", doctor.id);

      console.log(`Doctor ${doctor.name} logged in successfully to tenant ${tenant?.name}`);

      return new Response(
        JSON.stringify({
          token: sessionToken,
          doctor: {
            id: doctor.id,
            name: doctor.name,
            crm: doctor.crm,
          },
          tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          } : null,
          mustChangePassword: doctor.must_change_password,
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

      // Validate session
      const { data: session, error: sessionError } = await supabase
        .from("doctor_sessions")
        .select("doctor_id, expires_at")
        .eq("session_token", sessionToken)
        .maybeSingle();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: "Sessão inválida" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Sessão expirada" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update password
      const newPasswordHash = await hashPassword(newPassword);
      const { error: updateError } = await supabase
        .from("doctors")
        .update({
          portal_password_hash: newPasswordHash,
          must_change_password: false,
        })
        .eq("id", session.doctor_id);

      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ error: "Erro ao atualizar senha" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Password changed for doctor ${session.doctor_id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /logout
    if (req.method === "POST" && path === "logout") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sessionToken = authHeader.replace("Bearer ", "");

      await supabase
        .from("doctor_sessions")
        .delete()
        .eq("session_token", sessionToken);

      console.log("Doctor logged out");

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

      const { data: session, error } = await supabase
        .from("doctor_sessions")
        .select("doctor_id, expires_at, doctors(id, name, crm, must_change_password, tenant_id, tenants(id, name, slug))")
        .eq("session_token", sessionToken)
        .maybeSingle();

      if (error || !session || new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const doctor = session.doctors as any;
      const tenant = doctor?.tenants as any;

      return new Response(
        JSON.stringify({
          valid: true,
          doctor: {
            id: doctor.id,
            name: doctor.name,
            crm: doctor.crm,
          },
          tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          } : null,
          mustChangePassword: doctor.must_change_password,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /set-password (admin only - sets initial password for a doctor)
    if (req.method === "POST" && path === "set-password") {
      const { doctorId, password, resetRequired } = await req.json();

      if (!doctorId || !password) {
        return new Response(
          JSON.stringify({ error: "ID do médico e senha são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordHash = await hashPassword(password);

      const { error: updateError } = await supabase
        .from("doctors")
        .update({
          portal_password_hash: passwordHash,
          must_change_password: resetRequired !== false,
        })
        .eq("id", doctorId);

      if (updateError) {
        console.error("Error setting password:", updateError);
        return new Response(
          JSON.stringify({ error: "Erro ao definir senha" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Password set for doctor ${doctorId}`);

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
    console.error("Error in doctor-auth:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
