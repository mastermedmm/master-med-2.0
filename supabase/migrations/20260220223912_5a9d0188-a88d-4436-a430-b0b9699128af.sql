
-- 1. Adicionar constraint unique em user_roles (user_id, role) se nao existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.user_roles'::regclass 
    AND contype = 'u' 
    AND conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- 2. Recriar o trigger handle_new_user
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Inserir profiles faltantes
INSERT INTO public.profiles (user_id, full_name, tenant_id)
VALUES
  ('5c118377-f848-4792-8ca0-ff3b0ad5aea9', 'Manoel Jr - MASTERMED',    'a26d9ada-a015-4047-858c-30cbcb6c2303'),
  ('6a363751-ca74-4c26-b6d8-9f4fa23969d8', 'Viviane Carvalho',          '9cba9191-7f77-46cf-bd26-c815dad33f7b'),
  ('2720867e-29b6-4fcc-897e-8f3648084945', 'Manoel Junior - MEDCENTER', '7f51278f-f591-492a-94e6-80300b93d29a'),
  ('729aae38-4f24-474e-b9fb-d1976a3f47a6', 'Manoel Junior - SAUDEMED',  '19cfb7cd-3de6-43ab-a07a-a20d7583e9d8'),
  ('c8f74adc-b794-457a-9110-5ce78b5be248', 'Manoel Jr - GESTAOMED',     'f2651480-e856-4305-9668-70357c84c535'),
  ('db3a0fae-ec46-49bc-8939-9859f1da21ee', 'Ana Claudia',               'f2651480-e856-4305-9668-70357c84c535'),
  ('ec0f195d-9731-456e-b9b1-67b4b9180aac', 'Viviane Bittecourt',        '9cba9191-7f77-46cf-bd26-c815dad33f7b'),
  ('233916e6-5c63-4463-855e-bfe83120a763', 'Viviane Bitencourt',         '9cba9191-7f77-46cf-bd26-c815dad33f7b')
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  tenant_id = EXCLUDED.tenant_id;

-- 4. Remover user_roles existentes desses usuarios para reinserir corretamente
DELETE FROM public.user_roles
WHERE user_id IN (
  '5c118377-f848-4792-8ca0-ff3b0ad5aea9',
  '6a363751-ca74-4c26-b6d8-9f4fa23969d8',
  '2720867e-29b6-4fcc-897e-8f3648084945',
  '729aae38-4f24-474e-b9fb-d1976a3f47a6',
  'c8f74adc-b794-457a-9110-5ce78b5be248',
  'db3a0fae-ec46-49bc-8939-9859f1da21ee',
  'ec0f195d-9731-456e-b9b1-67b4b9180aac',
  '233916e6-5c63-4463-855e-bfe83120a763'
);

-- 5. Inserir user_roles com tenant_id correto
INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES
  ('5c118377-f848-4792-8ca0-ff3b0ad5aea9', 'admin',    'a26d9ada-a015-4047-858c-30cbcb6c2303'),
  ('6a363751-ca74-4c26-b6d8-9f4fa23969d8', 'admin',    '9cba9191-7f77-46cf-bd26-c815dad33f7b'),
  ('2720867e-29b6-4fcc-897e-8f3648084945', 'admin',    '7f51278f-f591-492a-94e6-80300b93d29a'),
  ('729aae38-4f24-474e-b9fb-d1976a3f47a6', 'admin',    '19cfb7cd-3de6-43ab-a07a-a20d7583e9d8'),
  ('c8f74adc-b794-457a-9110-5ce78b5be248', 'admin',    'f2651480-e856-4305-9668-70357c84c535'),
  ('db3a0fae-ec46-49bc-8939-9859f1da21ee', 'operador', 'f2651480-e856-4305-9668-70357c84c535'),
  ('ec0f195d-9731-456e-b9b1-67b4b9180aac', 'admin',    '9cba9191-7f77-46cf-bd26-c815dad33f7b'),
  ('233916e6-5c63-4463-855e-bfe83120a763', 'operador', '9cba9191-7f77-46cf-bd26-c815dad33f7b');

-- 6. Atualizar o user_role do super admin (sem tenant_id)
UPDATE public.user_roles 
SET tenant_id = NULL, role = 'admin'
WHERE user_id = '99b0f549-8562-4f85-93e3-993c71ea6c71';

-- 7. Garantir que o profile do super admin nao tem tenant_id
UPDATE public.profiles
SET tenant_id = NULL
WHERE user_id = '99b0f549-8562-4f85-93e3-993c71ea6c71';
