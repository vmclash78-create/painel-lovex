CREATE TABLE public.client_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  plan_id text NOT NULL,
  amount numeric NOT NULL,
  license_key text,
  license_id text,
  license_db text,
  target_db text NOT NULL,
  customer_phone text,
  status text NOT NULL DEFAULT 'pending',
  mercadopago_payment_id text,
  qr_code text,
  qr_code_base64 text,
  pix_copy_paste text,
  new_license_key text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.client_purchases TO service_role;

ALTER TABLE public.client_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service manages client_purchases"
  ON public.client_purchases FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER client_purchases_set_updated_at
  BEFORE UPDATE ON public.client_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();