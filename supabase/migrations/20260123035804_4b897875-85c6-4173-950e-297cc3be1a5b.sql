-- Add unique constraint on user_id only for user_roles table
-- This allows using upsert with onConflict: 'user_id'
-- Each user should only have one role

-- First, check and remove duplicate roles if any (keep the most recent one)
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.id < b.id
  AND a.user_id = b.user_id;

-- Now add the unique constraint on user_id
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);