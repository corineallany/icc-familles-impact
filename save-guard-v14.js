/* v14 — enregistrements sûrs, anti double-clic et présences idempotentes. */
(function(){
 window.runOnceV14=async function(button,work,label='Enregistrement…'){
   if(button?.dataset.busy==='1')return;
   if(button){button.dataset.busy='1';button.disabled=true;button.dataset.oldText=button.textContent;button.textContent=label}
   try{return await work()}catch(e){console.error(e);alert(e?.message||'Une erreur est survenue.');throw e}
   finally{if(button){button.dataset.busy='0';button.disabled=false;button.textContent=button.dataset.oldText||'Enregistrer'}}
 };
 window.saveMeetingAttendance=async function(id,live,button){
   return runOnceV14(button,async()=>{
     const m=db.meetings.find(x=>+x.id===+id);if(!m)throw Error('Rencontre introuvable.');
     const rows=[...document.querySelectorAll('.att-present')];
     for(const c of rows){
       const member_id=+c.dataset.member,box=document.querySelector('.attendance-detail[data-member="'+member_id+'"]'),time=box?.querySelector('.att-time'),unk=box?.querySelector('.att-unknown'),reason=box?.querySelector('.att-late-reason'),present=c.checked,family_id=m.family_id||memberFamilyId(member_id),arrival_unknown=present&&!!unk?.checked,arrival_time=present&&!arrival_unknown&&time?.value?time.value:null,is_late=present&&arrival_time?lateMinutes(m,arrival_time)>0:false;
       const existing=db.attendance.find(a=>+a.meeting_id===+id&&+a.member_id===member_id);
       const payload={meeting_id:id,program_id:null,member_id,family_id,present,arrival_time,arrival_unknown,is_late,late_reason:is_late?(reason?.value.trim()||null):null,entry_mode:live?'live':'after_meeting',marked_by:session.user.id,marked_at:new Date().toISOString()};
       const q=existing?await sb.from('attendance').update(payload).eq('id',existing.id):await sb.from('attendance').insert(payload);
       if(q.error)throw q.error;
     }
     await loadData();alert('Présences enregistrées.');closeModal();render();
   });
 };
 const oldOpenAttendance=openAttendance;
 openAttendance=function(kind,id){oldOpenAttendance(kind,id);if(kind!=='meeting')return;const b=[...modal.querySelectorAll('button')].find(x=>x.textContent.includes('Enregistrer les présences'));if(b)b.onclick=function(){saveMeetingAttendance(id,attendanceWindow(db.meetings.find(x=>+x.id===+id)),this)}};
 document.addEventListener('click',function(e){const b=e.target.closest('button');if(!b||b.dataset.busy!=='1')return;e.preventDefault();e.stopImmediatePropagation()},true);
})();
