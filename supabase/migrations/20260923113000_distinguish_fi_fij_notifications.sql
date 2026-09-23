-- Distinguish FI and FIJ in one-day meeting reminders.
create or replace function public.queue_meeting_reminders(p_from timestamp with time zone default now())
returns integer language plpgsql security definer set search_path = ''
as $function$
declare m record; r record; n integer:=0;
begin
  for m in select mt.*,f.family_type,f.name family_name from public.meetings mt left join public.families f on f.id=mt.family_id
    where mt.status<>'cancelled' and mt.planned_start is not null and mt.planned_start between p_from+interval '23 hours' and p_from+interval '25 hours' loop
    for r in select distinct ra.member_id from public.role_assignments ra where ra.active=true and ((ra.family_id=m.family_id and ra.role in('pilote','copilote')) or ra.role in(case when m.family_type='FIJ' then 'responsable_fij' else 'responsable_fi' end,case when m.family_type='FIJ' then 'coordinateur_fij' else 'coordinateur_fi' end,'pasteur','super_admin')) loop
      perform public.queue_notification(r.member_id,m.family_id,'meeting.reminder_1d','Rencontre '||case when m.family_type='FIJ' then 'FIJ' else 'FI' end||' demain — '||coalesce(m.title,'Rencontre')||' · '||coalesce(m.family_name,'Famille'),
        'Demain '||to_char(m.planned_start at time zone 'Europe/Paris','DD/MM/YYYY')||' à '||to_char(m.planned_start at time zone 'Europe/Paris','HH24:MI')||' · '||case when m.family_type='FIJ' then 'FIJ' else 'FI' end||' : '||coalesce(m.family_name,'Famille')||case when m.theme is not null and trim(m.theme)<>'' then ' · Thème : '||m.theme else '' end,
        'Rencontres',m.id,'normal','open_meeting',jsonb_build_object('meeting_id',m.id),'meeting-1d-'||m.id||'-'||r.member_id);
      n:=n+1;
    end loop;
  end loop;
  return n;
end $function$;

create or replace function public.queue_meeting_reminders_1d()
returns integer language plpgsql security definer set search_path = ''
as $function$
declare target_date date := (now() at time zone 'Europe/Paris')::date + 1; inserted_count integer:=0;
begin
  with candidates as (
    select m.id meeting_id,m.family_id,m.title,f.name family_name,f.family_type,m.planned_start,m.theme,r.member_id
    from public.meetings m join public.families f on f.id=m.family_id join public.role_assignments r on r.family_id=m.family_id and r.active and r.role in ('pilote','copilote')
    where m.scheduled_date=target_date and coalesce(m.status,'scheduled') not in ('cancelled','canceled')
  ), ins as (
    insert into public.notifications(member_id,family_id,category,title,body,target_module,target_id,priority,action_key,action_payload,dedupe_key,push_requested)
    select c.member_id,c.family_id,'meeting.reminder_1d','Rencontre '||case when c.family_type='FIJ' then 'FIJ' else 'FI' end||' demain — '||coalesce(c.title,'Rencontre')||' · '||coalesce(c.family_name,'Famille'),
      'Demain '||to_char(target_date,'DD/MM/YYYY')||case when c.planned_start is not null then ' à '||to_char(c.planned_start at time zone 'Europe/Paris','HH24:MI') else '' end||' · '||case when c.family_type='FIJ' then 'FIJ' else 'FI' end||' : '||coalesce(c.family_name,'Famille')||case when c.theme is not null and trim(c.theme)<>'' then ' · Thème : '||c.theme else '' end,
      'Rencontres',c.meeting_id,'normal','open_meeting',jsonb_build_object('meeting_id',c.meeting_id),'meeting-1d:'||c.meeting_id||':'||c.member_id,true
    from candidates c on conflict(dedupe_key) where dedupe_key is not null do nothing returning 1)
  select count(*) into inserted_count from ins;
  with av as (
    select distinct on(t.id) t.id template_id,t.family_type,t.name,v.id version_id,v.weekday,v.start_time,coalesce(v.title,t.name) title
    from public.meeting_templates t join public.meeting_template_versions v on v.template_id=t.id
    where t.active and v.effective_from<=target_date and (v.effective_to is null or v.effective_to>=target_date)
    order by t.id,v.effective_from desc,v.id desc
  ), vv as (
    select f.id family_id,f.name family_name,f.family_type,av.version_id,av.title,av.start_time,r.member_id
    from av join public.families f on f.family_type=av.family_type join public.role_assignments r on r.family_id=f.id and r.active and r.role in ('pilote','copilote')
    where extract(dow from target_date)::int=av.weekday
      and not exists(select 1 from public.calendar_pauses p where p.active and p.starts_on<=target_date and p.ends_on>=target_date and p.scope in ('BOTH',f.family_type))
      and not exists(select 1 from public.meetings m where m.family_id=f.id and (m.scheduled_date=target_date or m.original_scheduled_date=target_date))
  ), ins2 as (
    insert into public.notifications(member_id,family_id,category,title,body,target_module,priority,action_key,action_payload,dedupe_key,push_requested)
    select v.member_id,v.family_id,'meeting.reminder_1d','Rencontre '||case when v.family_type='FIJ' then 'FIJ' else 'FI' end||' demain — '||v.title||' · '||v.family_name,
      'Demain '||to_char(target_date,'DD/MM/YYYY')||' à '||to_char(v.start_time,'HH24:MI')||' · '||case when v.family_type='FIJ' then 'FIJ' else 'FI' end||' : '||v.family_name,
      'Rencontres','normal','open_meetings',jsonb_build_object('family_id',v.family_id,'date',target_date,'template_version_id',v.version_id),
      'virtual-meeting-1d:'||v.family_id||':'||target_date||':'||v.member_id,true
    from vv v on conflict(dedupe_key) where dedupe_key is not null do nothing returning 1)
  select inserted_count+count(*) into inserted_count from ins2;
  return inserted_count;
end $function$;

update public.notifications n
set title=regexp_replace(n.title,'^Rencontre demain','Rencontre '||case when f.family_type='FIJ' then 'FIJ' else 'FI' end||' demain'),
    body=replace(n.body,'FI/FIJ :',case when f.family_type='FIJ' then 'FIJ : ' else 'FI : ' end)
from public.families f
where n.family_id=f.id and n.category='meeting.reminder_1d' and n.title like 'Rencontre demain%';
