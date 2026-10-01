# Project Architecture Rules

- Multi-room bookings remain separate `bookings` rows linked by `booking_group_id`; the group owns the shared BID so room calendars and per-room pricing stay independent.
- Multi-room payment amounts and payment evidence live only on the primary booking row; sibling rows store zero payment to prevent duplicate revenue and false paid status.