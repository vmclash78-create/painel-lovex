ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS password text;
