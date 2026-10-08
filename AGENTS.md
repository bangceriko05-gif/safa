# Project Architecture Rules

- Multi-room bookings remain separate `bookings` rows linked by `booking_group_id`; the group owns the shared BID so room calendars and per-room pricing stay independent.
- Walk-in multi-room payment amounts and evidence live only on the primary row; new OTA multi-room totals are split exactly across room rows while evidence remains on the primary row.
- Every room booking snapshots its selected variant's unit price in `variant_price_override`; financial displays must prefer this snapshot over the current variant price so later rate changes cannot alter historical totals.
- Booking payment inputs share a caret-preserving, formatted editing draft and commit billing calculations on blur; fixed-height booking dialogs and stable billing rows prevent content updates from moving the form.