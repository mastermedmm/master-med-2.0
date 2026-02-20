
-- Remove "Manoel Jr - MASTERMED" from GESTÃOMED tenant (wrong association)
DELETE FROM user_roles 
WHERE user_id = '5c118377-f848-4792-8ca0-ff3b0ad5aea9' 
AND tenant_id = 'f2651480-e856-4305-9668-70357c84c535';
