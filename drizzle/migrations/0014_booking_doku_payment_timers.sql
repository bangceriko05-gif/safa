create or replace function public.get_booking_doku_payment_timers(p_booking_ids uuid[])
returns table(booking_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (b.id) b.id, a.created_at
  from public.bookings b
  join public.bookings owner on owner.id = b.id or (b.booking_group_id is not null and owner.booking_group_id = b.booking_group_id)
  join public.doku_booking_attempts a on a.booking_id = owner.id and a.status = 'pending'
  where b.id = any(p_booking_ids)
    and exists (select 1 from public.user_store_access usa where usa.user_id = auth.uid() and usa.store_id = b.store_id)
  order by b.id, a.created_at desc;
$$;
revoke all on function public.get_booking_doku_payment_timers(uuid[]) from public, anon;
grant execute on function public.get_booking_doku_payment_timers(uuid[]) to authenticated;
