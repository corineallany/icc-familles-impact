/* v231 — fiches d'activités complètes + édition en ligne.
   Une seule fiche pour Rencontre / Programme, avec contenu, modalités et FI participantes repliées.
   Les présences restent pilotées par le circuit canonique et ses Paramètres. */
(function(){
  'use strict';

  const val=id=>document.getElementById(id)?.value?.trim()||'';
  const checked=id=>!!document.getElementById(id)?.checked;
  const fmtDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'—';
  const fmtTime=v=>{if(!v)return '—';try{return new Date(v).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}catch{return String(v).slice(0,5)}};
  const esc2=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function meetingFamilies(m){
    return m?.family_id ? db.families.filter(f=>+f.id===+m.family_id) : [];
  }
  function programFamilies(p){
    if(!p)return [];
    if(typeof programTargetFamilies==='function')return programTargetFamilies(p).filter(Boolean);
    if(p.direction_only||p.leaders_only)return [];
    if(p.target_scope==='SELECTED')return (db.targets||[]).filter(t=>+t.program_id===+p.id).map(t=>db.families.find(f=>+f.id===+t.family_id)).filter(Boolean);
    return db.families.filter(f=>(p.include_fi&&f.family_type==='FI')||(p.include_fij&&f.family_type==='FIJ'));
  }
  function participantsBlock(families,label='FI participantes'){
    const list=(families||[]).filter(Boolean);
    return '<details class="report-section activity-participants"><summary><b>'+esc2(label)+'</b><span class="muted">'+list.length+' participante'+(list.length>1?'s':'')+'</span></summary>'+
      (list.length
        ? '<div class="pilot-compact-list">'+list.map(f=>'<div class="family-row"><div><b>'+esc2(f.name)+'</b><div class="muted">'+esc2(f.family_type||'FI')+'</div></div></div>').join('')+'</div>'
        : '<p class="muted">Aucune FI participante identifiée.</p>')+
      '</details>';
  }
  function onlineBlock(item){
    if(!item?.is_online)return '';
    return '<div class="card"><b>Modalité</b><p>🟢 Rencontre en ligne</p>'+(item.online_url?'<p><a href="'+esc2(item.online_url)+'" target="_blank" rel="noopener">Rejoindre la rencontre en ligne</a></p>':'<p class="muted">Lien de connexion non renseigné.</p>')+'</div>';
  }
  function locationBlock(item){
    if(item?.is_online)return '';
    return '<div class="card"><b>Lieu</b><p>'+esc2(item?.location||'Lieu à préciser')+'</p></div>';
  }

  function activityActions(kind,id,item){
    const state=typeof attendanceStateV231==='function'?attendanceStateV231(kind,item):null;
    const can=kind==='meeting'
      ? (typeof canManageAttendanceFamily==='function' && item.family_id ? canManageAttendanceFamily(item.family_id) : isDirection())
      : (isDirection() || programFamilies(item).some(f=>typeof canManageAttendanceFamily==='function'&&canManageAttendanceFamily(f.id)));
    let attendance='';
    if(can){
      const open=state?.available!==false;
      attendance=open
        ? '<button class="primary" onclick="openAttendance(\''+kind+'\','+Number(id)+')">✓ Gérer les présences</button>'
        : '<button class="primary" disabled title="'+esc2(state?.message||'Les présences ne sont pas encore ouvertes.')+'">✓ Gérer les présences</button>';
    }
    const admin=isDirection()?'<button class="ghost" onclick="scheduleChange(\''+kind+'\','+Number(id)+',\'postponed\')">Reporter</button><button class="ghost" onclick="scheduleChange(\''+kind+'\','+Number(id)+',\'cancelled\')">Annuler</button>':'';
    return '<div class="row-actions">'+attendance+admin+'<button class="ghost" onclick="closeModal()">Fermer</button></div>';
  }

  function settingOpenMinutes(){
    const rows=db.settings||[];
    const parse=row=>{const v=row?.value;if(v&&typeof v==='object')return v;try{return JSON.parse(v||'{}')}catch(_){return {}}};
    const a=parse(rows.find(s=>s.key==='attendance_window')),t=parse(rows.find(s=>s.key==='timing'));
    const n=Number(a.opens_before_minutes??t.attendance_open_minutes_before);
    return Number.isFinite(n)&&n>=0?n:null;
  }
  function startEnd(kind,item){
    if(kind==='meeting')return [item?.planned_start?new Date(item.planned_start).getTime():null,item?.planned_end?new Date(item.planned_end).getTime():null];
    const days=(db.programDays||[]).filter(d=>+d.program_id===+item.id&&d.program_date).sort((a,b)=>String(a.program_date).localeCompare(String(b.program_date)));
    const last=[...days].reverse()[0];
    const first=days[0];
    const start=first?.starts_at?new Date(first.program_date+'T'+String(first.starts_at).slice(0,8)).getTime():item?.scheduled_date?new Date(item.scheduled_date+'T00:00:00').getTime():null;
    const end=last?.ends_at?new Date(last.program_date+'T'+String(last.ends_at).slice(0,8)).getTime():item?.end_date?new Date(item.end_date+'T23:59:59').getTime():null;
    return [start,end];
  }
  window.attendanceStateV231=function(kind,item){
    const [start,end]=startEnd(kind,item),mins=settingOpenMinutes(),now=Date.now();
    if(start===null)return {available:false,message:'L’horaire de début n’est pas encore renseigné.'};
    const openAt=start-(mins===null?0:mins*60000);
    if(now<openAt)return {available:false,message:mins===null?'Les présences s’ouvriront selon le réglage défini dans Paramètres.':'Les présences s’ouvriront '+mins+' minute'+(mins>1?'s':'')+' avant le début, selon le réglage de Paramètres.'};
    return {available:true,message:now<(end||start)?'La saisie des présences est ouverte.':'La saisie des présences reste consultable.'};
  };

  function fullMeeting(id){
    const m=db.meetings.find(x=>+x.id===+id);if(!m)return;
    const fam=meetingFamilies(m), state=attendanceStateV231('meeting',m);
    modal.innerHTML='<div class="modal-card wide reporting-sheet"><button class="close" onclick="closeModal()">×</button>'+
      '<div class="report-hero"><div><p class="eyebrow">FICHE RENCONTRE</p><h2>'+esc2(m.title)+'</h2><p class="muted">'+esc2(m.meeting_kind||'Rencontre')+'</p></div><span class="pill">'+esc2(({scheduled:'Prévue',completed:'Terminée',cancelled:'Annulée',postponed:'Reportée'})[m.status]||m.status||'Prévue')+'</span></div>'+
      '<div class="grid"><div class="card"><b>Date</b><p>'+fmtDate(m.scheduled_date)+'</p></div><div class="card"><b>Horaire</b><p>'+fmtTime(m.planned_start)+' → '+fmtTime(m.planned_end)+'</p></div></div>'+
      '<div class="report-section"><p class="eyebrow">THÈME</p><h3>'+esc2(m.theme||'Thème non renseigné')+'</h3>'+(m.theme_description?'<p>'+esc2(m.theme_description)+'</p>':'<p class="muted">Aucune précision renseignée.</p>')+'</div>'+
      '<div class="grid">'+locationBlock(m)+onlineBlock(m)+'</div>'+
      participantsBlock(fam)+
      '<p class="muted">'+esc2(state.message)+'</p>'+
      activityActions('meeting',id,m)+
      '</div>';
    modal.classList.remove('hidden');
  }

  function fullProgram(id){
    const p=db.programs.find(x=>+x.id===+id);if(!p)return;
    const fams=programFamilies(p),state=attendanceStateV231('program',p);
    const days=(db.programDays||[]).filter(d=>+d.program_id===+id).sort((a,b)=>String(a.program_date).localeCompare(String(b.program_date)));
    const schedule=days.length
      ? days.map(d=>'<div class="family-row"><b>'+fmtDate(d.program_date)+'</b><span>'+esc2(String(d.starts_at||'').slice(0,5)||'Horaire à préciser')+(d.ends_at?' → '+esc2(String(d.ends_at).slice(0,5)):'')+'</span></div>').join('')
      : '<p>'+fmtDate(p.scheduled_date)+(p.end_date&&p.end_date!==p.scheduled_date?' → '+fmtDate(p.end_date):'')+'</p>';
    modal.innerHTML='<div class="modal-card wide reporting-sheet"><button class="close" onclick="closeModal()">×</button>'+
      '<div class="report-hero"><div><p class="eyebrow">FICHE PROGRAMME</p><h2>'+esc2(p.title)+'</h2><p class="muted">'+esc2(p.kind||'Programme')+(p.audience?' · '+esc2(p.audience):'')+'</p></div><span class="pill">'+esc2(p.status||'Prévu')+'</span></div>'+
      '<div class="report-section"><p class="eyebrow">THÈME</p><h3>'+esc2(p.theme||p.title||'Thème non renseigné')+'</h3>'+(p.theme_description?'<p>'+esc2(p.theme_description)+'</p>':p.notes?'<p>'+esc2(p.notes)+'</p>':'<p class="muted">Aucune précision renseignée.</p>')+'</div>'+
      '<div class="report-section"><h3>Dates & horaires</h3>'+schedule+'</div>'+
      '<div class="grid">'+locationBlock(p)+onlineBlock(p)+'</div>'+
      participantsBlock(fams)+
      '<p class="muted">'+esc2(state.message)+'</p>'+
      activityActions('program',id,p)+
      '</div>';
    modal.classList.remove('hidden');
  }

  window.openMeetingDetailV231=fullMeeting;
  window.openProgramDetailV231=fullProgram;
  window.openMeeting=function(id){return fullMeeting(id)};
  window.openProgram=function(id){return fullProgram(id)};

  window.formMeeting=function(){
    modalForm('Nouvelle rencontre',
      '<label>Titre *<input id="rTitle" placeholder="Titre de la rencontre"></label>'+
      '<label>FI<select id="rFamily">'+famOpts()+'</select></label>'+
      '<label>Date *<input id="rDate" type="date"></label>'+
      '<div class="form-row"><label>Heure de début<input id="rTime" type="time"></label><label>Heure de fin<input id="rEndTime" type="time"></label></div>'+
      '<label>Thème<input id="rTheme" placeholder="Thème de la rencontre"></label>'+
      '<label>Précisions / contenu<textarea id="rThemeDescription" rows="4" placeholder="Objectif, points à aborder, consignes…"></textarea></label>'+
      '<label><input type="checkbox" id="rOnline" onchange="toggleMeetingOnlineFieldsV231()"> Rencontre en ligne</label>'+
      '<div id="rOnlineFields" class="hidden"><label>Lien de connexion<input id="rOnlineUrl" type="url" placeholder="https://…"></label></div>'+
      '<label id="rLocationLabel">Lieu<input id="rLocation" placeholder="Lieu de la rencontre"></label>',
      async()=>{
        const payload={title:val('rTitle'),meeting_kind:'Rencontre',family_id:val('rFamily')?+val('rFamily'):null,scheduled_date:val('rDate'),
          planned_start:val('rTime')?new Date(val('rDate')+'T'+val('rTime')).toISOString():null,
          planned_end:val('rEndTime')?new Date(val('rDate')+'T'+val('rEndTime')).toISOString():null,
          theme:val('rTheme')||null,theme_description:val('rThemeDescription')||null,is_online:checked('rOnline'),online_url:checked('rOnline')?val('rOnlineUrl')||null:null,location:checked('rOnline')?null:val('rLocation')||null,status:'scheduled'};
        const {error}=await sb.from('meetings').insert(payload);if(error)throw error;
      });
  };
  window.toggleMeetingOnlineFieldsV231=function(){
    const on=checked('rOnline'),box=document.getElementById('rOnlineFields'),loc=document.getElementById('rLocationLabel');
    box?.classList.toggle('hidden',!on);loc?.classList.toggle('hidden',on);
  };

  window.formProgram=function(){
    modal.innerHTML='<div class="modal-card wide"><button class="close" onclick="closeModal()">×</button><h2>Nouveau programme / événement</h2><div class="form-stack">'+
      '<label>Titre *<input id="pTitle" placeholder="Nom du programme"></label>'+
      '<label>Type *<select id="pKind"><option>Programme</option><option>Programme de prière</option><option>Événement</option><option>Formation</option><option>Réunion</option></select></label>'+
      '<label>Thème<input id="pTheme" placeholder="Thème du programme / événement"></label>'+
      '<label>Précisions / contenu<textarea id="pThemeDescription" rows="4" placeholder="Objectif, déroulé, consignes, informations complémentaires…"></textarea></label>'+
      '<label><input type="checkbox" id="pOnline" onchange="toggleProgramOnlineFieldsV231()"> Programme en ligne</label>'+
      '<div id="pOnlineFields" class="hidden"><label>Lien de connexion<input id="pOnlineUrl" type="url" placeholder="https://…"></label></div>'+
      '<label id="pLocationLabel">Lieu<input id="pLocation" placeholder="Lieu du programme"></label>'+
      '<div class="report-section"><h3>Participants / périmètre</h3><label><input type="checkbox" id="pDirectionOnly" onchange="syncProgramScopeV231()"> Direction uniquement</label><label><input type="checkbox" id="pLeaders" onchange="syncProgramScopeV231()"> Pilotes + Copilotes</label><div id="familyScope"><div class="row-actions program-quick-scope"><button type="button" class="ghost" onclick="setProgramFamiliesV231('FI')">Toutes les FI</button><button type="button" class="ghost" onclick="setProgramFamiliesV231('FIJ')">Toutes les FIJ</button><button type="button" class="ghost" onclick="setProgramFamiliesV231('BOTH')">Toutes les FI + FIJ</button><button type="button" class="ghost" onclick="setProgramFamiliesV231('NONE')">Tout décocher</button></div><div class="program-family-grid">'+(typeof programFamilyChecks==='function'?programFamilyChecks():'')+'</div></div></div>'+
      '<div class="report-section"><h3>Dates & horaires</h3><div class="form-row"><label>Date de début *<input id="pStart" type="date" onchange="renderProgramDaysV231()"></label><label>Date de fin<input id="pEnd" type="date" onchange="renderProgramDaysV231()"></label></div><div class="form-row"><label>Heure de début<input id="pBaseStart" type="time"></label><label>Heure de fin<input id="pBaseEnd" type="time"></label></div><label><input type="checkbox" id="pMultiSlots" onchange="renderProgramDaysV231()"> Horaires différents selon les jours</label><div id="programMultiBox" class="hidden"><div id="programDaysEditor"></div></div></div>'+
      '<div class="report-savebar"><span class="muted">La Direction reste invitée par défaut.</span><button class="primary" id="saveProgramV231">Enregistrer le programme</button></div></div></div>';
    modal.classList.remove('hidden');syncProgramScopeV231();document.getElementById('saveProgramV231').onclick=saveProgramV231;
  };
  window.toggleProgramOnlineFieldsV231=function(){const on=checked('pOnline');document.getElementById('pOnlineFields')?.classList.toggle('hidden',!on);document.getElementById('pLocationLabel')?.classList.toggle('hidden',on)};
  window.setProgramFamiliesV231=function(mode){document.querySelectorAll('.p-family').forEach(x=>{const type=x.closest('.program-family-choice')?.dataset.type;x.checked=mode==='BOTH'||type===mode})};
  window.syncProgramScopeV231=function(){const d=checked('pDirectionOnly'),l=checked('pLeaders');document.getElementById('familyScope')?.classList.toggle('hidden',d||l)};
  window.renderProgramDaysV231=function(){
    const box=document.getElementById('programMultiBox'),editor=document.getElementById('programDaysEditor');
    if(!box||!editor)return;
    const multi=checked('pMultiSlots');box.classList.toggle('hidden',!multi);if(!multi){editor.innerHTML='';return}
    const a=val('pStart'),b=val('pEnd')||a;if(!a){editor.innerHTML='<p class="muted">Choisissez d’abord la date de début.</p>';return}
    const out=[];for(let d=new Date(a+'T12:00:00');d<=new Date(b+'T12:00:00');d.setDate(d.getDate()+1)){const iso=dateISO(d);out.push('<div class="program-day-row" data-date="'+iso+'"><b>'+fmtDate(iso)+'</b><div class="form-row"><label>Début<input class="pd-start" type="time"></label><label>Fin<input class="pd-end" type="time"></label></div></div>')}
    editor.innerHTML=out.join('');
  };
  async function saveProgramV231(){
    const btn=document.getElementById('saveProgramV231');if(!btn||btn.disabled)return;btn.disabled=true;
    try{
      if(!val('pTitle')||!val('pStart'))throw Error('Le titre et la date de début sont obligatoires.');
      const end=val('pEnd')||val('pStart');if(end<val('pStart'))throw Error('La date de fin ne peut pas précéder la date de début.');
      const direction=checked('pDirectionOnly'),leaders=checked('pLeaders'),selected=[...document.querySelectorAll('.p-family:checked')].map(x=>+x.value);
      if(!direction&&!leaders&&!selected.length)throw Error('Sélectionnez au moins une FI/FIJ, ou utilisez un raccourci de périmètre.');
      const chosen=db.families.filter(f=>selected.includes(+f.id)),includeFI=chosen.some(f=>f.family_type==='FI'),includeFIJ=chosen.some(f=>f.family_type==='FIJ');
      const eligible=db.families.filter(f=>f.status!=='Fermée'&&((includeFI&&f.family_type==='FI')||(includeFIJ&&f.family_type==='FIJ'))),allSelected=!direction&&!leaders&&selected.length===eligible.length;
      const {data:p,error}=await sb.from('programs').insert({title:val('pTitle'),kind:val('pKind'),theme:val('pTheme')||null,theme_description:val('pThemeDescription')||null,is_online:checked('pOnline'),online_url:checked('pOnline')?(val('pOnlineUrl')||null):null,location:checked('pOnline')?null:(val('pLocation')||null),scheduled_date:val('pStart'),end_date:end,notes:val('pThemeDescription')||null,target_scope:direction||leaders?'NONE':allSelected?'ALL_FAMILIES':'SELECTED',include_fi:includeFI,include_fij:includeFIJ,leaders_only:leaders,direction_only:direction,status:'scheduled',audience:direction?'Direction':leaders?'Pilotes + Copilotes':includeFI&&includeFIJ?'FI + FIJ':includeFI?'FI':'FIJ'}).select().single());
      if(error)throw error;
      if(!direction&&!leaders&&p.target_scope==='SELECTED'){const q=await sb.from('program_family_targets').insert(selected.map(family_id=>({program_id:p.id,family_id})));if(q.error)throw q.error}
      const rows=checked('pMultiSlots')?[...document.querySelectorAll('.program-day-row')].map(r=>({program_id:p.id,program_date:r.dataset.date,starts_at:r.querySelector('.pd-start')?.value||null,ends_at:r.querySelector('.pd-end')?.value||null})):(()=>{const a=[];for(let d=new Date(val('pStart')+'T12:00:00');d<=new Date(end+'T12:00:00');d.setDate(d.getDate()+1))a.push({program_id:p.id,program_date:dateISO(d),starts_at:val('pBaseStart')||null,ends_at:val('pBaseEnd')||null});return a})();
      if(rows.length){const q=await sb.from('program_days').insert(rows);if(q.error)throw q.error}
      closeModal();await loadData();render();
    }catch(e){alert(e.message||'Enregistrement impossible.')}finally{btn.disabled=false}
  }
  console.log('[FI] v231 — fiches complètes, FI participantes repliées, modalité en ligne.');
})();