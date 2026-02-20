
-- 1. Inserir role admin para admmastermed@email.com no MASTERMED
INSERT INTO user_roles (user_id, tenant_id, role)
VALUES ('5c118377-f848-4792-8ca0-ff3b0ad5aea9', 'a26d9ada-a015-4047-858c-30cbcb6c2303', 'admin');

-- 2. Remover usuarios extras de GESTAOMED
DELETE FROM user_roles WHERE id IN (
  '6968162e-3e1f-4859-b782-a3716f423198',  -- user 99b0f549
  '474f247e-e3af-456d-a333-6ea3d6b79427',  -- user ec0f195d
  'e6c83946-41d4-4b2f-8c5e-130cdcb193c1'   -- user 00599427
);

-- 3. Remover usuario extra de MASTERMED
DELETE FROM user_roles WHERE id = '559ae05b-3135-428c-9fef-dacf9ab81493'; -- user 7dabfe86

-- 4. Remover usuario extra de MAISMED
DELETE FROM user_roles WHERE id = 'c492b41d-6696-4137-a4d7-4d89a49346ff'; -- user b77d3436

-- 5. Remover usuario extra de MEDCENTER
DELETE FROM user_roles WHERE id = 'fed6176a-1d90-4c79-ace0-17e80ce83ab1'; -- user 6913f27a

-- 6. Remover usuario extra de SAUDEMED
DELETE FROM user_roles WHERE id = 'c1c6ae1f-06e4-40fd-93d3-ab11771d72fd'; -- user fae36653
