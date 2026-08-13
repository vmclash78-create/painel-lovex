CREATE TABLE public.reseller_api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reseller_id uuid REFERENCES public.resellers(id) ON DELETE CASCADE NOT NULL,
    api_key text UNIQUE NOT NULL,
    name text NOT NULL DEFAULT 'Default API Key',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_used_at timestamp with time zone
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_api_keys TO authenticated;
GRANT ALL ON public.reseller_api_keys TO service_role;

ALTER TABLE public.reseller_api_keys ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their reseller's keys (if linked)
-- Or just allow service role for now if user mapping is complex
CREATE POLICY "Service role can manage all API keys"
ON public.reseller_api_keys
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- For now, allow authenticated users to see all keys to unblock UI development
-- We will tighten this once user_roles is correctly set up
CREATE POLICY "Authenticated users can see API keys"
ON public.reseller_api_keys
FOR SELECT
TO authenticated
USING (true);
