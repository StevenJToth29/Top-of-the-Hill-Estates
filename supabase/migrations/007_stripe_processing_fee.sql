-- 1. Add Stripe fee config columns to site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS stripe_fee_percent NUMERIC NOT NULL DEFAULT 2.9,
  ADD COLUMN IF NOT EXISTS stripe_fee_flat    NUMERIC NOT NULL DEFAULT 0.30;

-- 2. Add processing_fee snapshot column to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS processing_fee NUMERIC NOT NULL DEFAULT 0;

-- 3. Add is_refundable flag to booking_fees (existing rows stay refundable)
ALTER TABLE booking_fees
  ADD COLUMN IF NOT EXISTS is_refundable BOOLEAN NOT NULL DEFAULT TRUE;
