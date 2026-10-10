# Project Architecture Rules

- Booking WhatsApp links use a shared status-aware formatter and outlet-keyed message settings query; links open prefilled chats without sending messages or using connector credentials.

- Calendar payment captions share a display-only formatter for received payment methods, so both calendar types stay consistent without altering financial status.

- Report panels mount on first selection and retain their loaded state until the outlet changes; this removes repeat tab-loading delays without fetching every report at startup.
- Independent report queries run in parallel, and report caches are keyed by outlet, date range, and status; this reduces network waterfalls without mixing financial scopes.

- BID transaction cancellation entry points use the shared reason-required cancellation dialog before writing cancelled status, preserving the reason in the existing notes or description field to keep confirmation and audit context consistent.

- Sidebar tooltips render through a body portal above overlay layers; sidebar and main content use separate ordered stacking contexts so dashboard content cannot obscure navigation labels without changing menu layout or scroll behavior.

- Multi-room bookings remain separate `bookings` rows linked by `booking_group_id`; the group owns the shared BID so room calendars and per-room pricing stay independent.
- Walk-in multi-room payment amounts and evidence live only on the primary row; new OTA multi-room totals are split exactly across room rows while evidence remains on the primary row.
- Every room booking snapshots its selected variant's unit price in `variant_price_override`; financial displays must prefer this snapshot over the current variant price so later rate changes cannot alter historical totals.
- Booking payment inputs share a caret-preserving, formatted editing draft and commit billing calculations on blur; fixed-height booking dialogs and stable billing rows prevent content updates from moving the form.