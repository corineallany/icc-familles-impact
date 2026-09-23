-- v266: keep one device record per account/device label while using a stable IndexedDB fingerprint client-side.
create or replace function public.save_my_push_device(
  p_device_name text,
  p_device_type text,
  p_browser text,
  p_permission_state text,
  p_subscription jsonb,
  p_fingerprint text default null,
  p_enabled boolean default true
) returns bigint
language plpgsql
security definer
set search_path='public'
as $$
declare
  uid uuid:=auth.uid();
  did bigint;
begin
  if uid is null then raise exception 'Authentification requise'; end if;

  select id into did
  from public.user_devices
  where user_id=uid
    and (
      (p_fingerprint is not null and device_fingerprint is not distinct from p_fingerprint)
      or (p_fingerprint is null and device_name is not distinct from p_device_name and browser is not distinct from p_browser)
      or (p_fingerprint is not null and device_name is not distinct from p_device_name and browser is not distinct from p_browser)
    )
  order by (device_fingerprint is not distinct from p_fingerprint) desc, last_seen_at desc
  limit 1;

  if did is null then
    insert into public.user_devices(user_id,device_name,device_type,browser,push_enabled,last_seen_at,push_subscription,permission_state,device_fingerprint)
    values(uid,p_device_name,p_device_type,p_browser,coalesce(p_enabled,false),now(),p_subscription,p_permission_state,p_fingerprint)
    returning id into did;
  else
    update public.user_devices
    set device_name=p_device_name,
        device_type=p_device_type,
        browser=p_browser,
        last_seen_at=now(),
        permission_state=p_permission_state,
        push_subscription=case when p_subscription is not null then p_subscription else push_subscription end,
        push_enabled=case when p_subscription is not null then coalesce(p_enabled,false) else push_enabled end,
        device_fingerprint=coalesce(p_fingerprint,device_fingerprint)
    where id=did;

    delete from public.user_devices
    where user_id=uid
      and device_name is not distinct from p_device_name
      and browser is not distinct from p_browser
      and id<>did;
  end if;

  return did;
end;
$$;
