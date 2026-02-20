

# Edge Function: migrate-users

## O que sera feito

Criar uma edge function `migrate-users` que replica exatamente a logica do script `scripts/migrate-users.mjs`, permitindo execucao diretamente pelo Lovable.

## Funcionalidade

A function ira:
1. Criar 9 usuarios no auth.users mantendo os UUIDs originais
2. Aguardar o trigger `handle_new_user` processar (cria profile + user_role automaticamente)
3. Atualizar o `full_name` no profiles
4. Registrar o usuario `manoeljunior51@gmail.com` como super admin
5. Retornar um JSON com o resultado (sucesso/falha para cada usuario)

## Detalhes Tecnicos

### Arquivo criado
- `supabase/functions/migrate-users/index.ts`

### Configuracao
- Adicionar `verify_jwt = false` no `supabase/config.toml` (a function nao precisa de autenticacao pois usa service_role_key internamente e e de uso unico)

### Logica
- Usa `SUPABASE_SERVICE_ROLE_KEY` (ja configurado como secret) para chamar `auth.admin.createUser`
- Lista de usuarios hardcoded identica ao script original
- Para cada usuario: cria via admin API, aguarda 300ms, atualiza profile, e se for super_admin insere na tabela
- Retorna JSON com arrays `success` e `failed`

### Seguranca
- A function sera publica (sem JWT) pois e de uso unico para migracao
- Apos executar, pode ser removida

