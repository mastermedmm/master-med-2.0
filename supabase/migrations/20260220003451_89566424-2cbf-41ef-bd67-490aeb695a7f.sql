-- Remove maismedgestao@gmail.com from GESTÃOMED tenant (wrong association)
DELETE FROM user_roles 
WHERE user_id = '6a363751-ca74-4c26-b6d8-9f4fa23969d8' 
AND tenant_id = 'f2651480-e856-4305-9668-70357c84c535';