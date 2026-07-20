CREATE TABLE public.extension_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_lovepro boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.extension_updates TO anon, authenticated;
GRANT ALL ON public.extension_updates TO service_role;

ALTER TABLE public.extension_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read extension_updates"
  ON public.extension_updates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "service manages extension_updates"
  ON public.extension_updates FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER extension_updates_set_updated_at
  BEFORE UPDATE ON public.extension_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX extension_updates_published_idx
  ON public.extension_updates (is_lovepro, published_at DESC);