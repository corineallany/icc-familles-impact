-- Follow-up for contextual notifications and Pilotage reporting.
-- The live database was updated directly first; this migration records the same function definition for repository history.
create or replace function public.queue_meeting_reminders_1d()
returns integer language plpgsql security definer set search_path = ''
as $function$
declare target_date date := (now() at time zone 'Europe/Paris')::date + 1; inserted_count integer:=0;
begin
  with candidates as (
    select m.id meeting_id,m.family_id,coalesce(ch.new_title,m.title) title,f.name family_name,m.planned_start,coalesce(m.theme,ch.new_theme) theme,coalesce(m.theme_description,ch.new_theme_description) theme_description,r.member_id
    from public.meetings m join public.families f on f.id=m.family_id join public.role_assignments r on r.family_id=m.family_id and r.active and r.role in ('pilote','copilote')
    left join lateral (select sc.new_title,sc.new_theme,sc.new_theme_description from public.schedule_changes sc where sc.action='modified' and sc.template_version_id=m.template_version_id and sc.old_date=coalesce(m.original_scheduled_date,m.scheduled_date) order by sc.changed_at desc,sc.id desc limit 1) ch on true
    where m.scheduled_date=target_date and coalesce(m.status,'scheduled') not in ('cancelled','canceled')
  ), ins as (
    insert into public.notifications(member_id,family_id,category,title,body,target_module,target_id,priority,action_key,action_payload,dedupe_key,push_requested)
    select c.member_id,c.family_id,'meeting.reminder_1d','Rencontre demain — '||coalesce(c.title,'FI/FIJ')||' · '||coalesce(c.family_name,'FI/FIJ'),'Demain '||to_char(target_date,'DD/MM/YYYY')||case when c.planned_start is not null then ' à '||to_char(c.planned_start at time zone 'Europe/Paris','HH24:MI') else '' end||' · FI/FIJ : '||coalesce(c.family_name,'FI/FIJ')||case when c.theme is not null and trim(c.theme)<>'' then ' · Thème : '||c.theme else '' end,'Rencontres',c.meeting_id,'normal','open_meeting',jsonb_build_object('meeting_id',c.meeting_id),'meeting-1d:'||c.meeting_id||':'||c.member_id,true
    from candidates c on conflict(dedupe_key) where dedupe_key is not null do nothing returning 1)
  select count(*) into inserted_count from ins;
  with av as (
    select distinct on(t.id) t.id template_id,t.family_type,t.name,v.id version_id,v.weekday,v.start_time,v.end_time,coalesce(v.title,t.name) title,v.reporting_required
    from public.meeting_templates t join public.meeting_template_versions v on v.template_id=t.id
    where t.active and v.effective_from<=target_date and (v.effective_to is null or v.effective_to>=target_date)
    order by t.id,v.effective_from desc,v.id desc
  ), vv as (
    select f.id family_id,f.name family_name,av.family_type,av.version_id,coalesce(ch.new_title,av.title) title,av.start_time,av.end_time,av.reporting_required,r.member_id,ch.new_theme theme,ch.new_theme_description theme_description
    from av join public.families f on f.family_type=av.family_type join public.role_assignments r on r.family_id=f.id and r.active and r.role in ('pilote','copilote')
    left join lateral (select sc.new_title,sc.new_theme,sc.new_theme_description from public.schedule_changes sc where sc.action='modified' and sc.template_version_id=av.version_id and sc.old_date=target_date order by sc.changed_at desc,sc.id desc limit 1) ch on true
    where extract(dow from target_date)::int=av.weekday and not exists(select 1 from public.calendar_pauses p where p.active and p.starts_on<=target_date and p.ends_on>=target_date and p.scope in ('BOTH',f.family_type)) and not exists(select 1 from public.meetings m where m.family_id=f.id and (m.scheduled_date=target_date or m.original_scheduled_date=target_date))
  ), ins2 as (
    insert into public.notifications(member_id,family_id,category,title,body,target_module,priority,action_key,action_payload,dedupe_key,push_requested)
    select v.member_id,v.family_id,'meeting.reminder_1d','Rencontre demain — '||v.title||' · '||v.family_name,'Demain '||to_char(target_date,'DD/MM/YYYY')||' à '||to_char(v.start_time,'HH24:MI')||' · FI/FIJ : '||v.family_name||case when v.theme is not null and trim(v.theme)<>'' then ' · Thème : '||v.theme else '' end,'Rencontres','normal','open_meetings',jsonb_build_object('family_id',v.family_id,'date',target_date,'template_version_id',v.version_id),'virtual-meeting-1d:'||v.family_id||':'||target_date||':'||v.member_id,true
    from vv v on conflict(dedupe_key) where dedupe_key is not null do nothing returning 1)
  select inserted_count+count(*) into inserted_count from ins2;
  return inserted_count;
end $function$;