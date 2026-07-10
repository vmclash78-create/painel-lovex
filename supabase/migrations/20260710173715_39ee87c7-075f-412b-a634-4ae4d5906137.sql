
-- Remove overly-permissive public policies on licenses & resellers.
-- These tables are backed by an external Supabase for the app; the Lovable Cloud
-- copies should only be reachable by trusted server code (service_role).
DROP POLICY IF EXISTS "licenses public" ON public.licenses;
DROP POLICY IF EXISTS "resellers public" ON public.resellers;

CREATE POLICY "licenses service" ON public.licenses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "resellers service" ON public.resellers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoke anon/authenticated table grants so PostgREST cannot reach these tables.
REVOKE ALL ON public.licenses FROM anon, authenticated;
REVOKE ALL ON public.resellers FROM anon, authenticated;
REVOKE ALL ON public.reseller_key_balances FROM anon, authenticated;
REVOKE ALL ON public.reseller_key_transactions FROM anon, authenticated;
REVOKE ALL ON public.reseller_purchases FROM anon, authenticated;

GRANT ALL ON public.licenses TO service_role;
GRANT ALL ON public.resellers TO service_role;

-- Lock down SECURITY DEFINER functions: revoke public/anon/authenticated EXECUTE.
REVOKE EXECUTE ON FUNCTION public.credit_reseller_keys(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_reseller_key(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.credit_reseller_keys(uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_reseller_key(uuid, text, text) TO service_role;

-- Fix mutable search_path on set_updated_at trigger function.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;
