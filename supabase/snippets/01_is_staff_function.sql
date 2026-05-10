-- Run this in SQL Editor FIRST if you see: function public.is_staff() does not exist
-- (Same definition as in migrations/20260530120000_staff_warnings_reports.sql)
-- Requires: public.is_site_owner(), public.user_roles, public.app_role enum

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_site_owner()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
