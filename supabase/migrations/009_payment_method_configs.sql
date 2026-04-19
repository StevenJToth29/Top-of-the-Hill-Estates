CREATE TABLE payment_method_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('short_term', 'long_term')),
  method_key   TEXT NOT NULL,
  label        TEXT NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT true,
  fee_percent  NUMERIC NOT NULL DEFAULT 0,
  fee_flat     NUMERIC NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_type, method_key)
);

ALTER TABLE payment_method_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON payment_method_configs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO payment_method_configs
  (booking_type, method_key, label, is_enabled, fee_percent, fee_flat, sort_order)
VALUES
  ('short_term', 'card',            'Credit / Debit Card', true,  2.9, 0.30, 1),
  ('short_term', 'us_bank_account', 'ACH Bank Transfer',   true,  0,   0,    2),
  ('short_term', 'cashapp',         'Cash App Pay',        true,  2.9, 0.30, 3),
  ('long_term',  'card',            'Credit / Debit Card', false, 2.9, 0.30, 1),
  ('long_term',  'us_bank_account', 'ACH Bank Transfer',   true,  0,   0,    2),
  ('long_term',  'cashapp',         'Cash App Pay',        false, 2.9, 0.30, 3);
