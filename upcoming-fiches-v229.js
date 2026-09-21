/* v229 — fiche unique des activités à venir : informations + FI participantes, sans Reporting ni action de présence */
(function(){
  function upcomingParticipantsV229(families){
    const list=(families||[]).filter(Boolean);
    return list.length
      ? '<div class="upcoming-participants-v229"><h3>FI participantes ('+list.length+')</h3>'+
        list.map(f=>'<div class="family-row"><div><b>'+esc(f.name)+'</b><div class="muted">'+esc(f.family_type||'FI')+'</div></div></div>').join('')+
        '</div>'
      : '<p class="muted">Aucune FI participante identifiée.</p>';
  }
  function upcomingSheetV229(title,date,subtitle,families,kind){
    modal.innerHTML='<div class="modal-card wide"><button class="close" onclick="closeModal()">×</button>'+
      '<span class="pill">'+(kind==='program'?'Programme':'Rencontre')+'</span>'+
      '<h2>'+esc(title)+'</h2><p>'+esc(date)+(subtitle?' · '+esc(subtitle):'')+'</p>'+
      '<p class="muted">Fiche de préparation — activité à venir. Le Reporting et la saisie des présences seront disponibles après la rencontre.</p>'+
      upcomingParticipantsV229(families)+
      '<div class="row-actions"><button class="ghost" onclick="closeModal()">Fermer</button></div></div>';
    modal.classList.remove('hidden');
  }
  const _openMeetingV229=window.openMeeting;
  window.openMeeting=function(id){
    const m=db.meetings.find(x=>+x.id===+id);
    if(!m)return;
    const start=m.planned_start?new Date(m.planned_start).getTime():new Date(m.scheduled_date+'T23:59:59').getTime();
    if(start>Date.now()){
      const families=m.family_id?db.families.filter(f=>+f.id===+m.family_id):[];
      return upcomingSheetV229(m.title,new Date(m.scheduled_date+'T12:00').toLocaleDateString('fr-FR'),
        m.planned_start?new Date(m.planned_start).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'',families,'meeting');
    }
    return _openMeetingV229(id);
  };
  const _openProgramV229=window.openProgram;
  window.openProgram=function(id){
    const p=db.programs.find(x=>+x.id===+id);
    if(!p)return;
    const end=p.end_date||p.scheduled_date;
    if(new Date(end+'T23:59:59').getTime()>Date.now()){
      return upcomingSheetV229(p.title,
        new Date(p.scheduled_date+'T12:00').toLocaleDateString('fr-FR')+(end!==p.scheduled_date?' → '+new Date(end+'T12:00').toLocaleDateString('fr-FR'):''),
        p.kind||'Programme',typeof programTargetFamilies==='function'?programTargetFamilies(p):[],'program');
    }
    return _openProgramV229(id);
  };
  const _openOccurrenceV229=window.openOccurrence;
  if(typeof _openOccurrenceV229==='function'){
    window.openOccurrence=function(o){
      if(o&&o.date&&new Date(o.date+'T23:59:59').getTime()>Date.now()){
        const fams=typeof occurrenceFamilies==='function'?occurrenceFamilies(o):[];
        return upcomingSheetV229(o.title,new Date(o.date+'T12:00').toLocaleDateString('fr-FR'),
          (o.time||'')+(o.endTime?' → '+o.endTime:''),fams,'meeting');
      }
      return _openOccurrenceV229(o);
    };
  }
  console.log('[FI] Fiches activités à venir v229 actives : informations + FI participantes uniquement.');
})();