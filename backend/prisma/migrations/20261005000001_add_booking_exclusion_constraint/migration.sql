-- ==============================================================================
-- Hand-edited Migration: PostgreSQL Exclusion Constraint (Amendment F1)
-- Requires btree_gist extension to support = operator on TEXT within GiST index.
-- Ensures no two active bookings (HELD or CONFIRMED) on the same slot can overlap.
-- Default range [startTime, endTime) is half-open, accepting back-to-back bookings.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
ADD CONSTRAINT "booking_slot_timerange_no_overlap"
EXCLUDE USING gist (
  "slotId" WITH =,
  tstzrange("startTime", "endTime") WITH &&
)
WHERE (status IN ('HELD', 'CONFIRMED'));
