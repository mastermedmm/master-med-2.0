import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Default permissions for each role - ALL 17 MODULES
function getDefaultPermissions(tenant_id: string) {
  // Complete list of 17 modules
  const modules = [
    'dashboard', 'import', 'allocation', 'payables', 'expenses',
    'doctors', 'hospitals', 'banks', 'issuers',
    'statements', 'reconciliation', 'adjustments', 'cashflow',  // Financial modules
    'users', 'permissions', 'settings', 'audit_logs'  // Admin modules
  ];
  
  const permissions: any[] = [];
  
  // Admin - full access to ALL 17 modules
  for (const module_name of modules) {
    permissions.push({
      tenant_id,
      role: 'admin',
      module_name,
      can_create: true,
      can_read: true,
      can_update: true,
      can_delete: true,
      can_customize: true,
    });
  }
  
  // Operador - operational access (17 modules)
  const operadorModules = {
    'dashboard': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    'import': { can_create: true, can_read: true, can_update: true, can_delete: false, can_customize: false },
    'allocation': { can_create: true, can_read: true, can_update: true, can_delete: true, can_customize: false },
    'payables': { can_create: false, can_read: true, can_update: true, can_delete: false, can_customize: false },
    'expenses': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
    'doctors': { can_create: true, can_read: true, can_update: true, can_delete: false, can_customize: false },
    'hospitals': { can_create: true, can_read: true, can_update: true, can_delete: false, can_customize: false },
    'banks': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    'issuers': { can_create: true, can_read: true, can_update: true, can_delete: false, can_customize: false },
    // Financial modules - restricted access for operador
    'statements': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    'reconciliation': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
    'adjustments': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
    'cashflow': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    // Admin modules
    'users': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
    'permissions': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
    'settings': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
    'audit_logs': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
  };
  
  for (const [module_name, perms] of Object.entries(operadorModules)) {
    permissions.push({
      tenant_id,
      role: 'operador',
      module_name,
      ...perms,
    });
  }
  
  // Financeiro - financial access (17 modules)
  const financeiroModules = {
    'dashboard': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    'import': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    'allocation': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    'payables': { can_create: false, can_read: true, can_update: true, can_delete: false, can_customize: false },
    'expenses': { can_create: true, can_read: true, can_update: true, can_delete: true, can_customize: true },
    'doctors': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    'hospitals': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    'banks': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    'issuers': { can_create: false, can_read: true, can_update: false, can_delete: false, can_customize: false },
    // Financial modules - full access for financeiro
    'statements': { can_create: true, can_read: true, can_update: true, can_delete: true, can_customize: true },
    'reconciliation': { can_create: true, can_read: true, can_update: true, can_delete: true, can_customize: true },
    'adjustments': { can_create: true, can_read: true, can_update: true, can_delete: true, can_customize: true },
    'cashflow': { can_create: true, can_read: true, can_update: true, can_delete: true, can_customize: true },
    // Admin modules
    'users': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
    'permissions': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
    'settings': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
    'audit_logs': { can_create: false, can_read: false, can_update: false, can_delete: false, can_customize: false },
  };
  
  for (const [module_name, perms] of Object.entries(financeiroModules)) {
    permissions.push({
      tenant_id,
      role: 'financeiro',
      module_name,
      ...perms,
    });
  }
  
  return permissions;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify calling user is a super admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Validate JWT (compatível com supabase-js v2 no edge-runtime)
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user: callingUser },
      error: callingUserError,
    } = await supabaseAuth.auth.getUser(token);

    if (callingUserError || !callingUser) {
      console.error('Token validation error:', callingUserError);
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callingUserId = callingUser.id;

    // Check if calling user is super admin
    const { data: superAdmin, error: superAdminError } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('user_id', callingUserId)
      .maybeSingle();

    if (superAdminError) {
      console.error('Error checking super admin:', superAdminError);
      return new Response(JSON.stringify({ error: 'Erro ao validar permissões' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!superAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas Super Admins podem criar usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { tenant_id, email, password, full_name } = await req.json();

    if (!tenant_id || !email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "Dados incompletos. Informe tenant_id, email, password e full_name." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user in auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { full_name },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile with tenant_id (profile is created by trigger)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ tenant_id, full_name })
      .eq("user_id", newUser.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Continue anyway, user was created
    }

    // Set user role to admin
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: "admin", tenant_id })
      .eq("user_id", newUser.user.id);

    if (roleError) {
      console.error("Error updating role:", roleError);
      // Continue anyway, user was created
    }

    // Check if tenant already has permissions, if not create default ones
    const { data: existingPerms } = await supabaseAdmin
      .from("module_permissions")
      .select("id")
      .eq("tenant_id", tenant_id)
      .limit(1);

    if (!existingPerms || existingPerms.length === 0) {
      console.log("Creating default permissions for tenant:", tenant_id);
      const permissions = getDefaultPermissions(tenant_id);
      
      const { error: permError } = await supabaseAdmin
        .from("module_permissions")
        .insert(permissions);
      
      if (permError) {
        console.error("Error creating default permissions:", permError);
        // Continue anyway, user was created
      } else {
        console.log(`Created ${permissions.length} default permissions for tenant`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUser.user.id,
        message: "Usuário administrador criado com sucesso!" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
