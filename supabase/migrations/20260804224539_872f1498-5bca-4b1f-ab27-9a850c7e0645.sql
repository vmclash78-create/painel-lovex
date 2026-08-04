-- 1. Add missing columns to LoveX database
ALTER TABLE public.licenses
ADD COLUMN IF NOT EXISTS max_version TEXT DEFAULT '2.x',
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS daily_prompts_used INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_prompt_date DATE,
ADD COLUMN IF NOT EXISTS daily_limit INT DEFAULT 100;

-- 2. Grant permissions to anon and authenticated roles (fixing the 401 error)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO anon;
GRANT ALL ON public.licenses TO service_role;

GRANT SELECT ON public.resellers TO authenticated;
GRANT SELECT ON public.resellers TO anon;
GRANT ALL ON public.resellers TO service_role;

-- 3. Update "Old" licenses (created > 15 days ago) to expire in exactly 6 days
-- Also ensure they have max_version set to 2.x
UPDATE public.licenses
SET 
  expires_at = (now() + interval '6 days'),
  max_version = '2.x',
  updated_at = now()
WHERE created_at < (now() - interval '15 days');
