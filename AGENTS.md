# Project Architecture Rules

- Unsubmitted POS orders are persisted as browser drafts scoped to cashier and outlet, then converted to normal orders only at checkout; this keeps suggested payment amounts and unfinished carts out of financial reports.

- Sidebar colors alias the shared surface and text tokens; mobile navigation uses an opaque sheet and touch-sized controls independently of desktop collapse state, preventing background content from obscuring labels.

- POS checkout confirms an outlet staff member before switching the catalog to payment; attribution uses the existing attendant_name field without changing creator identity. QRIS DOKU selection immediately saves an unpaid order and embeds the hosted doku-checkout page in the payment panel; retries reuse the persisted order and the cart is locked while paying to prevent duplicate invoices or changed totals. The panel hides DOKU's hosted branding zone (countdown bar, language picker, outlet logo and name) by cropping a per-width offset measured from that page and shows ANKA's own QR countdown instead, because DOKU offers no white-label checkout and the raw QR payload needs separate SNAP credentials. Only the signed doku-webhook notification may mark it paid; status checks only read the outlet-scoped order.

- DOKU credentials are entered directly in outlet settings, encrypted server-side in a service-only table, and never returned to the browser; configuration writes require outlet-admin authorization, while signed idempotent notifications alone settle gateway orders.
- Booking payment selectors derive DOKU options from outlet-keyed, freshly fetched public channel settings through the shared channel helper; preserve saved edit labels without changing booking settlement or payment-proof rules.

- Expense report system receipts reuse the authenticated transaction receipt page rather than storing generated copies, so receipt data and outlet print settings stay consistent.

- Report column filters commit draft selections and sorting only on confirmation; a shared pure filtering pipeline feeds totals, pagination, and exports to keep every output aligned.
- Purchase and sales tables reuse the report column-filter hook with display-aligned value accessors and outlet/view-scoped state, so filter controls stay consistent without changing stored financial data.

- User-visible account errors must pass through the shared safe-message mapper, including parsed non-success function response bodies; raw service messages remain diagnostic-only so users receive actionable Indonesian explanations.
- Password forms do not impose character-combination rules beyond the hosted policy; leaked-password protection stays enabled so flexibility does not weaken compromised-password checks.

- Active navigation is styled through shared semantic navigation tokens and state selectors; custom period buttons expose data-navigation and aria-pressed so selections stay consistent without recoloring form inputs.

- Sales report costs and discounts use room price snapshots plus line-item subtotals; received payments stay separate and are never discounted again, including exports.
- POS item reports read saved order items without an item-to-product embedded relationship; resolve product costs separately within the outlet so absent product links cannot hide historical sales, and expose load failures instead of treating them as empty results.

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
- Grouped booking billing uses a shared outlet-scoped aggregator and an RLS-respecting atomic billing RPC; payments/products remain on one owner while operational status and times update only the selected room, preventing duplicate revenue.
- Booking receipts use the detail booking's shared billing aggregator for single and multi-room totals; stay duration and checkout follow calendar mode and saved stay duration, never the variant's billing period, preventing monthly rates from becoming months of stay.
- Booking payment dialogs add to received payments without rewriting room rates or operational statuses; settlement feedback follows a successful persisted billing read, preventing false paid animations and duplicate room revenue.
