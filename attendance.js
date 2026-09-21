// Présences + périmètres programmes FI/FIJ
const _baseLoadData=loadData;
loadData=async function(){await _baseLoadData();const [a,t]=await Promise.all([sb.from('attendance').select('*'),sb.from('program_family_targets').select('*')]);if(a.error)throw a.error;if(t.error)throw t.error;db.attendance=a.data||[];db.programTargets=t.data||[];};
// Dates locales : évite le décalage d'un jour lié à UTC dans le calendrier.
dateISO=function(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;};
function memberFamilyId(memberId){return db.assignments.find(a=>String(a.member_id)===String(memberId)&&!a.ends_at)?.family_id||null;}
function canManageAttendanceFamily(fid){return isDirection()||roles.some(r=>['pilote','copilote'].includes(r.role)&&String(r.family_id)===String(fid));}
function attendanceFor(kind,id){return (db.attendance||[]).filter(a=>String(a[kind+'_id'])===String(id));}
function attendanceMembers(kind,id,familyId=null){let ids=[];if(familyId)ids=db.assignments.filter(a=>String(a.family_id)===String(familyId)&&!a.ends_at).map(a=>a.member_id);else ids=db.members.map(m=>m.id);return db.members.filter(m=>ids.includes(m.id)).map(m=>{const a=attendanceFor(kind,id).find(x=>String(x.member_id)===String(m.id));return {m,a};});}
function attendanceBlock(kind,id,familyId=null,editable=true){const rows=attendanceMembers(kind,id,familyId);return `<div class="attendance-block"><div class="toolbar"><div><h3>Présences</h3><p class="muted">Cochez le membre présent. L'heure d'arrivée peut être saisie, prise maintenant ou indiquée comme non connue.</p></div><span class="pill">${rows.filter(x=>x.a?.present).length} présent(s)</span></div>${rows.map(({m,a})=>`<div class="attendance-row"><label class="attendance-person"><input type="checkbox" ${a?.present?'checked':''} ${editable?'': 'disabled'} onchange="markAttendance('${kind}',${id},${m.id},${familyId||'null'},this.checked)"><span><b>${esc(m.first_name)} ${esc(m.last_name)}</b><small>${esc(familyName(memberFamilyId(m.id)))}</small></span></label><div class="attendance-time">${a?.present?`<div class="arrival-editor"><label class="arrival-field"><span>Arrivée</span><input type="time" value="${a.arrival_unknown?'':(a.arrival_time||'').slice(0,5)}" ${a.arrival_unknown?'disabled':''} ${editable?'': 'disabled'} onchange="setArrival('${kind}',${id},${m.id},this.value,false)"></label><label class="arrival-unknown"><input type="checkbox" ${a.arrival_unknown?'checked':''} ${editable?'': 'disabled'} onchange="setArrival('${kind}',${id},${m.id},'',this.checked)"><span>Heure non connue</span></label></div>`:'<span class="muted">Absent / non pointé</span>'}</div></div>`).join('')||'<div class="empty">Aucun membre dans ce périmètre.</div>'}</div>${typeof childrenAttendanceBlockV217==='function'?childrenAttendanceBlockV217(kind,id,familyId,editable):''}`;}
async function markAttendance(kind,id,memberId,familyId,present){const fid=familyId||memberFamilyId(memberId);if(fid&&!canManageAttendanceFamily(fid))return alert("Vous ne pouvez gérer que les présences de votre FI/FIJ.");const existing=attendanceFor(kind,id).find(a=>String(a.member_id)===String(memberId));if(present){const payload={[kind+'_id']:id,member_id:memberId,family_id:fid,present:true,arrival_time:new Date().toTimeString().slice(0,5),arrival_unknown:false};const q=existing?sb.from('attendance').update(payload).eq('id',existing.id):sb.from('attendance').insert(payload);const {error}=await q;if(error)return alert(typeof frenchError==='function'?frenchError(error):'Une erreur est survenue.');}else if(existing){const {error}=await sb.from('attendance').update({present:false,arrival_time:null,arrival_unknown:false}).eq('id',existing.id);if(error)return alert(typeof frenchError==='function'?frenchError(error):'Une erreur est survenue.');}await loadData();reopenAttendanceContext(kind,id);}
async function setArrival(kind,id,memberId,time,unknown){const a=attendanceFor(kind,id).find(x=>String(x.member_id)===String(memberId));if(!a)return;const {error}=await sb.from('attendance').update({arrival_time:unknown?null:(time||null),arrival_unknown:!!unknown}).eq('id',a.id);if(error)return alert(typeof frenchError==='function'?frenchError(error):'Une erreur est survenue.');await loadData();reopenAttendanceContext(kind,id);}
function reopenAttendanceContext(kind,id){if(kind==='meeting')openMeeting(id);else openProgram(id);}
const _oldOpenMeeting=openMeeting;
openMeeting=function(id){const m=db.meetings.find(x=>x.id===id);if(!m)return;const editable=!m.family_id||canManageAttendanceFamily(m.family_id);modal.innerHTML=`<div class="modal-card wide"><button class="close" onclick="closeModal()">×</button><h2>${esc(m.title)}</h2><p>${m.scheduled_date}${m.planned_start?' · '+new Date(m.planned_start).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):''}${m.planned_end?' → '+new Date(m.planned_end).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):''}</p><p>Statut : <b>${m.status==='scheduled'?'Prévue':m.status==='cancelled'?'Annulée':m.status==='postponed'?'Reportée':esc(m.status||'Prévue')}</b></p>${attendanceBlock('meeting',id,m.family_id,editable)}<div class="row-actions"><button class="ghost" onclick="changeSchedule(${id},'postpone')">Reporter</button><button class="danger" onclick="changeSchedule(${id},'cancel')">Annuler</button></div><h3>Historique</h3>${db.changes.filter(c=>c.meeting_id===id).map(c=>`<div class="meeting"><span>${new Date(c.changed_at).toLocaleString('fr-FR')} · ${c.action}</span><small>${esc(c.reason)}</small></div>`).join('')||'<p class="muted">Aucune modification.</p>'}</div>`;modal.classList.remove('hidden');};
const _oldOpenVirtual=openVirtual;
openVirtual=function(date,familyId,templateId){const f=db.families.find(x=>x.id===familyId),t=db.templates.find(x=>x.id===templateId),v=activeVersion(t,date);modal.innerHTML=`<div class="modal-card wide"><button class="close" onclick="closeModal()">×</button><span class="pill ${f.family_type.toLowerCase()}">${f.family_type}</span><h2>${esc(f.name)} · ${date}</h2><p>Modèle : <b>${esc(t.name)}</b></p><p>Horaire prévu : <b>${(v.start_time||'').slice(0,5)}${v.end_time?' → '+v.end_time.slice(0,5):''}</b></p><p class="muted">Pour gérer les présences et le Reporting, ouvrez cette occurrence : elle sera enregistrée sans modifier le modèle hebdomadaire.</p><div class="row-actions"><button class="primary" onclick="openVirtualAttendance('${date}',${familyId},${templateId})">Gérer les présences</button><button class="ghost" onclick="materializeMeeting('${date}',${familyId},${templateId},'postpone')">Reporter</button><button class="danger" onclick="materializeMeeting('${date}',${familyId},${templateId},'cancel')">Annuler</button></div></div>`;modal.classList.remove('hidden');};
async function openVirtualAttendance(date,familyId,templateId){const existing=db.meetings.find(m=>String(m.family_id)===String(familyId)&&(m.original_scheduled_date===date||m.scheduled_date===date)&&m.template_version_id);if(existing)return openMeeting(existing.id);const t=db.templates.find(x=>x.id===templateId),v=activeVersion(t,date),f=db.families.find(x=>x.id===familyId);const {data,error}=await sb.from('meetings').insert({title:`${t.name} — ${f.name}`,meeting_kind:'Rencontre hebdomadaire',scheduled_date:date,original_scheduled_date:date,planned_start:new Date(`${date}T${v.start_time}`).toISOString(),planned_end:v.end_time?new Date(`${date}T${v.end_time}`).toISOString():null,family_id:familyId,template_version_id:v.id,status:'scheduled'}).select('id').single();if(error)return alert(typeof frenchError==='function'?frenchError(error):'Une erreur est survenue.');await loadData();openMeeting(data.id);}
function programAudienceLabel(p){if(p.direction_only)return 'Direction uniquement';if(p.leaders_only)return `${p.include_fi&&p.include_fij?'FI + FIJ':p.include_fi?'FI':'FIJ'} · Pilotes + copilotes`;if(p.target_scope==='SELECTED_FAMILIES')return 'Une ou plusieurs familles';return `${p.include_fi&&p.include_fij?'Toutes les FI + FIJ':p.include_fi?'Toutes les FI':'Toutes les FIJ'}`;}
function toggleProgramScope(){const selected=document.getElementById('pTarget')?.value==='SELECTED_FAMILIES';document.getElementById('pFamiliesBox')?.classList.toggle('hidden',!selected);}
formProgram=function(){modalForm('Nouveau programme / événement',`<input id="pTitle" placeholder="Titre"><select id="pKind"><option>Programme spécial</option><option>Formation</option><option>Réunion</option><option>Rencontre commune</option><option>Temps de prière</option><option>Événement</option></select><div class="form-row"><input id="pStart" type="date"><input id="pEnd" type="date"></div><div class="scope-box"><b>Périmètre</b><div class="check-row"><label><input id="pFI" type="checkbox" checked> FI</label><label><input id="pFIJ" type="checkbox" checked> FIJ</label></div><select id="pTarget" onchange="toggleProgramScope()"><option value="ALL_FAMILIES">Toutes les familles du périmètre</option><option value="SELECTED_FAMILIES">Une ou plusieurs familles</option><option value="LEADERS_ONLY">Pilotes + copilotes du périmètre</option><option value="DIRECTION_ONLY">Direction uniquement</option></select><div id="pFamiliesBox" class="family-checks hidden">${db.families.map(f=>`<label data-type="${f.family_type}"><input type="checkbox" name="pFamily" value="${f.id}"> ${esc(f.name)} <span class="pill ${f.family_type.toLowerCase()}">${f.family_type}</span></label>`).join('')}</div><small class="muted">La Direction est toujours invitée. Pilotes et copilotes sont gérés ensemble.</small></div><textarea id="pNotes" placeholder="Notes"></textarea>`,async()=>{if(!pTitle.value.trim()||!pStart.value)throw Error('Titre et date de début obligatoires.');const fi=pFI.checked,fij=pFIJ.checked,target=pTarget.value;if(target!=='DIRECTION_ONLY'&&!fi&&!fij)throw Error('Choisissez FI, FIJ ou les deux.');const {data,error}=await sb.from('programs').insert({title:pTitle.value.trim(),kind:pKind.value,scheduled_date:pStart.value,end_date:pEnd.value||pStart.value,audience:target==='DIRECTION_ONLY'?'Direction':target==='LEADERS_ONLY'?'Pilotes + copilotes':'Familles',target_scope:target,include_fi:target==='DIRECTION_ONLY'?false:fi,include_fij:target==='DIRECTION_ONLY'?false:fij,leaders_only:target==='LEADERS_ONLY',direction_only:target==='DIRECTION_ONLY',notes:pNotes.value.trim()||null,status:'scheduled'}).select('id').single();if(error)throw error;if(target==='SELECTED_FAMILIES'){const ids=[...document.querySelectorAll('input[name=pFamily]:checked')].map(x=>+x.value).filter(id=>{const f=db.families.find(z=>z.id===id);return f&&(f.family_type==='FI'?fi:fij);});if(!ids.length)throw Error('Sélectionnez au moins une famille.');const {error:e}=await sb.from('program_family_targets').insert(ids.map(family_id=>({program_id:data.id,family_id})));if(e)throw e;}const end=new Date((pEnd.value||pStart.value)+'T12:00:00');for(let d=new Date(pStart.value+'T12:00:00');d<=end;d.setDate(d.getDate()+1)){const {error:e}=await sb.from('program_days').insert({program_id:data.id,program_date:dateISO(d)});if(e)throw e;}});};
function programFamilyIds(p){if(p.direction_only||p.leaders_only)return [];if(p.target_scope==='SELECTED_FAMILIES')return (db.programTargets||[]).filter(x=>x.program_id===p.id).map(x=>x.family_id);return db.families.filter(f=>(p.include_fi&&f.family_type==='FI')||(p.include_fij&&f.family_type==='FIJ')).map(f=>f.id);}
openProgram=function(id){const p=db.programs.find(x=>x.id===id),days=db.programDays.filter(d=>d.program_id===id).sort((a,b)=>a.program_date.localeCompare(b.program_date)),fids=programFamilyIds(p);let presence='';if(p.direction_only||p.leaders_only){presence=isDirection()?attendanceBlock('program',id,null,true):'<p class="muted">Les présences de cette réunion sont gérées par la Direction.</p>';}else if(isDirection()){presence=fids.map(fid=>`<details class="family-att"><summary>${esc(familyName(fid))}</summary>${attendanceBlock('program',id,fid,true)}</details>`).join('');}else{const mine=fids.filter(fid=>canManageAttendanceFamily(fid));presence=mine.map(fid=>attendanceBlock('program',id,fid,true)).join('')||'<p class="muted">Aucune présence à gérer dans votre périmètre.</p>';}modal.innerHTML=`<div class="modal-card wide"><button class="close" onclick="closeModal()">×</button><h2>${esc(p.title)}</h2><p>${esc(p.kind||'Programme')} · <b>${esc(programAudienceLabel(p))}</b></p><h3>Jours & horaires</h3>${days.map(d=>`<div class="family-row"><b>${d.program_date}</b><span>${d.starts_at?d.starts_at.slice(0,5):'Horaire non connu'}${d.ends_at?' → '+d.ends_at.slice(0,5):''}</span></div>`).join('')}<hr>${presence}</div>`;modal.classList.remove('hidden');};
reportingPage=function(){const reports=db.reports||[];const meetings=db.meetings.filter(m=>attendanceFor('meeting',m.id).some(a=>a.present)||reports.some(r=>r.meeting_id===m.id));return `<div class="card page-card"><h2>Reporting</h2><p class="muted">Chaque Reporting reprend automatiquement les présences déjà pointées pour la rencontre.</p>${meetings.map(m=>{const at=attendanceFor('meeting',m.id).filter(a=>a.present);const r=reports.find(x=>x.meeting_id===m.id);return `<div class="report-card clickable" onclick="openMeeting(${m.id})"><div class="toolbar"><div><b>${esc(m.title)}</b><div class="muted">${m.scheduled_date} · ${familyName(m.family_id)}</div></div><span class="pill">${r?.status||'Brouillon'}</span></div><div class="presence-summary"><b>Présences : ${at.length}</b>${at.slice(0,6).map(a=>`<span>${esc(memberName(a.member_id))} · ${a.arrival_unknown?'heure non connue':(a.arrival_time||'heure non connue').slice(0,5)}</span>`).join('')}${at.length>6?`<span>+ ${at.length-6} autre(s)</span>`:''}</div></div>`;}).join('')||'<div class="empty">Aucun Reporting ou pointage pour le moment.</div>'}</div>`;};
// Le temps réel recharge aussi les présences et les périmètres ciblés.
if(realtimeChannel){try{sb.removeChannel(realtimeChannel);}catch{}realtimeChannel=null;}
subscribeRealtime=function(){if(realtimeChannel)return;realtimeChannel=sb.channel('fi-live-v2');['families','members','member_assignments','meetings','programs','reporting','meeting_templates','meeting_template_versions','calendar_pauses','program_days','schedule_changes','app_settings','role_assignments','attendance','program_family_targets'].forEach(table=>realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table},async()=>{await loadData();render();}));realtimeChannel.subscribe();};
setTimeout(async()=>{if(session){try{await loadData();render();subscribeRealtime();}catch(e){console.error(e);}}},500);
/* v214 — fiche de présences en consultation, édition seulement selon les droits */
function openAttendanceReadV214(kind,id,familyId=null){
 const item=kind==='meeting'?db.meetings.find(x=>+x.id===+id):db.programs.find(x=>+x.id===+id);
 if(!item)return;
 const rows=(db.attendance||[]).filter(a=>+a[kind+'_id']===+id&&a.present&&(!familyId||+a.family_id===+familyId));
 const fid=familyId||item.family_id||null,canEdit=isDirection()||(fid&&canManageAttendanceFamily(fid)),childRows=(db.childAttendance||[]).filter(a=>+a[kind+'_id']===+id&&a.present&&(!fid||+a.family_id===+fid));
 modal.innerHTML='<div class="modal-card wide reporting-sheet"><button class="close" onclick="closeModal()">×</button><p class="eyebrow">FICHE DE PRÉSENCES</p><h2>'+esc(item.title||'Présences')+'</h2><p class="muted">'+(fid?esc(familyName(fid))+' · ':'')+esc(item.scheduled_date||'')+'</p><div class="card metric"><span>Personnes présentes</span><strong>'+(rows.length+childRows.length)+'</strong></div><div class="report-section">'+(rows.length?rows.map(a=>'<div class="family-row"><b>'+esc(memberName(a.member_id))+'</b><span>'+(a.arrival_unknown?'Heure non connue':esc(String(a.arrival_time||'').slice(0,5)||'Présent'))+'</span></div>').join(''):'<p class="muted">Aucune présence enregistrée.</p>')+(childRows.length?'<h3>Enfants accompagnants ('+childRows.length+')</h3>'+childRows.map(a=>{const ch=(db.children||[]).find(c=>+c.id===+a.child_id);return '<div class="family-row"><b>'+esc(childNameV217(ch))+'</b><span>Enfant accompagnant</span></div>'}).join(''):'')+'</div><div class="row-actions">'+(canEdit?'<button class="primary" onclick="openAttendance(\''+kind+'\','+id+')">Modifier les présences</button>':'')+(kind==='meeting'?'<button class="ghost" onclick="openMeetingDetailV9('+id+')">Voir la rencontre</button>':'<button class="ghost" onclick="openProgramDetailV9('+id+')">Voir le programme</button>')+'</div></div>';modal.classList.remove('hidden')
}

/* v225 — gestion des présences canonique : enregistrement RPC + retard facultatif */

function attendancePlannedStartV225(kind,id){
 const obj=db[kind==='meeting'?'meetings':'programs'].find(x=>+x.id===+id);
 if(!obj)return null;
 if(obj.planned_start)return obj.planned_start;
 if(kind==='program'){
   const day=db.programDays.filter(d=>+d.program_id===+id&&d.starts_at).sort((a,b)=>String(a.program_date).localeCompare(String(b.program_date)))[0];
   if(day?.starts_at){
     const date=day.program_date||obj.scheduled_date;
     return new Date(date+'T'+String(day.starts_at).slice(0,8)).toISOString();
   }
 }
 return null;
}
function attendancePlannedMinutesV225(kind,id){
 const planned=attendancePlannedStartV225(kind,id);
 if(!planned)return null;
 const d=new Date(planned);
 return d.getHours()*60+d.getMinutes();
}
function attendanceInputMinutesV225(value){
 if(!value)return null;
 const m=String(value).match(/^(\\d{1,2}):(\\d{2})$/);
 return m?(+m[1]*60+ +m[2]):null;
}
function toggleAttendanceLateV225(memberId){
 const time=document.querySelector('.att-time[data-member="'+memberId+'"]');
 const box=document.getElementById('attLateBox-'+memberId);
 if(!time||!box)return;
 const planned=attendancePlannedMinutesV225(window._attendanceKind,window._attendanceId);
 const arrival=attendanceInputMinutesV225(time.value);
 const late=planned!==null&&arrival!==null&&arrival>planned;
 box.classList.toggle('hidden',!late);
}
function toggleUnknownV225(el){
 const id=el.dataset.member;
 const t=document.querySelector('.att-time[data-member="'+id+'"]');
 if(!t)return;
 t.disabled=el.checked;
 if(el.checked){
   t.value='';
   toggleAttendanceLateV225(+id);
 }
}
async function saveAttendanceV225(kind,id,btn){
 const rows=[...document.querySelectorAll('.att-present')];
 if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Enregistrement…';}
 try{
   const planned=attendancePlannedMinutesV225(kind,id);
   let saved=0;
   for(const c of rows){
     const member_id=+c.dataset.member;
     const time=document.querySelector('.att-time[data-member="'+member_id+'"]');
     const unk=document.querySelector('.att-unknown[data-member="'+member_id+'"]');
     const family_id=memberFamilyId(member_id);
     const arrival=c.checked&&!unk?.checked&&time?.value?time.value:null;
     const arrivalMinutes=attendanceInputMinutesV225(arrival);
     const late=!!(c.checked&&arrivalMinutes!==null&&planned!==null&&arrivalMinutes>planned);
     const reason=(document.querySelector('.att-late-reason[data-member="'+member_id+'"]')?.value||'').trim()||null;
     const {error}=await sb.rpc('save_attendance_entry',{
       p_meeting_id:kind==='meeting'?+id:null,
       p_program_id:kind==='program'?+id:null,
       p_member_id:member_id,
       p_family_id:family_id||null,
       p_present:!!c.checked,
       p_arrival_time:arrival,
       p_arrival_unknown:!!(c.checked&&unk?.checked),
       p_is_late:late,
       p_late_reason:late?reason:null
     });
     if(error)throw error;
     saved++;
   }
   await loadData();
   render();
   closeModal();
   alert(saved+' présence(s) enregistrée(s).');
 }catch(e){
   console.error(e);
   alert(typeof frenchError==='function'?frenchError(e):'Impossible d’enregistrer les présences.');
 }finally{
   if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Enregistrer les présences';}
 }
}
function openAttendanceV225(kind,id){
 window._attendanceKind=kind;window._attendanceId=id;
 const members=eligibleMembers(kind,id);
 const planned=attendancePlannedMinutesV225(kind,id);
 const rows=members.map(m=>{
   const a=db.attendance.find(x=>+x.member_id===+m.id&&+x[kind+'_id']===+id);
   const arrival=(a?.arrival_time||'').slice(0,5);
   const late=!!a?.is_late||(planned!==null&&attendanceInputMinutesV225(arrival)!==null&&attendanceInputMinutesV225(arrival)>planned);
   return '<div class="attendance-row"><label><input type="checkbox" class="att-present" data-member="'+m.id+'" '+(a?.present?'checked':'')+'> <b>'+esc(memberName(m.id))+'</b><small>'+esc(familyName(memberFamilyId(m.id)))+'</small></label><div class="attendance-arrival"><input type="time" class="att-time" data-member="'+m.id+'" value="'+arrival+'" '+(a?.arrival_unknown?'disabled':'')+' onchange="toggleAttendanceLateV225('+m.id+')"><label class="unknown"><input type="checkbox" class="att-unknown" data-member="'+m.id+'" '+(a?.arrival_unknown?'checked':'')+' onchange="toggleUnknownV225(this);toggleAttendanceLateV225('+m.id+')"> Heure non connue</label><div id="attLateBox-'+m.id+'" class="'+(late?'':'hidden')+' att-late-box"><label>Motif du retard <span class="muted">(facultatif)</span><textarea class="att-late-reason" data-member="'+m.id+'" rows="2" placeholder="Précisez éventuellement le motif du retard">'+esc(a?.late_reason||'')+'</textarea></label></div></div></div>';
 }).join('');
 modal.innerHTML='<div class="modal-card wide"><button class="close" onclick="closeModal()">×</button><h2>Présences</h2><p class="muted">Cochez les présents et renseignez l’heure d’arrivée si vous la connaissez. Si l’arrivée est après l’heure prévue, le champ « Motif du retard » apparaît, mais il reste facultatif.</p><div class="attendance-list">'+(rows||'<p class="muted">Aucun membre dans votre périmètre.</p>')+'</div><button type="button" class="primary" onclick="saveAttendanceV225(\''+kind+'\','+id+',this)">Enregistrer les présences</button></div>';
 modal.classList.remove('hidden');
}
openAttendance=openAttendanceV225;
saveAttendance=saveAttendanceV225;

