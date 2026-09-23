/* Notifications v4 — préférences personnelles depuis le profil utilisateur. */
const NOTIF_MODULES={
 'Rencontres':[['meeting.reminder_1d','Rappel 1 jour avant une rencontre'],['meeting.changed','Rencontre modifiée, reportée ou annulée']],
 'Reporting':[['reporting.expected','Reporting attendu'],['reporting.reminder','Relance de Reporting reçue']],
 'Suivis':[['reporting.followup_required','Reporting avec nécessité de suivi'],['followup.changed','Suivi attribué, modifié ou clôturé']],
 'Programmes':[['program.changed','Programme ou événement modifié']],
 'Prière':[['prayer.changed','Programme / Reporting de prière']],
 'Membres':[['member.changed','Mouvement ou changement important d’un membre']],
 'Administration':[['admin.access','Rôle, permission ou accès modifié']]
};
let notificationPrefsV4=[],notificationCatalogV4=[];
const _loadNotificationsV4=loadData;loadData=async function(){await _loadNotificationsV4();if(!profile?.member?.id)return;const [p,c,n]=await Promise.all([sb.from('notification_preferences').select('*').eq('member_id',profile.member.id),sb.from('notification_event_catalog').select('*'),sb.from('notifications').select('*').order('created_at',{ascending:false})]);notificationPrefsV4=p.data||[];notificationCatalogV4=c.data||[];db.notifications=n.data||[]};
function notifPref(key){return notificationPrefsV4.find(x=>x.category===key)||{push_enabled:true,in_app_enabled:true}}
function notifAllowed(key){const c=notificationCatalogV4.find(x=>x.key===key);return !(c?.direction_only)&&!isDirection()?false:true}
async function saveNotifPref(key,channel,on){const old=notifPref(key),payload={member_id:profile.member.id,category:key,push_enabled:channel==='push'?on:old.push_enabled,in_app_enabled:channel==='inapp'?on:old.in_app_enabled,scope:'my_perimeter',updated_at:new Date().toISOString()};const q=await sb.from('notification_preferences').upsert(payload,{onConflict:'member_id,category'});if(q.error)return alert(q.error.message);await loadData();openMyProfileV4()}
function notificationPreferencesV4(){return `<div class="card"><h3>Gérer mes notifications</h3><p class="muted">Choisissez les alertes que vous souhaitez recevoir dans l’application ou en Push.</p>${Object.entries(NOTIF_MODULES).map(([mod,rows])=>{const allowed=rows.filter(([k])=>notifAllowed(k));if(!allowed.length)return'';return `<details class="notif-module" open><summary><b>${mod}</b><span>${allowed.length} alerte(s)</span></summary>${allowed.map(([k,l])=>{const p=notifPref(k);return `<div class="notif-pref-row"><div><b>${l}</b><small>${k==='meeting.reminder_1d'?'Inclut la date, l’heure et le thème lorsqu’il est renseigné.':''}</small></div><label><input type="checkbox" ${p.in_app_enabled?'checked':''} onchange="saveNotifPref('${k}','inapp',this.checked)"> Dans l’app</label><label><input type="checkbox" ${p.push_enabled?'checked':''} onchange="saveNotifPref('${k}','push',this.checked)"> Push</label></div>`}).join('')}</details>`}).join('')}</div>`}
let myAccountTabV5='profile';
function myAccessV5(){return '<div class="card"><h3>Mes accès</h3>'+(roles.map(r=>'<div class="family-row"><div><b>'+esc(ROLE_LABELS[r.role]||r.role)+'</b><div class="muted">'+(r.family_id?esc(familyName(r.family_id)):'Périmètre global')+'</div></div></div>').join('')||'<p class="muted">Aucun accès actif.</p>')+'</div>'}
function myMemberProfileV5(){const m=profile.member,a=activeAssignmentFor(m.id);return '<div class="card"><h3>Ma fiche membre</h3><div class="family-row"><span>Nom</span><b>'+esc(memberName(m.id))+'</b></div><div class="family-row"><span>FI / FIJ</span><b>'+esc(familyName(a?.family_id))+'</b></div><div class="family-row"><span>Téléphone</span><b>'+esc(m.phone||'—')+'</b></div><div class="family-row"><span>E-mail</span><b>'+esc(m.email||session?.user?.email||'—')+'</b></div><button class="ghost" onclick="openMember('+m.id+')">Ouvrir ma fiche complète</button></div>'}
function openMyProfileV4(tab){if(!profile?.member)return;if(tab)myAccountTabV5=tab;const tabs=[['profile','Ma fiche membre'],['access','Mes accès'],['notifications','Mes notifications'],['devices','Mes appareils']];let body=myAccountTabV5==='profile'?myMemberProfileV5():myAccountTabV5==='access'?myAccessV5():myAccountTabV5==='notifications'?notificationPreferencesV4():(typeof pushDevicePanelV4==='function'?pushDevicePanelV4():'');modal.innerHTML='<div class="modal-card wide account-modal-v5"><button class="close" onclick="closeModal()">×</button><p class="eyebrow">MON COMPTE</p><h2>'+esc([profile.member.first_name,profile.member.last_name].filter(Boolean).join(' '))+'</h2><p class="muted">'+esc(ROLE_LABELS[roles[0]?.role]||'Accès FI')+'</p><div class="profile-tabs account-tabs-v5">'+tabs.map(([k,l])=>'<button class="'+(myAccountTabV5===k?'active':'')+'" onclick="openMyProfileV4(\''+k+'\')">'+l+'</button>').join('')+'</div>'+body+'<div class="profile-logout"><button class="ghost danger" onclick="logout()">Se déconnecter</button></div></div>';modal.classList.remove('hidden')}
function bindUserProfileV4(){const u=document.querySelector('.sidebar .user');if(!u)return;u.classList.add('clickable');u.title='Mon compte, notifications et appareils';u.onclick=openMyProfileV4}
const _renderNotifProfileV4=render;render=function(){const out=_renderNotifProfileV4();setTimeout(bindUserProfileV4,0);return out}
function openNotificationTarget(n){if(n.action_key==='open_reporting'&&n.target_id)return openReporting(n.target_id);if(n.action_key==='open_meeting'&&n.target_id)return openMeeting(n.target_id);if(n.action_key==='open_followup'){go('Pilotage');setTimeout(()=>openFollowupPilotage(n.action_payload?.followup_id),80);return}if(n.target_module&&allowedItems().includes(n.target_module))go(n.target_module)}
async function remindReporting(mid){const q=await sb.rpc('remind_reporting',{p_meeting:mid});if(q.error)return alert(q.error.message);alert(q.data?`Relance envoyée à ${q.data} responsable(s).`:'Aucune relance nécessaire.');await loadData();render()}
async function remindAllMissingReporting(){const [s,e]=typeof pilotRange==='function'?pilotRange():['1900-01-01','2999-12-31'];const missing=db.meetings.filter(m=>m.reporting_required!==false&&m.status!=='cancelled'&&m.scheduled_date>=s&&m.scheduled_date<=e&&!db.reports.some(r=>+r.meeting_id===+m.id));if(!missing.length)return alert('Aucun Reporting en attente sur cette période.');if(!confirm(`Envoyer une relance pour ${missing.length} Reporting en attente ?`))return;let total=0;for(const m of missing){const q=await sb.rpc('remind_reporting',{p_meeting:m.id});if(!q.error)total+=Number(q.data||0)}alert(`${total} relance(s) envoyée(s).`)}
function followupPilotageV4(){if(!isDirection())return'';const rows=(db.followups||[]).filter(x=>x.status!=='Clôturé');return `<div class="card"><div class="toolbar"><div><p class="eyebrow">SUIVIS</p><h3>Reporting avec nécessité de suivi</h3></div><strong>${rows.length}</strong></div>${rows.map(x=>{const m=db.meetings.find(y=>+y.id===+x.meeting_id);return `<div class="family-row clickable" onclick="openFollowupPilotage(${x.id})"><div><b>${esc(memberName(x.member_id))}</b><div class="muted">${esc(familyName(x.family_id))} · ${m?.scheduled_date||''}</div><small>${esc(x.details||'Suivi à préciser')}</small></div><span class="pill">${esc(x.status)}</span></div>`}).join('')||'<p class="muted">Aucun suivi ouvert.</p>'}</div>`}
function openFollowupPilotage(id){const x=(db.followups||[]).find(y=>+y.id===+id);if(!x)return;const m=db.meetings.find(y=>+y.id===+x.meeting_id);modal.innerHTML=`<div class="modal-card"><button class="close" onclick="closeModal()">×</button><p class="eyebrow">SUIVI DIRECTION</p><h2>${esc(memberName(x.member_id))}</h2><p><b>${esc(familyName(x.family_id))}</b> · ${m?.scheduled_date||''}</p><div class="card"><b>Sujet signalé</b><p>${esc(x.details||'—')}</p></div><div class="row-actions">${m?`<button class="ghost" onclick="closeModal();openReporting(${m.id})">Ouvrir le Reporting</button>`:''}</div></div>`;modal.classList.remove('hidden')}
function reportingMissingActionsV4(){if(!isDirection())return'';const [s,e]=typeof pilotRange==='function'?pilotRange():['1900-01-01','2999-12-31'];const today=dateISO(new Date()),rows=db.meetings.filter(m=>m.reporting_required!==false&&m.status!=='cancelled'&&m.scheduled_date>=s&&m.scheduled_date<=e&&m.scheduled_date<=today&&!db.reports.some(r=>+r.meeting_id===+m.id));return `<div class="card"><div class="toolbar"><div><p class="eyebrow">REPORTING</p><h3>Reporting en attente</h3></div>${rows.length?`<button class="ghost" onclick="remindAllMissingReporting()">Relancer tous</button>`:''}</div>${rows.slice(0,12).map(m=>`<div class="family-row"><div class="clickable" onclick="openMeeting(${m.id})"><b>${esc(m.title)}</b><div class="muted">${m.scheduled_date} · ${esc(familyName(m.family_id))}</div></div><button class="ghost" onclick="remindReporting(${m.id})">Relancer</button></div>`).join('')||'<p class="muted">Aucun Reporting en attente.</p>'}</div>`}
const _pilotageNotifV4=pilotage;pilotage=function(){return _pilotageNotifV4()+reportingMissingActionsV4()+followupPilotageV4()};
const _dashboardNotifV4=dashboard;dashboard=function(){let html=_dashboardNotifV4();html=html.replace('class="card metric"><span>FI</span>','class="card metric clickable" onclick="familyTab=\'FI\';go(\'FI & FIJ\')"><span>FI</span>').replace('class="card metric"><span>FIJ</span>','class="card metric clickable" onclick="familyTab=\'FIJ\';go(\'FI & FIJ\')"><span>FIJ</span>').replace('class="card metric"><span>Membres</span>','class="card metric clickable" onclick="go(\'Membres\')"><span>Membres</span>').replace('class="card metric"><span>Présences enregistrées</span>','class="card metric clickable" onclick="go(\'Rencontres\')"><span>Présences enregistrées</span>');return html};

let notificationCenterTabV5='all';
function notificationCenterRowsV5(){const rows=(db.notifications||[]).filter(n=>profile?.member?.id&&+n.member_id===+profile.member.id);return rows.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function notificationCenterFilterV5(n){if(notificationCenterTabV5==='deleted')return !!n.deleted_at;if(n.deleted_at)return false;if(notificationCenterTabV5==='archived')return !!n.archived_at;if(n.archived_at)return false;if(notificationCenterTabV5==='unread')return !n.read_at;if(notificationCenterTabV5==='read')return !!n.read_at;return true}
function notificationDateV5(v){try{return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return''}}
async function notificationPatchV5(id,patch){const q=await sb.from('notifications').update(patch).eq('id',id);if(q.error)return alert('Impossible de modifier cette notification.');await loadData();openNotificationCenterV5(notificationCenterTabV5)}
async function notificationArchiveV5(id,e){e?.stopPropagation();return notificationPatchV5(id,{archived_at:new Date().toISOString(),deleted_at:null})}
async function notificationDeleteV5(id,e){e?.stopPropagation();return notificationPatchV5(id,{deleted_at:new Date().toISOString()})}
async function notificationRestoreV5(id,e){e?.stopPropagation();return notificationPatchV5(id,{deleted_at:null,archived_at:null})}
async function notificationPermanentDeleteV5(id,e){e?.stopPropagation();if(!confirm('Supprimer définitivement cette notification ? Cette action est irréversible.'))return;const q=await sb.from('notifications').delete().eq('id',id);if(q.error)return alert('Impossible de supprimer définitivement cette notification.');await loadData();openNotificationCenterV5('deleted')}
async function openNotificationDetailV5(id){const n=(db.notifications||[]).find(x=>+x.id===+id);if(!n)return;if(!n.read_at&&!n.deleted_at){await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);n.read_at=new Date().toISOString()}modal.innerHTML='<div class="modal-card notification-detail-v5"><button class="close" onclick="closeModal()">×</button><p class="eyebrow">NOTIFICATION</p><h2>'+esc(n.title||'Notification')+'</h2><p class="muted">'+notificationDateV5(n.created_at)+'</p><div class="notification-detail-body-v5">'+esc(n.body||'').replace(/\n/g,'<br>')+'</div><div class="row-actions">'+(n.deleted_at?'<button class="ghost" onclick="notificationRestoreV5('+n.id+')">Restaurer</button><button class="ghost danger" onclick="notificationPermanentDeleteV5('+n.id+')">Supprimer définitivement</button>':'<button class="ghost" onclick="closeModal();openNotificationCenterV5(\''+notificationCenterTabV5+'\')">Retour</button>')+'</div></div>';modal.classList.remove('hidden')}
function openNotificationCenterV5(tab){if(tab)notificationCenterTabV5=tab;const all=notificationCenterRowsV5(),counts={all:all.filter(n=>!n.deleted_at&&!n.archived_at).length,unread:all.filter(n=>!n.deleted_at&&!n.archived_at&&!n.read_at).length,read:all.filter(n=>!n.deleted_at&&!n.archived_at&&n.read_at).length,archived:all.filter(n=>!n.deleted_at&&n.archived_at).length,deleted:all.filter(n=>n.deleted_at).length};const tabs=[['all','Toutes'],['unread','Non lues'],['read','Lues'],['archived','Archivées'],['deleted','Supprimées']];const rows=all.filter(notificationCenterFilterV5);modal.innerHTML='<div class="modal-card notification-center-v5"><button class="close" onclick="closeModal()">×</button><p class="eyebrow">CENTRE DE NOTIFICATIONS</p><h2>Mes notifications</h2><div class="notification-tabs-v5">'+tabs.map(([k,l])=>'<button class="'+(notificationCenterTabV5===k?'active':'')+'" onclick="openNotificationCenterV5(\''+k+'\')">'+l+' <span>'+counts[k]+'</span></button>').join('')+'</div><div class="notification-list-v5">'+(rows.map(n=>'<div class="notification-row-v5 '+(!n.read_at?'unread':'')+'" onclick="openNotificationRowV6('+n.id+')"><div class="notification-copy-v5"><b>'+esc(n.title||'Notification')+'</b><p>'+esc(n.body||'')+'</p><small>'+notificationDateV5(n.created_at)+'</small></div><div class="notification-actions-v5">'+(n.deleted_at?'<button title="Restaurer" onclick="notificationRestoreV5('+n.id+',event)">↩</button><button class="danger" title="Supprimer définitivement" onclick="notificationPermanentDeleteV5('+n.id+',event)">🗑</button>':n.archived_at?'<button class="danger" title="Mettre dans la corbeille" onclick="notificationDeleteV5('+n.id+',event)">🗑</button>':'<button title="Archiver" onclick="notificationArchiveV5('+n.id+',event)">📦</button><button class="danger" title="Mettre dans la corbeille" onclick="notificationDeleteV5('+n.id+',event)">🗑</button>')+'</div></div>').join('')||'<p class="notification-empty-v5">Aucune notification dans cet onglet.</p>')+'</div></div>';modal.classList.remove('hidden')}
function bindNotificationCenterV5(){const h=document.querySelector('.header-actions');if(!h)return;const existing=h.querySelector('.notification-center-button-v5');if(current!=='Accueil'){existing?.remove();return;}h.querySelectorAll('button').forEach(x=>{if(x!==document.getElementById('fiBackBtn')&&!x.classList.contains('notification-center-button-v5')&&(x.textContent.includes('🔔')||/notif/i.test(x.title||'')))x.remove()});if(h.querySelector('.notification-center-button-v5'))return;const unread=notificationCenterRowsV5().filter(n=>!n.deleted_at&&!n.archived_at&&!n.read_at).length;const b=document.createElement('button');b.className='ghost notification-center-button-v5';b.title='Centre de notifications';b.innerHTML='🔔'+(unread?'<span>'+unread+'</span>':'');b.onclick=()=>openNotificationCenterV5('all');h.prepend(b)}
const _renderNotificationCenterV5=render;render=function(){const out=_renderNotificationCenterV5();setTimeout(bindNotificationCenterV5,0);return out}
let notificationRealtimeV5=null;
function subscribeNotificationRealtimeV5(){if(notificationRealtimeV5||!profile?.member?.id)return;notificationRealtimeV5=sb.channel('my-notifications-'+profile.member.id).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'member_id=eq.'+profile.member.id},async()=>{await loadData();render()}).subscribe()}
const _bootNotificationsV5=boot;boot=async function(){const out=await _bootNotificationsV5();try{subscribeNotificationRealtimeV5()}catch(e){console.warn('notification realtime',e)}return out}


/* v6 — notifications contextualisées : fiche complète de rencontre + navigation depuis le Push */
function notificationMeetingInfoV6(meetingId,payload){
  let m=meetingId?db.meetings.find(x=>+x.id===+meetingId):null;
  let virtual=null;
  if(m){
    const change=(db.changes||[]).filter(c=>+c.template_version_id===+(m.template_version_id||0)&&c.old_date===(m.original_scheduled_date||m.scheduled_date)&&c.action==='modified').sort((a,b)=>String(b.changed_at||'').localeCompare(String(a.changed_at||'')))[0];
    m={...m,title:change?.new_title||m.title,theme:m.theme||change?.new_theme||null,theme_description:m.theme_description||change?.new_theme_description||null};
  }
  if(!m && payload?.family_id && payload?.date){
    const v=payload.template_version_id?db.versions.find(x=>+x.id===+payload.template_version_id):null;
    const t=v?db.templates.find(x=>+x.id===+v.template_id):null;
    const change=(db.changes||[]).filter(c=>+c.template_version_id===+(payload.template_version_id||0)&&c.old_date===payload.date&&c.action==='modified').sort((a,b)=>String(b.changed_at||'').localeCompare(String(a.changed_at||'')))[0];
    if(v||t) virtual={id:null,family_id:+payload.family_id,title:change?.new_title||v?.title||t?.name||'Rencontre FI/FIJ',scheduled_date:payload.date,planned_start:v?.start_time?payload.date+'T'+String(v.start_time).slice(0,8):null,planned_end:v?.end_time?payload.date+'T'+String(v.end_time).slice(0,8):null,theme:change?.new_theme||null,theme_description:change?.new_theme_description||null,is_online:false,reporting_required:v?.reporting_required!==false,status:'scheduled'};
  }
  return m||virtual;
}
function openNotificationMeetingV6(meetingId,payload){
  const m=notificationMeetingInfoV6(meetingId,payload);
  if(!m)return alert('Cette rencontre n’est plus disponible.');
  const start=m.planned_start?new Date(m.planned_start).toLocaleString('fr-FR',{dateStyle:'full',timeStyle:'short'}):new Date(m.scheduled_date+'T12:00').toLocaleDateString('fr-FR',{dateStyle:'full'});
  const end=m.planned_end?new Date(m.planned_end).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
  const status=typeof statusLabel==='function'?statusLabel(m.status):m.status||'Prévue';
  const isVirtual=!m.id;
  modal.innerHTML='<div class="modal-card notification-meeting-v6"><button class="close" onclick="closeModal()">×</button>'+
    '<p class="eyebrow">FICHE DE LA RENCONTRE</p>'+
    '<h2>'+esc(m.title||'Rencontre')+'</h2>'+
    '<div class="notification-meeting-meta-v6">'+
      '<div><span>FI / FIJ</span><b>'+esc(familyName(m.family_id))+'</b></div>'+
      '<div><span>Date et heure</span><b>'+esc(start)+(end?' → '+esc(end):'')+'</b></div>'+
      '<div><span>Thème</span><b>'+esc(m.theme||'Non renseigné')+'</b></div>'+
      '<div><span>Format</span><b>'+(m.is_online?'En ligne':'En présentiel')+'</b></div>'+
      '<div><span>Statut</span><b>'+esc(status)+'</b></div>'+
      '<div><span>Reporting</span><b>'+(m.reporting_required===false?'Non requis':'Requis')+'</b></div>'+
    '</div>'+
    (m.theme_description?'<div class="notification-meeting-note-v6"><b>Précisions</b><p>'+esc(m.theme_description)+'</p></div>':'')+
    '<div class="row-actions">'+
      (m.id?'<button class="primary" onclick="closeModal();openMeeting('+m.id+')">Ouvrir la rencontre</button>':'<button class="primary" onclick="closeModal();go(\'Rencontres\')">Voir les rencontres</button>')+
      (m.id?'<button class="ghost" onclick="closeModal();openAttendance(\'meeting\','+m.id+')">Gérer les présences</button>':'')+
      (m.id&&m.reporting_required!==false?'<button class="ghost" onclick="closeModal();openReporting('+m.id+')">Ouvrir le Reporting</button>':'')+
    '</div></div>';
  modal.classList.remove('hidden');
}
function openNotificationTarget(n){
  if(n.action_key==='open_reporting'&&n.target_id)return openReporting(n.target_id);
  if(n.action_key==='open_meeting')return openNotificationMeetingV6(n.target_id,n.action_payload||{});
  if(n.action_key==='open_meetings')return openNotificationMeetingV6(null,n.action_payload||{});
  if(n.action_key==='open_followup'){go('Pilotage');setTimeout(()=>openFollowupPilotage(n.action_payload?.followup_id),80);return}
  if(n.target_module&&allowedItems().includes(n.target_module))go(n.target_module);
}
function openNotificationTargetByIdV6(id){const n=(db.notifications||[]).find(x=>+x.id===+id);if(n)openNotificationTarget(n);}
async function openNotificationRowV6(id){
  const n=(db.notifications||[]).find(x=>+x.id===+id);if(!n)return;
  if(!n.read_at&&!n.deleted_at){const now=new Date().toISOString();await sb.from('notifications').update({read_at:now}).eq('id',id);n.read_at=now}
  if(n.action_key==='open_meeting'||n.action_key==='open_meetings')return openNotificationTarget(n);
  return openNotificationDetailV5(id);
}
async function openNotificationDetailV5(id){
  const n=(db.notifications||[]).find(x=>+x.id===+id);if(!n)return;
  if(!n.read_at&&!n.deleted_at){const now=new Date().toISOString();await sb.from('notifications').update({read_at:now}).eq('id',id);n.read_at=now}
  const meetingTarget=n.category?.startsWith('meeting.')||n.action_key==='open_meeting'||n.action_key==='open_meetings';
  modal.innerHTML='<div class="modal-card notification-detail-v5"><button class="close" onclick="closeModal()">×</button><p class="eyebrow">NOTIFICATION</p><h2>'+esc(n.title||'Notification')+'</h2><p class="muted">'+notificationDateV5(n.created_at)+'</p><div class="notification-detail-body-v5">'+esc(n.body||'').replace(/\n/g,'<br>')+'</div><div class="row-actions">'+
    (meetingTarget?'<button class="primary" onclick="openNotificationTargetByIdV6('+n.id+')">Ouvrir la fiche de la rencontre</button>':'')+
    (n.deleted_at?'<button class="ghost" onclick="notificationRestoreV5('+n.id+')">Restaurer</button><button class="ghost danger" onclick="notificationPermanentDeleteV5('+n.id+')">Supprimer définitivement</button>':'<button class="ghost" onclick="closeModal();openNotificationCenterV5(\''+notificationCenterTabV5+'\')">Retour</button>')+
    '</div></div>';
  modal.classList.remove('hidden');
}
function handleNotificationNavigationV6(){
  const q=new URLSearchParams(location.search);
  const action=q.get('notification_action');
  if(!action)return;
  const targetId=q.get('target_id')||null;
  let payload={};
  try{payload=JSON.parse(q.get('notification_payload')||'{}')}catch{}
  const n={action_key:action,target_id:targetId?Number(targetId):null,action_payload:payload,target_module:action.startsWith('open_')?'Rencontres':null};
  setTimeout(()=>openNotificationTarget(n),250);
  const u=new URL(location.href);u.searchParams.delete('notification_action');u.searchParams.delete('target_id');u.searchParams.delete('notification_payload');history.replaceState({},'',u.pathname+(u.search?u.search:'')+u.hash);
}
const _bootNotificationsV6=boot;boot=async function(){const out=await _bootNotificationsV6();try{handleNotificationNavigationV6()}catch(e){console.warn('notification navigation',e)}return out};
