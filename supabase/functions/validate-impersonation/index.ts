import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImpersonationRequest {
  token: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json() as ImpersonationRequest;

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Decode and validate the impersonation token
    // Token format: base64(JSON.stringify({ tenant_id, super_admin_id, expires_at }))
    let tokenData;
    try {
      const decoded = atob(token);
      tokenData = JSON.parse(decoded);
    } catch {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { tenant_id, super_admin_id, expires_at, signature } = tokenData;

    // Check expiration
    if (new Date(expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify super admin exists
    const { data: superAdmin, error: saError } = await supabase
      .from('super_admins')
      .select('id, name')
      .eq('id', super_admin_id)
      .maybeSingle();

    if (saError || !superAdmin) {
      console.error('Super admin not found:', saError);
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid super admin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid tenant' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Log the impersonation validation
    await supabase.from('tenant_impersonation_logs').insert({
      super_admin_id: superAdmin.id,
      tenant_id: tenant.id,
      action: 'validate',
      details: { validated_at: new Date().toISOString() },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
    });

    console.log(`Impersonation validated: ${superAdmin.name} -> ${tenant.name}`);

    return new Response(
      JSON.stringify({
        valid: true,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        super_admin_name: superAdmin.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating impersonation:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
