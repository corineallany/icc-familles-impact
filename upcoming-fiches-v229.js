/* v230 — fiche unique des activités : préparation, fenêtre de présence et FI participantes.
   La fenêtre d'ouverture est LUE dans Paramètres / app_settings.
   Aucune durée n'est figée dans le code. */
(function(){
  'use strict';

  function settingValue(key){
    const row=(db.settings||[]).find(s=>s.key===key);
    if(!row) return {};
    const value=row.value;
    if(value && typeof value==='object') return value;
    try{return JSON.parse(value||'{}')}catch(_){return {}}
  }

  function attendanceOpenMinutes(){
    const aw=settingValue('attendance_window');
    const timing=settingValue('timing');
    const n=Number(aw.opens_before_minutes ?? timing.attendance_open_minutes_before);
    return Number.isFinite(n) && n>=0 ? n : null;
  }

  function programStart(id){
    const p=db.programs.find(x=>+x.id===+id);
    if(!p) return null;
    const days=(db.programDays||[])
      .filter(d=>+d.program_id===+id && d.program_date)
      .sort((a,b)=>String(a.program_date).localeCompare(String(b.program_date)));
    const first=days[0];
    if(first && first.starts_at){
      return new Date(String(first.program_date)+'T'+String(first.starts_at).slice(0,8)).getTime();
    }
    if(p.planned_start) return new Date(p.planned_start).getTime();
    return null;
  }

  function programEnd(id){
    const p=db.programs.find(x=>+x.id===+id);
    if(!p) return null;
    const days=(db.programDays||[])
      .filter(d=>+d.program_id===+id && d.program_date)
      .sort((a,b)=>String(b.program_date).localeCompare(String(a.program_date)));
    const last=days[0];
    if(last && last.ends_at){
      return new Date(String(last.program_date)+'T'+String(last.ends_at).slice(0,8)).getTime();
    }
    if(p.planned_end) return new Date(p.planned_end).getTime();
    return new Date((p.end_date||p.scheduled_date)+'T23:59:59').getTime();
  }

  function meetingStart(m){
    if(m?.planned_start) return new Date(m.planned_start).getTime();
    return null;
  }

  function meetingEnd(m){
    if(m?.planned_end) return new Date(m.planned_end).getTime();
    if(m?.planned_start) return new Date(m.planned_start).getTime();
    return new Date((m?.scheduled_date||'')+'T23:59:59').getTime();
  }

  function attendanceState(kind,item){
    const now=Date.now();
    const start=kind==='meeting'?meetingStart(item):programStart(item.id);
    const end=kind==='meeting'?meetingEnd(item):programEnd(item.id);
    const mins=attendanceOpenMinutes();

    if(start===null || !Number.isFinite(start)){
      return {available:false,active:false,unknown:true,message:'L’horaire de début n’est pas encore renseigné.'};
    }

    const opensAt=start-(mins===null?0:mins*60000);
    const available=now>=opensAt;
    const active=end===null ? now>=start : now>=start && now<end;

    if(!available){
      const label=mins===null
        ? 'Les présences seront disponibles dès l’ouverture de la fenêtre définie dans Paramètres.'
        : 'Les présences s’ouvriront '+mins+' minute'+(mins>1?'s':'')+' avant le début, selon le réglage de Paramètres.';
      return {available:false,active:false,unknown:false,message:label};
    }
    if(active) return {available:true,active:true,unknown:false,message:'La saisie des présences est ouverte.'};
    return {available:true,active:false,unknown:false,message:'La saisie des présences est ouverte.'};
  }

  function upcomingParticipantsV230(families){
    const list=(families||[]).filter(Boolean);
    return list.length
      ? '<div class="upcoming-participants-v229"><h3>FI participantes ('+list.length+')</h3>'+
        list.map(f=>'<div class="family-row"><div><b>'+esc(f.name)+'</b><div class="muted">'+esc(f.family_type||'FI')+'</div></div></div>').join('')+
        '</div>'
      : '<p class="muted">Aucune FI participante identifiée.</p>';
  }

  function upcomingSheetV230(title,date,subtitle,families,kind,id){
    const item=kind==='meeting'
      ? db.meetings.find(x=>+x.id===+id)
      : db.programs.find(x=>+x.id===+id);
    const state=attendanceState(kind,item);
    const attendanceButton=state.available
      ? '<button class="primary" onclick="openAttendance(\''+kind+'\','+Number(id)+')">✓ Gérer les présences</button>'
      : '';
    modal.innerHTML='<div class="modal-card wide"><button class="close" onclick="closeModal()">×</button>'+
      '<span class="pill">'+(kind==='program'?'Programme':'Rencontre')+'</span>'+
      '<h2>'+esc(title)+'</h2><p>'+esc(date)+(subtitle?' · '+esc(subtitle):'')+'</p>'+
      '<p class="muted">'+esc(state.message)+'</p>'+
      upcomingParticipantsV230(families)+
      '<div class="row-actions">'+attendanceButton+'<button class="ghost" onclick="closeModal()">Fermer</button></div></div>';
    modal.classList.remove('hidden');
  }

  const _openMeetingV230=window.openMeeting;
  window.openMeeting=function(id){
    const m=db.meetings.find(x=>+x.id===+id);
    if(!m)return;
    const start=meetingStart(m);
    const end=meetingEnd(m);
    if(start!==null && Date.now()<end){
      const families=m.family_id?db.families.filter(f=>+f.id===+m.family_id):[];
      return upcomingSheetV230(
        m.title,
        new Date(m.scheduled_date+'T12:00').toLocaleDateString('fr-FR'),
        m.planned_start?new Date(m.planned_start).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'',
        families,'meeting',id
      );
    }
    return _openMeetingV230(id);
  };

  const _openProgramV230=window.openProgram;
  window.openProgram=function(id){
    const p=db.programs.find(x=>+x.id===+id);
    if(!p)return;
    const end=programEnd(id);
    if(end!==null && Date.now()<end){
      return upcomingSheetV230(
        p.title,
        new Date(p.scheduled_date+'T12:00').toLocaleDateString('fr-FR')+
          (p.end_date&&p.end_date!==p.scheduled_date?' → '+new Date(p.end_date+'T12:00').toLocaleDateString('fr-FR'):''),
        p.kind||'Programme',
        typeof programTargetFamilies==='function'?programTargetFamilies(p):[],
        'program',id
      );
    }
    return _openProgramV230(id);
  };

  const _openOccurrenceV230=window.openOccurrence;
  if(typeof _openOccurrenceV230==='function'){
    window.openOccurrence=function(o){
      if(o&&o.date){
        const start=o.time
          ? new Date(o.date+'T'+String(o.time).slice(0,5)+':00').getTime()
          : new Date(o.date+'T23:59:59').getTime();
        const end=o.endTime
          ? new Date(o.date+'T'+String(o.endTime).slice(0,5)+':00').getTime()
          : new Date(o.date+'T23:59:59').getTime();
        if(Date.now()<end){
          const mins=attendanceOpenMinutes();
          const available=start!==null && Date.now() >= start-(mins===null?0:mins*60000);
          const message=available
            ? 'La saisie des présences est ouverte dès que la fenêtre configurée dans Paramètres est atteinte.'
            : (mins===null
              ? 'Les présences seront disponibles selon la fenêtre définie dans Paramètres.'
              : 'Les présences s’ouvriront '+mins+' minute'+(mins>1?'s':'')+' avant le début, selon le réglage de Paramètres.');
          const fams=typeof occurrenceFamilies==='function'?occurrenceFamilies(o):[];
          modal.innerHTML='<div class="modal-card wide"><button class="close" onclick="closeModal()">×</button>'+
            '<span class="pill">'+esc(o.type||'FI')+'</span>'+
            '<h2>'+esc(o.title)+'</h2>'+
            '<p>'+new Date(o.date+'T12:00').toLocaleDateString('fr-FR')+' · '+esc(o.time||'Horaire à préciser')+(o.endTime?' → '+esc(o.endTime):'')+'</p>'+
            '<p class="muted">'+esc(message)+'</p>'+
            upcomingParticipantsV230(fams)+
            '<div class="row-actions"><button class="ghost" onclick="closeModal()">Fermer</button></div></div>';
          modal.classList.remove('hidden');
          return;
        }
      }
      return _openOccurrenceV230(o);
    };
  }

  console.log('[FI] Fiches activités v230 : Paramètres pilotent réellement l’ouverture des présences.');
})();