# Project Architecture Rules

- Multi-room bookings remain separate `bookings` rows linked by `booking_group_id`; the group owns the shared BID so room calendars and per-room pricing stay independent.
- Walk-in multi-room payment amounts and evidence live only on the primary row; new OTA multi-room totals are split exactly across room rows while evidence remains on the primary row.