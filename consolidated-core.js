/* consolidated-core.js — couche fonctionnelle unique post-audit. */
(function(){
 const statusLabel=s=>({scheduled:'Prévue',completed:'Terminée',cancelled:'Annulée',postponed:'Reportée',active:'Active'}[s]||s||'Prévue');
 window.statusLabel=statusLabel;
 const oldDashboard=dashboard;
 dashboard=function(){
   const people=typeof pilotPeopleStatsV12==='function'?pilotPeopleStatsV12('1900-01-01','2999-12-31'):{newcomers:[],visitors:[]};
   return `<div class="grid">
   <div class="card metric clickable" onclick="familyTab='FI';go('FI & FIJ')"><span>FI</span><strong>${db.families.filter(f=>f.family_type==='FI').length}</strong></div>
   <div class="card metric clickable" onclick="familyTab='FIJ';go('FI & FIJ')"><span>FIJ</span><strong>${db.families.filter(f=>f.family_type==='FIJ').length}</strong></div>
   <div class="card metric clickable" onclick="go('Membres')"><span>Membres</span><strong>${db.members.filter(m=>m.active!==false).length}</strong></div>
   <div class="card metric clickable" onclick="go('Pilotage')"><span>Présences enregistrées</span><strong>${db.attendance.filter(a=>a.present).length}</strong></div>
   <div class="card metric clickable" onclick="go('Pilotage')"><span>Nouveaux / sans rattachement</span><strong>${people.newcomers.length}</strong></div>
   <div class="card metric clickable" onclick="go('Pilotage')"><span>Visiteurs</span><strong>${people.visitors.length}</strong></div>
   </div><div class="section-grid"><div class="card"><h2>Modèles hebdomadaires</h2>${db.templates.map(t=>`<div class="family-row clickable" onclick="openTemplate(${t.id})"><div><b>${esc(t.name)}</b><div class="muted">Configurer et consulter l’historique</div></div><span class="pill ${t.family_type.toLowerCase()}">${t.family_type}</span></div>`).join('')}</div><div class="card clickable" onclick="go('Planning')"><h2>Planning</h2><p class="muted">Rencontres, programmes, événements et pauses.</p></div></div>`;
 };
 const oldMeetings=meetingsPage;
 meetingsPage=function(){
   const html=oldMeetings();
   return html.replace(/scheduled/g,'Prévue').replace(/completed/g,'Terminée').replace(/cancelled/g,'Annulée').replace(/postponed/g,'Reportée');
 };
 const oldPrograms=programsPage;
 programsPage=function(){
   const html=oldPrograms();
   return html.replace(/scheduled/g,'Prévu').replace(/completed/g,'Terminé').replace(/cancelled/g,'Annulé').replace(/postponed/g,'Reporté');
 };
})();
