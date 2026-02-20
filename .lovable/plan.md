
# Correção: Trigger ausente e profiles/roles faltando

## Diagnóstico

O login funciona (HTTP 200 confirmado nos logs de rede), mas após o login o sistema não consegue identificar o tenant do usuário porque:

1. O trigger `handle_new_user` **nao existe** no banco de dados - logo nenhum `profile` ou `user_role` foi criado automaticamente para os 8 usuarios migrados
2. Apenas `manoeljunior51@gmail.com` tem `profile` e `user_role`, mas sem `tenant_id` associado, entao `get_user_accessible_tenants` retorna `[]` para ele tambem
3. Sem `user_roles.tenant_id`, a funcao `get_user_accessible_tenants` nao retorna nenhum tenant, e o sistema nao sabe para onde redirecionar

## O que sera feito

### 1. Recriar o trigger `handle_new_user`

Criar o trigger na tabela `auth.users` para que novos usuarios criados no futuro recebam automaticamente um `profile` e um `user_role`.

### 2. Criar profiles e user_roles para todos os 8 usuarios sem perfil

Inserir diretamente via SQL os registros faltantes para os usuarios ja existentes no banco:

| Email | UUID | Tenant | Papel |
|---|---|---|---|
| admmastermed@email.com | 5c118377... | MASTERMED | admin |
| maismedgestao@gmail.com | 6a363751... | MAISMED | admin |
| admmedcenter@email.com | 2720867e... | MEDCENTER | admin |
| admsaude@email.com | 729aae38... | SAUDEMED | admin |
| admgestaomed@email.com | c8f74adc... | GESTAOMED | admin |
| claudia.gestaomed@email.com | db3a0fae... | GESTAOMED | operador |
| viviane@email.com | ec0f195d... | MAISMED | admin |
| vivianecarvalho@email.com | 233916e6... | MAISMED | operador |

### 3. Corrigir o profile de manoeljunior51 (super admin)

Atualizar o registro existente para nao ter `tenant_id` (super admins nao precisam de tenant, eles acessam tudo via `is_super_admin()`).

## Detalhes Tecnicos

### Migration SQL

```sql
-- 1. Recriar o trigger handle_new_user
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Inserir profiles faltantes (usando ON CONFLICT para nao duplicar)
INSERT INTO public.profiles (user_id, full_name, tenant_id)
VALUES
  ('5c118377-f848-4792-8ca0-ff3b0ad5aea9', 'Manoel Jr - MASTERMED',   'a26d9ada-a015-4047-858c-30cbcb6c2303'),
  ('6a363751-ca74-4c26-b6d8-9f4fa23969d8', 'Viviane Carvalho',         '9cba9191-7f77-46cf-bd26-c815dad33f7b'),
  ('2720867e-29b6-4fcc-897e-8f3648084945', 'Manoel Junior - MEDCENTER','7f51278f-f591-492a-94e6-80300b93d29a'),
  ('729aae38-4f24-474e-b9fb-d1976a3f47a6', 'Manoel Junior - SAUDEMED', '19cfb7cd-3de6-43ab-a07a-a20d7583e9d8'),
  ('c8f74adc-b794-457a-9110-5ce78b5be248', 'Manoel Jr - GESTAOMED',    'f2651480-e856-4305-9668-70357c84c535'),
  ('db3a0fae-ec46-49bc-8939-9859f1da21ee', 'Ana Claudia',              'f2651480-e856-4305-9668-70357c84c535'),
  ('ec0f195d-9731-456e-b9b1-67b4b9180aac', 'Viviane Bittecourt',       '9cba9191-7f77-46cf-bd26-c815dad33f7b'),
  ('233916e6-5c63-4463-855e-bfe83120a763', 'Viviane Bitencourt',        '9cba9191-7f77-46cf-bd26-c815dad33f7b')
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  tenant_id = EXCLUDED.tenant_id;

-- 3. Inserir user_roles com tenant_id correto
INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES
  ('5c118377-f848-4792-8ca0-ff3b0ad5aea9', 'admin',    'a26d9ada-a015-4047-858c-30cbcb6c2303'),
  ('6a363751-ca74-4c26-b6d8-9f4fa23969d8', 'admin',    '9cba9191-7f77-46cf-bd26-c815dad33f7b'),
  ('2720867e-29b6-4fcc-897e-8f3648084945', 'admin',    '7f51278f-f591-492a-94e6-80300b93d29a'),
  ('729aae38-4f24-474e-b9fb-d1976a3f47a6', 'admin',    '19cfb7cd-3de6-43ab-a07a-a20d7583e9d8'),
  ('c8f74adc-b794-457a-9110-5ce78b5be248', 'admin',    'f2651480-e856-4305-9668-70357c84c535'),
  ('db3a0fae-ec46-49bc-8939-9859f1da21ee', 'operador', 'f2651480-e856-4305-9668-70357c84c535'),
  ('ec0f195d-9731-456e-b9b1-67b4b9180aac', 'admin',    '9cba9191-7f77-46cf-bd26-c815dad33f7b'),
  ('233916e6-5c63-4463-855e-bfe83120a763', 'operador', '9cba9191-7f77-46cf-bd26-c815dad33f7b')
ON CONFLICT (user_id, role) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id;

-- 4. Atualizar o user_role existente do super admin (sem tenant_id necessario)
UPDATE public.user_roles 
SET tenant_id = NULL, role = 'admin'
WHERE user_id = '99b0f549-8562-4f85-93e3-993c71ea6c71';
```

Apos isso, todos os usuarios conseguirao fazer login e serao direcionados corretamente ao seu tenant.
