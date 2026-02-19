import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImpersonateRequest {
  tenant_id: string;
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth header for user verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify the user is a super admin
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Use service role to check super admin status
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: superAdmin, error: saError } = await supabase
      .from('super_admins')
      .select('id, name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (saError || !superAdmin) {
      console.error('User is not a super admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Access denied. Super admin privileges required.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { tenant_id } = await req.json() as ImpersonateRequest;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Tenant ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify tenant exists and is active
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Generate impersonation token (valid for 1 hour)
    const expiresAt = toBrasiliaISO(new Date(Date.now() + 60 * 60 * 1000));
    
    const tokenData = {
      tenant_id: tenant.id,
      super_admin_id: superAdmin.id,
      expires_at: expiresAt,
      created_at: nowBrasilia(),
    };

    const token = btoa(JSON.stringify(tokenData));

    // Log the impersonation
    await supabase.from('tenant_impersonation_logs').insert({
      super_admin_id: superAdmin.id,
      tenant_id: tenant.id,
      action: 'enter',
      details: { 
        expires_at: expiresAt,
        tenant_name: tenant.name,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
    });

    console.log(`Impersonation started: ${superAdmin.name} -> ${tenant.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        token,
        tenant_name: tenant.name,
        expires_at: expiresAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating impersonation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
