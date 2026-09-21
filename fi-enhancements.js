/* Améliorations transversales FI : Sarthe connectée, arrivée partielle, géographie, compteurs, pilotage, archives, modèles et FI/FIJ Tour. */
let extraFI={archives:[],tours:[]};
const _loadExtra=loadData;loadData=async function(){await _loadExtra();const [a,t]=await Promise.all([sb.from('archive_periods').select('*').order('starts_on',{ascending:false}),sb.from('fi_tour_visits').select('*').order('visit_date',{ascending:false})]);extraFI.archives=a.data||[];extraFI.tours=t.data||[]};
window.LE_MANS_AREAS=LE_MANS_AREAS;window.LE_MANS_GRANDS_SECTEURS=LE_MANS_GRANDS_SECTEURS;
function memberArrivalParts(m){const a=activeAssignmentFor(m.id),d=a?.starts_at?new Date(a.starts_at+'T12:00:00'):null;return {day:m.fi_arrival_day||'',month:m.fi_arrival_month||(d?d.getMonth()+1:''),year:m.fi_arrival_year||(d?d.getFullYear():'')}}
function arrivalPartsLabel(m){const x=memberArrivalParts(m);if(!x.year&&!x.month&&!x.day)return 'Non renseignée';const months=['','janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];return [x.day||null,x.month?months[+x.month]:null,x.year||null].filter(Boolean).join(' ')}
function familyMemberCount(fid){return db.assignments.filter(a=>+a.family_id===+fid&&!a.ends_at).length}
const _familySpaceCount=familySpaceBody;familySpaceBody=function(f,tab,x){const html=_familySpaceCount(f,tab,x);return `<div class="family-count-banner"><strong>${familyMemberCount(f.id)}</strong><span>membre${familyMemberCount(f.id)>1?'s':''} actuellement dans cette ${f.family_type}</span></div>`+html};
function averagePresence(start,end){const ended=db.meetings.filter(m=>m.scheduled_date>=start&&m.scheduled_date<=end&&m.status!=='cancelled'&&new Date(m.planned_end||m.scheduled_date)<new Date());if(!ended.length)return null;const vals=ended.map(m=>db.attendance.filter(a=>+a.meeting_id===+m.id&&a.present).length);return Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10}
const _pilotagePresence=pilotage;pilotage=function(){const html=_pilotagePresence(),range=typeof statsRange==='function'?statsRange():['1900-01-01','2999-12-31'],avg=averagePresence(range[0],range[1]);return html+`<div class="card settings-block"><p class="eyebrow">PRÉSENCES</p><h3>Présence moyenne</h3><div class="metric"><strong>${avg===null?'—':avg}</strong><span>${avg===null?'Aucune rencontre terminée sur cette période.':'personnes présentes en moyenne par rencontre terminée sur la période sélectionnée'}</span></div></div>`};
function archivesSettings(){return `<div class="card settings-block"><div class="toolbar"><div><p class="eyebrow">ARCHIVES</p><h3>Archives par période</h3><p class="muted">Archiver masque une période des vues courantes sans supprimer aucune rencontre, présence ou reporting. Les archives restent consultables.</p></div><button class="ghost" onclick="formArchivePeriod()">＋ Nouvelle période</button></div>${extraFI.archives.map(a=>`<div class="family-row"><div><b>${esc(a.name)}</b><div class="muted">${fmtDate(a.starts_on)} → ${fmtDate(a.ends_on)} · ${a.scope}</div></div><span class="pill">${a.status==='archived'?'Archivée':'Ouverte'}</span>${a.status!=='archived'?`<button class="ghost" onclick="archivePeriod(${a.id})">Archiver</button>`:`<button class="ghost" onclick="showArchive(${a.id})">Afficher</button>`}</div>`).join('')||'<p class="muted">Aucune période archivée.</p>'}</div>`}
const _settingsAdminArchive=settingsAdmin;settingsAdmin=function(){return _settingsAdminArchive()+archivesSettings()};
function formArchivePeriod(){modalForm('Nouvelle période d’archive',`<input id="arName" placeholder="Nom de la période"><div class="form-row"><input id="arStart" type="date"><input id="arEnd" type="date"></div><select id="arScope"><option value="BOTH">FI + FIJ</option><option>FI</option><option>FIJ</option></select><textarea id="arNotes" placeholder="Notes"></textarea>`,async()=>{if(!arName.value||!arStart.value||!arEnd.value)throw Error('Nom et période requis.');const {error}=await sb.from('archive_periods').insert({name:arName.value,starts_on:arStart.value,ends_on:arEnd.value,scope:arScope.value,notes:arNotes.value||null});if(error)throw error})}
async function archivePeriod(id){if(!confirm('Archiver cette période ? Aucune donnée ne sera supprimée.'))return;const {error}=await sb.from('archive_periods').update({status:'archived',archived_at:new Date().toISOString(),archived_by:session.user.id}).eq('id',id);if(error)return alert(error.message);await loadData();render()}
function showArchive(id){const a=extraFI.archives.find(x=>+x.id===+id),meet=db.meetings.filter(m=>m.scheduled_date>=a.starts_on&&m.scheduled_date<=a.ends_on);modal.innerHTML=`<div class="modal-card wide"><button class="close" onclick="closeModal()">×</button><h2>${esc(a.name)}</h2><p class="muted">Archive conservée · ${fmtDate(a.starts_on)} → ${fmtDate(a.ends_on)}</p>${meet.map(m=>`<div class="family-row"><b>${esc(m.title)}</b><span>${fmtDate(m.scheduled_date)} · ${m.family_id?esc(familyName(m.family_id)):''}</span></div>`).join('')||'<p class="muted">Aucune rencontre sur cette période.</p>'}</div>`;modal.classList.remove('hidden')}
function editTemplateDirect(id){const t=db.templates.find(x=>+x.id===+id);if(!t)return;modalForm('Modifier le modèle',`<input id="etName" value="${esc(t.name)}"><select id="etType"><option ${t.family_type==='FI'?'selected':''}>FI</option><option ${t.family_type==='FIJ'?'selected':''}>FIJ</option></select><input id="etKind" value="${esc(t.meeting_kind||'')}"><label><input id="etReport" type="checkbox" ${t.reporting_required?'checked':''}> Reporting requis</label>`,async()=>{const {error}=await sb.from('meeting_templates').update({name:etName.value.trim(),family_type:etType.value,meeting_kind:etKind.value.trim(),reporting_required:etReport.checked}).eq('id',id);if(error)throw error})}
const _openTemplateEdit=openTemplate;openTemplate=function(id){_openTemplateEdit(id);const c=modal.querySelector('.modal-card');if(c&&isDirection())c.insertAdjacentHTML('beforeend',`<div class="settings-savebar"><span class="muted">Configuration du modèle</span><button class="ghost" onclick="closeModal();editTemplateDirect(${id})">Modifier le modèle</button></div>`)};
function fiTourForm(){
  modalForm('FI/FIJ Tour',
    '<label>Nom du Tour<input id="tourTitle" value="FI/FIJ Tour"></label>'+
    '<label>Date *<input id="tourDate" type="date"></label>'+
    '<p class="muted">Ajoutez une ou plusieurs FI/FIJ visitées le même jour, avec leur horaire de passage.</p>'+
    '<div id="tourStops"></div>'+
    '<button type="button" class="ghost" onclick="addTourStop()">＋ Ajouter une FI/FIJ visitée</button>',
    async()=>{
      const stops=[...document.querySelectorAll('.tour-stop')];
      if(!tourDate.value||!stops.length)throw Error('Date et au moins une FI/FIJ sont requises.');
      const {data:p,error}=await sb.from('programs').insert({
        title:tourTitle.value.trim()||'FI/FIJ Tour',
        kind:'FI/FIJ Tour',
        scheduled_date:tourDate.value,
        end_date:tourDate.value,
        status:'scheduled',
        target_scope:'selected'
      }).select().single();
      if(error)throw error;
      const rows=stops.map(s=>({
        program_id:p.id,
        family_id:+s.querySelector('.tour-family').value,
        visit_date:tourDate.value,
        starts_at:s.querySelector('.tour-start').value||null,
        ends_at:s.querySelector('.tour-end').value||null
      }));
      const q=await sb.from('fi_tour_visits').insert(rows);
      if(q.error)throw q.error;
      await loadData();
      render();
    });
  setTimeout(addTourStop,0);
}
function addTourStop(){
  const host=document.getElementById('tourStops');if(!host)return;
  const d=document.createElement('div');d.className='tour-stop form-row';
  d.innerHTML='<select class="tour-family">'+db.families.map(f=>'<option value="'+f.id+'">'+esc(f.family_type)+' · '+esc(f.name)+'</option>').join('')+'</select>'+
    '<input class="tour-start" type="time"><input class="tour-end" type="time">'+
    '<button type="button" class="ghost danger" onclick="this.parentElement.remove()">×</button>';
  host.appendChild(d);
}
function tourFamilyBlock(fid){const visits=extraFI.tours.filter(v=>+v.family_id===+fid);if(!visits.length)return '';return `<div class="card settings-block"><h3>Visites FI/FIJ Tour</h3>${visits.map(v=>`<div class="family-row"><div><b>${fmtDate(v.visit_date)}</b><div class="muted">Passage du Pasteur${v.starts_at?' · '+String(v.starts_at).slice(0,5):''}${v.ends_at?'–'+String(v.ends_at).slice(0,5):''}</div></div><span class="pill">Programme</span></div>`).join('')}</div>`}
const _familyTour=familySpaceBody;familySpaceBody=function(f,tab,x){return _familyTour(f,tab,x)+tourFamilyBlock(f.id)};