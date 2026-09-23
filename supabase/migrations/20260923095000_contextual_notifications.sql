-- Contextual notifications: exact FI/FIJ, meeting title/time/theme, and meeting-click payloads.
create or replace function public.notify_family_leaders()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare fid bigint; mid bigint; ttl text; bdy text; cat text; mod text; tid bigint; act text; ded text;
  fname text; mtitle text; mdate date; mstart timestamptz; mtheme text;
begin
  if tg_table_name='meetings' then
    fid:=new.family_id; cat:='meeting.changed'; mod:='Rencontres'; tid:=new.id; act:='open_meeting';
    select f.name into fname from public.families f where f.id=fid;
    ttl:=case when new.status='cancelled' then 'Rencontre annulée — '||coalesce(fname,'FI/FIJ') when new.status='postponed' then 'Rencontre reportée — '||coalesce(fname,'FI/FIJ') else 'Rencontre mise à jour — '||coalesce(fname,'FI/FIJ') end;
    bdy:=coalesce(new.title,'Rencontre')||' · '||coalesce(fname,'FI/FIJ')||' · '||to_char(new.scheduled_date,'DD/MM/YYYY')||
      case when new.planned_start is not null then ' à '||to_char(new.planned_start at time zone 'Europe/Paris','HH24:MI') else '' end||
      case when new.theme is not null and trim(new.theme)<>'' then ' · Thème : '||new.theme else '' end;
  elsif tg_table_name='reporting' then
    select m.family_id,m.title,m.scheduled_date,m.planned_start,m.theme,f.name into fid,mtitle,mdate,mstart,mtheme,fname
    from public.meetings m join public.families f on f.id=m.family_id where m.id=new.meeting_id;
    cat:='reporting.expected'; mod:='Reporting'; tid:=new.meeting_id; act:='open_reporting';
    ttl:='Reporting mis à jour — '||coalesce(fname,'FI/FIJ');
    bdy:='« '||coalesce(mtitle,'Rencontre')||' » · '||coalesce(fname,'FI/FIJ')||' · '||coalesce(to_char(mdate,'DD/MM/YYYY'),'date inconnue')||
      case when mstart is not null then ' à '||to_char(mstart at time zone 'Europe/Paris','HH24:MI') else '' end||
      case when mtheme is not null and trim(mtheme)<>'' then ' · Thème : '||mtheme else '' end;
  elsif tg_table_name='family_member_roles' then
    fid:=new.family_id; cat:='member.changed'; mod:='FI & FIJ'; tid:=new.family_id; act:=null;
    select f.name into fname from public.families f where f.id=fid;
    ttl:='Rôle FI/FIJ mis à jour — '||coalesce(fname,'FI/FIJ'); bdy:='Rôle local : '||new.role_name;
  else return new; end if;
  if fid is null then return new; end if;
  for mid in select distinct r.member_id from public.role_assignments r where r.family_id=fid and r.active and r.role in ('pilote','copilote') loop
    ded:=cat||':'||tg_table_name||':'||coalesce(tid,0)||':'||mid||':'||extract(epoch from date_trunc('minute',now()))::bigint;
    perform public.queue_notification(mid,fid,cat,ttl,bdy,mod,tid,'normal',act,'{}'::jsonb,ded);
  end loop;
  return new;
end $function$;

create or replace function public.notify_program_change()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare mid bigint; fid bigint; fam record; ttl text; bdy text;
begin
  for fam in select f.id,f.name from public.families f
    where (coalesce(new.target_scope,'ALL_FAMILIES')='SELECTED' and exists(select 1 from public.program_family_targets t where t.program_id=new.id and t.family_id=f.id))
       or (coalesce(new.target_scope,'ALL_FAMILIES')<>'SELECTED' and ((new.include_fi and f.family_type='FI') or (new.include_fij and f.family_type='FIJ'))) loop
    fid:=fam.id;
    ttl:=case when new.status='cancelled' then 'Programme annulé — '||coalesce(fam.name,'FI/FIJ') when new.status='postponed' then 'Programme reporté — '||coalesce(fam.name,'FI/FIJ') else 'Programme mis à jour — '||coalesce(fam.name,'FI/FIJ') end;
    bdy:=coalesce(new.title,'Programme')||' · '||coalesce(fam.name,'FI/FIJ')||' · '||coalesce(to_char(new.scheduled_date,'DD/MM/YYYY'),'date à préciser');
    for mid in select distinct member_id from public.role_assignments where family_id=fid and active and role in('pilote','copilote') loop
      perform public.queue_notification(mid,fid,case when coalesce(new.kind,'') ilike '%prière%' then 'prayer.changed' else 'program.changed' end,ttl,bdy,'Programmes & événements',new.id,'normal',null,'{}'::jsonb,'program-change:'||new.id||':'||mid||':'||extract(epoch from date_trunc('minute',now()))::bigint);
    end loop;
  end loop;
  return new;
end $function$;

create or replace function public.queue_meeting_reminders(p_from timestamp with time zone default now())
returns integer language plpgsql security definer set search_path = ''
as $function$
declare m record; r record; n integer:=0;
begin
  for m in select mt.*,f.family_type,f.name family_name from public.meetings mt left join public.families f on f.id=mt.family_id
    where mt.status<>'cancelled' and mt.planned_start is not null and mt.planned_start between p_from+interval '23 hours' and p_from+interval '25 hours' loop
    for r in select distinct ra.member_id from public.role_assignments ra where ra.active=true and ((ra.family_id=m.family_id and ra.role in('pilote','copilote')) or ra.role in(case when m.family_type='FIJ' then 'responsable_fij' else 'responsable_fi' end,case when m.family_type='FIJ' then 'coordinateur_fij' else 'coordinateur_fi' end,'pasteur','super_admin')) loop
      perform public.queue_notification(r.member_id,m.family_id,'meeting.reminder_1d','Rencontre demain — '||coalesce(m.title,'Rencontre')||' · '||coalesce(m.family_name,'FI/FIJ'),
        'Demain '||to_char(m.planned_start at time zone 'Europe/Paris','DD/MM/YYYY')||' à '||to_char(m.planned_start at time zone 'Europe/Paris','HH24:MI')||' · FI/FIJ : '||coalesce(m.family_name,'FI/FIJ')||case when m.theme is not null and trim(m.theme)<>'' then ' · Thème : '||m.theme else '' end,
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
    select m.id meeting_id,m.family_id,m.title,f.name family_name,m.planned_start,m.theme,r.member_id
    from public.meetings m join public.families f on f.id=m.family_id join public.role_assignments r on r.family_id=m.family_id and r.active and r.role in ('pilote','copilote')
    where m.scheduled_date=target_date and coalesce(m.status,'scheduled') not in ('cancelled','canceled')
  ), ins as (
    insert into public.notifications(member_id,family_id,category,title,body,target_module,target_id,priority,action_key,action_payload,dedupe_key,push_requested)
    select c.member_id,c.family_id,'meeting.reminder_1d','Rencontre demain — '||coalesce(c.title,'FI/FIJ')||' · '||coalesce(c.family_name,'FI/FIJ'),
      'Demain '||to_char(target_date,'DD/MM/YYYY')||case when c.planned_start is not null then ' à '||to_char(c.planned_start at time zone 'Europe/Paris','HH24:MI') else '' end||' · FI/FIJ : '||coalesce(c.family_name,'FI/FIJ')||case when c.theme is not null and trim(c.theme)<>'' then ' · Thème : '||c.theme else '' end,
      'Rencontres',c.meeting_id,'normal','open_meeting',jsonb_build_object('meeting_id',c.meeting_id),'meeting-1d:'||c.meeting_id||':'||c.member_id,true
    from candidates c on conflict(dedupe_key) where dedupe_key is not null do nothing returning 1)
  select count(*) into inserted_count from ins;
  with av as (
    select distinct on(t.id) t.id template_id,t.family_type,t.name,v.id version_id,v.weekday,v.start_time,coalesce(v.title,t.name) title
    from public.meeting_templates t join public.meeting_template_versions v on v.template_id=t.id
    where t.active and v.effective_from<=target_date and (v.effective_to is null or v.effective_to>=target_date)
    order by t.id,v.effective_from desc,v.id desc
  ), vv as (
    select f.id family_id,f.name family_name,av.family_type,av.version_id,av.title,av.start_time,r.member_id
    from av join public.families f on f.family_type=av.family_type join public.role_assignments r on r.family_id=f.id and r.active and r.role in ('pilote','copilote')
    where extract(dow from target_date)::int=av.weekday
      and not exists(select 1 from public.calendar_pauses p where p.active and p.starts_on<=target_date and p.ends_on>=target_date and p.scope in ('BOTH',f.family_type))
      and not exists(select 1 from public.meetings m where m.family_id=f.id and (m.scheduled_date=target_date or m.original_scheduled_date=target_date))
  ), ins2 as (
    insert into public.notifications(member_id,family_id,category,title,body,target_module,priority,action_key,action_payload,dedupe_key,push_requested)
    select v.member_id,v.family_id,'meeting.reminder_1d','Rencontre demain — '||v.title||' · '||v.family_name,
      'Demain '||to_char(target_date,'DD/MM/YYYY')||' à '||to_char(v.start_time,'HH24:MI')||' · FI/FIJ : '||v.family_name,
      'Rencontres','normal','open_meetings',jsonb_build_object('family_id',v.family_id,'date',target_date,'template_version_id',v.version_id),
      'virtual-meeting-1d:'||v.family_id||':'||target_date||':'||v.member_id,true
    from vv v on conflict(dedupe_key) where dedupe_key is not null do nothing returning 1)
  select inserted_count+count(*) into inserted_count from ins2;
  return inserted_count;
end $function$;

update public.notifications n set
  title='Reporting mis à jour — '||coalesce(f.name,'FI/FIJ'),
  body='« '||coalesce(m.title,'Rencontre')||' » · '||coalesce(f.name,'FI/FIJ')||' · '||coalesce(to_char(m.scheduled_date,'DD/MM/YYYY'),'date inconnue')||
    case when m.planned_start is not null then ' à '||to_char(m.planned_start at time zone 'Europe/Paris','HH24:MI') else '' end||
    case when m.theme is not null and trim(m.theme)<>'' then ' · Thème : '||m.theme else '' end
from public.meetings m join public.families f on f.id=m.family_id where n.category='reporting.expected' and n.target_id=m.id;

update public.notifications n set
  title='Rencontre demain — '||coalesce(m.title,'Rencontre')||' · '||coalesce(f.name,'FI/FIJ'),
  body='Demain '||to_char(m.planned_start at time zone 'Europe/Paris','DD/MM/YYYY')||' à '||to_char(m.planned_start at time zone 'Europe/Paris','HH24:MI')||
    ' · FI/FIJ : '||coalesce(f.name,'FI/FIJ')||case when m.theme is not null and trim(m.theme)<>'' then ' · Thème : '||m.theme else '' end
from public.meetings m join public.families f on f.id=m.family_id where n.category='meeting.reminder_1d' and n.target_id=m.id;

update public.notifications n set
  title='Rencontre demain — '||coalesce((select coalesce(v.title,t.name) from public.meeting_template_versions v join public.meeting_templates t on t.id=v.template_id where v.id=(n.action_payload->>'template_version_id')::bigint),'Rencontre')||
    ' · '||coalesce(f.name,'FI/FIJ'),
  body='Demain '||to_char((n.action_payload->>'date')::date,'DD/MM/YYYY')||' à '||
    coalesce((select to_char(v.start_time,'HH24:MI') from public.meeting_template_versions v where v.id=(n.action_payload->>'template_version_id')::bigint),'—')||
    ' · FI/FIJ : '||coalesce(f.name,'FI/FIJ')
from public.families f where n.category='meeting.reminder_1d' and n.target_id is null and n.action_payload ? 'template_version_id' and f.id=(n.action_payload->>'family_id')::bigint;
