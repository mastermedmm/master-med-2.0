

# Corrigir Edge Function migrate-users para manter UUIDs originais

## Problema identificado

1. O usuario `manoeljunior51@gmail.com` ja existe com UUID diferente (`61ebc3b6...`) do desejado (`99b0f549...`). Precisa ser deletado e recriado.
2. Os outros 8 usuarios falharam com "Database error" - provavelmente causado pelo trigger `handle_new_user` que tenta inserir em `profiles` e `user_roles` sem `tenant_id`, podendo conflitar com constraints ou o proprio trigger falhando.

## Solucao

Atualizar a edge function `migrate-users` com as seguintes mudancas:

### 1. Deletar usuario existente antes de recriar
- Para cada usuario, verificar se o email ja existe via `auth.admin.listUsers`
- Se existir com UUID diferente, deletar via `auth.admin.deleteUserById` antes de recriar
- Isso garante que o UUID original sera preservado

### 2. Melhorar tratamento de erros
- Logar detalhes completos dos erros para facilitar debug
- Incluir o UUID tentado no resultado para confirmar que foi mantido

### 3. Aumentar o delay pos-criacao
- Aumentar de 300ms para 500ms para dar mais tempo ao trigger `handle_new_user`

## Detalhes Tecnicos

### Arquivo modificado
- `supabase/functions/migrate-users/index.ts`

### Fluxo por usuario
1. Buscar usuario existente pelo email via `auth.admin.listUsers`
2. Se existir com UUID diferente do desejado, deletar via `auth.admin.deleteUserById`
3. Criar usuario com `auth.admin.createUser({ id: user.id, ... })` - o parametro `id` e suportado pela Admin API para forcar o UUID
4. Aguardar 500ms para o trigger processar
5. Atualizar `full_name` no profiles
6. Se super_admin, inserir na tabela `super_admins`

### Resultado esperado
- JSON com arrays `success` (com email + UUID confirmado) e `failed` (com email + erro detalhado)

