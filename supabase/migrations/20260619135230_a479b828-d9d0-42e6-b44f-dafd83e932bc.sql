
-- ============ Base tables (resellers, licenses) ============
CREATE TABLE IF NOT EXISTS public.resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  max_keys integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  password text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resellers TO anon, authenticated;
GRANT ALL ON public.resellers TO service_role;
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resellers public" ON public.resellers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  user_name text,
  status text DEFAULT 'active',
  expires_at timestamptz,
  activated_at timestamptz,
  device_id text,
  session_id text,
  max_devices integer DEFAULT 1,
  duration_minutes integer,
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS licenses_reseller_idx ON public.licenses(reseller_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO anon, authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "licenses public" ON public.licenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ Billing module ============
CREATE TABLE public.reseller_key_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL UNIQUE REFERENCES public.resellers(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.reseller_key_balances TO service_role;
ALTER TABLE public.reseller_key_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "balances service" ON public.reseller_key_balances FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.reseller_key_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase','license_created','refund','adjustment')),
  quantity integer NOT NULL,
  description text,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.reseller_key_transactions (reseller_id, created_at DESC);
GRANT ALL ON public.reseller_key_transactions TO service_role;
ALTER TABLE public.reseller_key_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx service" ON public.reseller_key_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.reseller_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  quantity integer NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  mercadopago_payment_id text UNIQUE,
  qr_code text,
  qr_code_base64 text,
  pix_copy_paste text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.reseller_purchases (reseller_id, created_at DESC);
GRANT ALL ON public.reseller_purchases TO service_role;
ALTER TABLE public.reseller_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases service" ON public.reseller_purchases FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_licenses_upd BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_balances_upd BEFORE UPDATE ON public.reseller_key_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_purchases_upd BEFORE UPDATE ON public.reseller_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.consume_reseller_key(_reseller_id uuid, _description text DEFAULT 'Licença criada', _reference_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new_balance integer;
BEGIN
  UPDATE public.reseller_key_balances SET balance = balance - 1
    WHERE reseller_id = _reseller_id AND balance > 0
    RETURNING balance INTO _new_balance;
  IF _new_balance IS NULL THEN RETURN false; END IF;
  INSERT INTO public.reseller_key_transactions(reseller_id, type, quantity, description, reference_id)
    VALUES (_reseller_id, 'license_created', -1, _description, _reference_id);
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.consume_reseller_key(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_reseller_key(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.credit_reseller_keys(_reseller_id uuid, _quantity integer, _description text, _reference_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new_balance integer;
BEGIN
  INSERT INTO public.reseller_key_balances(reseller_id, balance)
    VALUES (_reseller_id, _quantity)
    ON CONFLICT (reseller_id)
    DO UPDATE SET balance = public.reseller_key_balances.balance + EXCLUDED.balance
    RETURNING balance INTO _new_balance;
  INSERT INTO public.reseller_key_transactions(reseller_id, type, quantity, description, reference_id)
    VALUES (_reseller_id, 'purchase', _quantity, _description, _reference_id);
  RETURN _new_balance;
END; $$;
REVOKE ALL ON FUNCTION public.credit_reseller_keys(uuid, integer, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.credit_reseller_keys(uuid, integer, text, text) TO service_role;
