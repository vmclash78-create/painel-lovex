DROP POLICY IF EXISTS "Authenticated users can see API keys" ON public.reseller_api_keys;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.reseller_api_keys FROM authenticated;
REVOKE ALL ON public.reseller_api_keys FROM anon;

GRANT ALL ON public.reseller_api_keys TO service_role;