-- Delete the conflicting auth user manoeljunior51@gmail.com (UUID 61ebc3b6...)
-- and their orphaned profile (UUID 99b0f549... which is already cleaned)
DELETE FROM auth.users WHERE id = '61ebc3b6-1e0e-4159-b621-42b0894de172';
-- Also clean any profile that might have been created for this wrong UUID
DELETE FROM public.profiles WHERE user_id = '61ebc3b6-1e0e-4159-b621-42b0894de172';
DELETE FROM public.user_roles WHERE user_id = '61ebc3b6-1e0e-4159-b621-42b0894de172';
-- Clean orphaned profile for the target UUID (in case it wasn't cleaned)
DELETE FROM public.profiles WHERE user_id = '99b0f549-8562-4f85-93e3-993c71ea6c71';
DELETE FROM public.user_roles WHERE user_id = '99b0f549-8562-4f85-93e3-993c71ea6c71';