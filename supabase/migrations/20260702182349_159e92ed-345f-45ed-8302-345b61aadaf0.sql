ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS sells_main boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sells_lp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_keys_lp integer NOT NULL DEFAULT 0;