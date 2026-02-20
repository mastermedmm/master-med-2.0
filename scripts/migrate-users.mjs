/**
 * Script de migração de usuários para o Supabase.
 * Cria os usuários mantendo os UUIDs originais via Admin API.
 *
 * Como usar:
 *   1. Adicione a SUPABASE_SERVICE_ROLE_KEY abaixo (ou exporte como variável de ambiente)
 *   2. Execute: node migrate-users.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ─── Configuração ────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://pnwstilxwpzrjqdwrqay.supabase.co';

// Cole aqui a service_role key do Supabase Dashboard → Settings → API
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'COLE_AQUI_A_SERVICE_ROLE_KEY';

// ─── Usuários a migrar ────────────────────────────────────────────────────────
const USERS = [
  {
    id: '99b0f549-8562-4f85-93e3-993c71ea6c71',
    email: 'manoeljunior51@gmail.com',
    password: '102030',
    full_name: 'Manoel Junior',
    email_confirm: true,
    is_super_admin: true,
  },
  {
    id: 'ec0f195d-9731-456e-b9b1-67b4b9180aac',
    email: 'viviane@email.com',
    password: '102030',
    full_name: 'Viviane Bittecourt',
    email_confirm: true,
  },
  {
    id: '233916e6-5c63-4463-855e-bfe83120a763',
    email: 'vivianecarvalho@email.com',
    password: '102030',
    full_name: 'Viviane Bitencourt',
    email_confirm: true,
  },
  {
    id: '6a363751-ca74-4c26-b6d8-9f4fa23969d8',
    email: 'maismedgestao@gmail.com',
    password: '102030',
    full_name: 'Viviane Carvalho',
    email_confirm: true,
  },
  {
    id: '2720867e-29b6-4fcc-897e-8f3648084945',
    email: 'admmedcenter@email.com',
    password: '102030',
    full_name: 'Manoel Junior - MEDCENTER',
    email_confirm: true,
  },
  {
    id: '729aae38-4f24-474e-b9fb-d1976a3f47a6',
    email: 'admsaude@email.com',
    password: '102030',
    full_name: 'Manoel Junior - SAUDEMED',
    email_confirm: true,
  },
  {
    id: '5c118377-f848-4792-8ca0-ff3b0ad5aea9',
    email: 'admmastermed@email.com',
    password: '102030',
    full_name: 'Manoel Jr - MASTERMED',
    email_confirm: true,
  },
  {
    id: 'c8f74adc-b794-457a-9110-5ce78b5be248',
    email: 'admgestaomed@email.com',
    password: '102030',
    full_name: 'Manoel Jr - GESTÃOMED',
    email_confirm: true,
  },
  {
    id: 'db3a0fae-ec46-49bc-8939-9859f1da21ee',
    email: 'claudia.gestaomed@email.com',
    password: '102030',
    full_name: 'Ana Cláudia',
    email_confirm: true,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (SUPABASE_SERVICE_ROLE_KEY === 'COLE_AQUI_A_SERVICE_ROLE_KEY') {
    console.error('❌ Defina a SUPABASE_SERVICE_ROLE_KEY antes de executar o script.');
    console.error('   Opção 1: edite a constante no arquivo');
    console.error('   Opção 2: SUPABASE_SERVICE_ROLE_KEY=<key> node migrate-users.mjs');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n🚀 Iniciando migração de ${USERS.length} usuários...\n`);

  const results = { success: [], failed: [] };

  for (const user of USERS) {
    process.stdout.write(`  → ${user.full_name} (${user.email}) ... `);

    const { data, error } = await supabase.auth.admin.createUser({
      user_id: user.id,   // mantém o UUID original
      email: user.email,
      password: user.password,
      email_confirm: user.email_confirm,
      user_metadata: { full_name: user.full_name },
    });

    if (error) {
      console.log(`❌ ERRO: ${error.message}`);
      results.failed.push({ user: user.email, error: error.message });
      continue;
    }

    console.log(`✅ criado (id: ${data.user.id})`);
    results.success.push(user.email);

    // Aguarda o trigger on_auth_user_created processar antes de atualizar o perfil
    await new Promise((r) => setTimeout(r, 300));

    // Garante que o full_name no profiles está correto
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: user.full_name })
      .eq('user_id', data.user.id);

    if (profileError) {
      console.log(`  ⚠️  Não foi possível atualizar o perfil: ${profileError.message}`);
    }

    // Super Admin: insere na tabela super_admins
    if (user.is_super_admin) {
      const { error: saError } = await supabase
        .from('super_admins')
        .upsert({ user_id: data.user.id, name: user.full_name }, { onConflict: 'user_id' });

      if (saError) {
        console.log(`  ⚠️  Não foi possível registrar como super_admin: ${saError.message}`);
      } else {
        console.log(`  🔑 Registrado como Super Admin`);
      }
    }
  }

  console.log('\n─────────────────────────────────────');
  console.log(`✅ Sucesso: ${results.success.length}/${USERS.length}`);
  if (results.failed.length > 0) {
    console.log(`❌ Falhas:  ${results.failed.length}/${USERS.length}`);
    results.failed.forEach(({ user, error }) => console.log(`   • ${user}: ${error}`));
  }
  console.log('─────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
