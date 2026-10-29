create or replace function public.get_pos_doku_payment_timers(p_order_ids uuid[])
returns table(order_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (a.order_id) a.order_id, a.created_at
  from public.doku_payment_attempts a
  where a.order_id = any(p_order_ids)
    and a.status = 'pending'
    and exists (
      select 1 from public.user_store_access usa
      where usa.user_id = auth.uid() and usa.store_id = a.store_id
    )
  order by a.order_id, a.created_at desc;
$$;

revoke all on function public.get_pos_doku_payment_timers(uuid[]) from public, anon;
grant execute on function public.get_pos_doku_payment_timers(uuid[]) to authenticated;