/* Canonical FI Agenda bridge — independent from optional agenda-ui layers. */
(function(){
  function renderCanonicalFamilyAgenda(id){
    const f=db.families.find(x=>+x.id===+id), body=document.getElementById('familySpaceBody');
    if(!f||!body)return;
    const rows=familyMeetings(+id).map(m=>{
      const now=new Date(), start=meetingStart(m), end=meetingEnd(m);
      const phase=m.status==='cancelled'?'past':now<start?'upcoming':now<=end?'current':'past';
      return {phase,html:'<div class="family-row"><div class="clickable" onclick="openMeeting('+m.id+')"><b>'+esc(m.title)+'</b><div class="muted">'+m.scheduled_date+(m.planned_start?' · '+new Date(m.planned_start).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'')+'</div></div><div class="row-actions">'+(phase==='current'&&attendanceWindow(m)?'<button class="primary" onclick="event.stopPropagation();openAttendance(\'meeting\','+m.id+')">Présences</button>':'')+(phase==='past'&&m.reporting_required!==false?'<button class="ghost" onclick="event.stopPropagation();openReportingReadV207('+m.id+')">Reporting</button>':'')+'<span class="pill">'+(phase==='current'?'En cours':phase==='past'?'Passée':'À venir')+'</span></div></div>'};
    });
    const phase=window.__fiAgendaPhase||'upcoming', out=rows.filter(x=>x.phase===phase);
    const count=k=>rows.filter(x=>x.phase===k).length;
    body.innerHTML='<div class="card"><div class="toolbar"><div><h3>Agenda</h3><p class="muted">'+esc(f.name)+'</p></div></div><div class="meeting-subtabs-v180" role="tablist"><button type="button" class="'+(phase==='past'?'active':'')+'" onclick="window.__fiAgendaPhase=\'past\';renderCanonicalFamilyAgenda('+id+')">Passées ('+count('past')+')</button><button type="button" class="'+(phase==='current'?'active':'')+'" onclick="window.__fiAgendaPhase=\'current\';renderCanonicalFamilyAgenda('+id+')">En cours ('+count('current')+')</button><button type="button" class="'+(phase==='upcoming'?'active':'')+'" onclick="window.__fiAgendaPhase=\'upcoming\';renderCanonicalFamilyAgenda('+id+')">À venir ('+count('upcoming')+')</button></div><div class="activity-list-v237">'+(out.map(x=>x.html).join('')||'<p class="muted">Aucune rencontre dans cette catégorie.</p>')+'</div></div>';
  }
  window.renderCanonicalFamilyAgenda=renderCanonicalFamilyAgenda;
  const base=window.familySpace;
  if(typeof base==='function'&&!base.__canonicalAgendaBridge){
    const wrapped=function(id,tab){
      base.call(this,id,tab);
      if(tab==='meetings'||tab==='agenda'||tab==='programs')setTimeout(function(){renderCanonicalFamilyAgenda(+id)},0);
    };
    wrapped.__canonicalAgendaBridge=true;
    window.familySpace=wrapped;
  }
})();