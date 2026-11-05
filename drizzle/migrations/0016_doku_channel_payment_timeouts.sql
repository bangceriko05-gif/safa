alter table public.website_payment_settings add column if not exists doku_channel_timeouts jsonb not null default '{}'::jsonb;
alter table public.doku_payment_attempts add column if not exists due_minutes integer not null default 60;
alter table public.doku_booking_attempts add column if not exists due_minutes integer not null default 60;

update public.website_payment_settings w
set doku_channel_timeouts = coalesce((select jsonb_object_agg(c, 60) from jsonb_array_elements_text(w.doku_channels) c), '{}'::jsonb)
where jsonb_typeof(w.doku_channels) = 'array';

drop function if exists public.get_pos_doku_payment_timers(uuid[]);
create function public.get_pos_doku_payment_timers(p_order_ids uuid[])
returns table(order_id uuid, created_at timestamptz, due_minutes integer)
language sql stable security definer set search_path = public
as $$
  select distinct on (a.order_id) a.order_id, a.created_at, a.due_minutes
  from public.doku_payment_attempts a
  where a.order_id = any(p_order_ids) and a.status = 'pending'
    and exists (select 1 from public.user_store_access usa where usa.user_id = auth.uid() and usa.store_id = a.store_id)
  order by a.order_id, a.created_at desc;
$$;
revoke all on function public.get_pos_doku_payment_timers(uuid[]) from public, anon;
grant execute on function public.get_pos_doku_payment_timers(uuid[]) to authenticated;

drop function if exists public.get_booking_doku_payment_timers(uuid[]);
create function public.get_booking_doku_payment_timers(p_booking_ids uuid[])
returns table(booking_id uuid, created_at timestamptz, due_minutes integer)
language sql stable security definer set search_path = public
as $$
  select distinct on (b.id) b.id, a.created_at, a.due_minutes
  from public.bookings b
  join public.bookings owner on owner.id = b.id or (b.booking_group_id is not null and owner.booking_group_id = b.booking_group_id)
  join public.doku_booking_attempts a on a.booking_id = owner.id and a.status = 'pending'
  where b.id = any(p_booking_ids)
    and exists (select 1 from public.user_store_access usa where usa.user_id = auth.uid() and usa.store_id = b.store_id)
  order by b.id, a.created_at desc;
$$;
revoke all on function public.get_booking_doku_payment_timers(uuid[]) from public, anon;
grant execute on function public.get_booking_doku_payment_timers(uuid[]) to authenticated;