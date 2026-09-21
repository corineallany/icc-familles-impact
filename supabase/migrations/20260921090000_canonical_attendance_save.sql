create or replace function public.save_attendance_entry(
  p_meeting_id bigint,
  p_program_id bigint,
  p_member_id bigint,
  p_family_id bigint,
  p_present boolean,
  p_arrival_time time without time zone default null,
  p_arrival_unknown boolean default false,
  p_is_late boolean default false,
  p_late_reason text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_row public.attendance;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if ((p_meeting_id is null)::int + (p_program_id is null)::int) <> 1 then raise exception 'ATTENDANCE_TARGET_INVALID'; end if;
  if p_family_id is not null then
    if not public.can_manage_family(p_family_id) then raise exception 'ATTENDANCE_NOT_AUTHORIZED'; end if;
    if not exists (
      select 1 from public.member_assignments a
      where a.member_id=p_member_id and a.family_id=p_family_id
        and a.starts_at<=current_date and (a.ends_at is null or a.ends_at>=current_date)
    ) then raise exception 'ATTENDANCE_MEMBER_FAMILY_INVALID'; end if;
  elsif not public.is_direction() then
    raise exception 'ATTENDANCE_NOT_AUTHORIZED';
  end if;
  if p_present is not true or p_arrival_unknown then
    p_arrival_time := null; p_is_late := false; p_late_reason := null;
  elsif not p_is_late then
    p_late_reason := null;
  end if;
  if p_meeting_id is not null then
    select id into v_id from public.attendance
    where meeting_id=p_meeting_id and member_id=p_member_id
    order by id desc limit 1;
  else
    select id into v_id from public.attendance
    where program_id=p_program_id and member_id=p_member_id
    order by id desc limit 1;
  end if;
  if v_id is null then
    insert into public.attendance(
      meeting_id,program_id,member_id,family_id,present,arrival_time,arrival_unknown,
      marked_by,marked_at,late_reason,is_late,entry_mode
    ) values (
      p_meeting_id,p_program_id,p_member_id,p_family_id,coalesce(p_present,false),
      p_arrival_time,coalesce(p_arrival_unknown,false),auth.uid(),now(),
      p_late_reason,coalesce(p_is_late,false),'manual'
    ) returning * into v_row;
  else
    update public.attendance set
      family_id=p_family_id,present=coalesce(p_present,false),arrival_time=p_arrival_time,
      arrival_unknown=coalesce(p_arrival_unknown,false),marked_by=auth.uid(),marked_at=now(),
      late_reason=p_late_reason,is_late=coalesce(p_is_late,false),entry_mode='manual'
    where id=v_id returning * into v_row;
  end if;
  return v_row;
end;
$$;

revoke all on function public.save_attendance_entry(bigint,bigint,bigint,bigint,boolean,time without time zone,boolean,boolean,text) from public;
grant execute on function public.save_attendance_entry(bigint,bigint,bigint,bigint,boolean,time without time zone,boolean,boolean,text) to authenticated;
