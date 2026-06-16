-- Констрейнты из 14_database_schema_mvp.md, которые Prisma не выражает в schema.
-- Запускать после `prisma db push` (см. npm run db:constraints / db:setup). Идемпотентно.

-- Один активный booking (status='booked') на пару (event_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_event_user
  ON bookings (event_id, user_id)
  WHERE status = 'booked';

-- CHECK-констрейнты событий
DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_capacity_positive CHECK (capacity > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_time_valid CHECK (ends_at > starts_at);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_quorum_valid CHECK (min_quorum IS NULL OR min_quorum <= capacity);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Транзакция не может быть на нулевую сумму
DO $$ BEGIN
  ALTER TABLE transactions ADD CONSTRAINT transactions_amount_not_zero CHECK (amount <> 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
