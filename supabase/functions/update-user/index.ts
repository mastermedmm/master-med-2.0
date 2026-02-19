import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, active_tenant_id')
      .eq('user_id', caller.id)
      .single();

    const effectiveTenantId = callerProfile?.active_tenant_id || callerProfile?.tenant_id;

    if (!effectiveTenantId) {
      return new Response(JSON.stringify({ error: 'No tenant' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('tenant_id', effectiveTenantId)
      .single();

    if (callerRole?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body = await req.json();

    // Action: list users with emails for tenant
    if (body.action === 'list-emails') {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('tenant_id', effectiveTenantId);

      if (!roles || roles.length === 0) {
        return new Response(JSON.stringify({ users: [] }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const emailMap: Record<string, string> = {};
      for (const r of roles) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
        if (user) {
          emailMap[r.user_id] = user.email || '';
        }
      }

      return new Response(JSON.stringify({ users: emailMap }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Action: update user
    const { targetUserId, email, fullName, role, password } = body;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'targetUserId required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify target user belongs to same tenant
    const { data: targetRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUserId)
      .eq('tenant_id', effectiveTenantId)
      .single();

    if (!targetRole) {
      return new Response(JSON.stringify({ error: 'User not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { email });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    if (password) {
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    if (fullName) {
      await supabaseAdmin.from('profiles').update({ full_name: fullName }).eq('user_id', targetUserId);
    }

    if (role && targetUserId !== caller.id) {
      await supabaseAdmin.from('user_roles').update({ role }).eq('user_id', targetUserId).eq('tenant_id', effectiveTenantId);
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
