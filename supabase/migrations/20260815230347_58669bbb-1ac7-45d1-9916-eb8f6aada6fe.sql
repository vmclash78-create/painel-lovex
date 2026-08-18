DROP POLICY IF EXISTS "Authenticated users can see API keys" ON public.reseller_api_keys;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.reseller_api_keys FROM authenticated;
REVOKE ALL ON public.reseller_api_keys FROM anon;

GRANT ALL ON public.reseller_api_keys TO service_role;
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'information_schema', 'auth', 'storage'
AS $$
DECLARE
  result json;
  caller_role text;
  clean_query text;
BEGIN
  caller_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF caller_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode executar esta função.';
  END IF;
  clean_query := rtrim(sql_query, '; ');
  EXECUTE
    'SELECT json_agg(row_to_json(t)) FROM (' || clean_query || ') t'
  INTO result;
  RETURN COALESCE(result,'[]'::json);
END;
$$;
