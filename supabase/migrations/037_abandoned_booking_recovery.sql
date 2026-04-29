-- Part 1: Extend trigger event ENUM (must commit before use)
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'booking_abandoned';
