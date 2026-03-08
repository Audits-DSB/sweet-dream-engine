-- The existing "Admins can manage roles" policy with ALL command already covers DELETE for admins.
-- But we need to ensure the policy has WITH CHECK for INSERT too.
-- Let's drop and recreate the ALL policy with proper WITH CHECK
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));