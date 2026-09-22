/* v228 — circuit unique et robuste de gestion des présences.
   Toutes les entrées de l'application passent par window.openAttendance(kind,id).
   Cette couche est chargée en dernier afin de neutraliser les anciens wrappers
   de présence qui pouvaient empêcher l'ouverture de la fiche. */
(function(){
  'use strict';

  function itemFor(kind,id){
    const list = kind === 'meeting' ? db.meetings : db.programs;
    return (list||[]).find(x => Number(x.id) === Number(id));
  }

  function memberFamily(memberId){
    const a = (db.assignments||[]).find(x =>
      String(x.member_id) === String(memberId) && !x.ends_at
    );
    return a ? Number(a.family_id) : null;
  }

  function permittedFamilies(program){
    if (!program) return [];
    if (program.direction_only || program.leaders_only) return [];
    if (typeof programFamilyIds === 'function') {
      return (programFamilyIds(program)||[]).map(Number);
    }
    if (program.target_scope === 'SELECTED_FAMILIES') {
      return (db.programTargets||[])
        .filter(x => Number(x.program_id) === Number(program.id))
        .map(x => Number(x.family_id));
    }
    return (db.families||[])
      .filter(f =>
        (program.include_fi && f.family_type === 'FI') ||
        (program.include_fij && f.family_type === 'FIJ')
      )
      .map(f => Number(f.id));
  }

  function canEditFamily(fid){
    return !!(typeof canManageAttendanceFamily === 'function'
      ? canManageAttendanceFamily(fid)
      : (typeof isDirection === 'function' && isDirection()));
  }

  function plannedStart(kind,id){
    const item = itemFor(kind,id);
    if (!item) return null;
    if (item.planned_start) return item.planned_start;
    if (kind === 'program') {
      const wantedDay = window._canonicalAttendanceDayId == null ? null : Number(window._canonicalAttendanceDayId);
      const day = (db.programDays||[])
        .filter(d => Number(d.program_id) === Number(id) && d.starts_at && (wantedDay == null || Number(d.id) === wantedDay))
        .sort((a,b) => String(a.program_date).localeCompare(String(b.program_date)))[0];
      if (day) {
        return new Date(
          String(day.program_date||item.scheduled_date) + 'T' +
          String(day.starts_at).slice(0,8)
        ).toISOString();
      }
    }
    return null;
  }

  function minutes(value){
    if (!value) return null;
    const m = String(value).match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1])*60 + Number(m[2]) : null;
  }

  function plannedMinutes(kind,id){
    const p = plannedStart(kind,id);
    if (!p) return null;
    const d = new Date(p);
    return d.getHours()*60 + d.getMinutes();
  }

  function rowsFor(kind,id,programDayId=null){
    const item = itemFor(kind,id);
    if (!item) return [];

    let members = [];
    if (kind === 'meeting') {
      const fid = item.family_id == null ? null : Number(item.family_id);
      members = (db.members||[]).filter(m =>
        m.active !== false && (!fid || memberFamily(m.id) === fid)
      );
    } else {
      const fids = permittedFamilies(item);
      members = (db.members||[]).filter(m => {
        if (m.active === false) return false;
        const fid = memberFamily(m.id);
        return typeof isDirection === 'function' && isDirection()
          ? true
          : fids.includes(Number(fid));
      });
    }

    return members.map(m => {
      const a = (db.attendance||[]).find(x =>
        Number(x.member_id) === Number(m.id) &&
        Number(x[kind+'_id']) === Number(id) &&
        (kind !== 'program' || programDayId == null || Number(x.program_day_id) === Number(programDayId))
      );
      const arrival = a?.arrival_time ? String(a.arrival_time).slice(0,5) : '';
      const p = plannedMinutes(kind,id);
      const arrivalMin = minutes(arrival);
      const late = !!a?.is_late || (p !== null && arrivalMin !== null && arrivalMin > p);
      return {m,a,arrival,late};
    });
  }

  window.toggleCanonicalLate = function(memberId){
    const time = document.querySelector('.canonical-att-time[data-member="'+memberId+'"]');
    const box = document.getElementById('canonical-late-'+memberId);
    if (!time || !box) return;
    const p = plannedMinutes(window._canonicalAttendanceKind, window._canonicalAttendanceId);
    const a = minutes(time.value);
    box.classList.toggle('hidden', !(p !== null && a !== null && a > p));
  };

  window.toggleCanonicalUnknown = function(el){
    const time = document.querySelector('.canonical-att-time[data-member="'+el.dataset.member+'"]');
    if (!time) return;
    time.disabled = !!el.checked;
    if (el.checked) time.value = '';
    window.toggleCanonicalLate(Number(el.dataset.member));
  };

  window.saveCanonicalAttendance = async function(kind,id,button){
    if (button?.dataset.busy === '1') return;
    if (button) {
      button.dataset.busy = '1';
      button.disabled = true;
      button.dataset.oldText = button.textContent;
      button.textContent = 'Enregistrement…';
    }

    try {
      const checks = [...document.querySelectorAll('.canonical-att-present')];
      const p = plannedMinutes(kind,id);

      for (const check of checks) {
        const memberId = Number(check.dataset.member);
        const time = document.querySelector('.canonical-att-time[data-member="'+memberId+'"]');
        const unknown = document.querySelector('.canonical-att-unknown[data-member="'+memberId+'"]');
        const reasonEl = document.querySelector('.canonical-att-reason[data-member="'+memberId+'"]');

        const arrival = check.checked && !unknown?.checked && time?.value
          ? time.value
          : null;
        const arrivalMin = minutes(arrival);
        const late = !!(
          check.checked &&
          arrivalMin !== null &&
          p !== null &&
          arrivalMin > p
        );
        const reason = late && reasonEl?.value
          ? reasonEl.value.trim() || null
          : null;

        const {error} = await sb.rpc('save_attendance_entry',{
          p_meeting_id: kind === 'meeting' ? Number(id) : null,
          p_program_id: kind === 'program' ? Number(id) : null,
          p_program_day_id: kind === 'program' ? (window._canonicalAttendanceDayId == null ? null : Number(window._canonicalAttendanceDayId)) : null,
          p_member_id: memberId,
          p_family_id: memberFamily(memberId),
          p_present: !!check.checked,
          p_arrival_time: arrival,
          p_arrival_unknown: !!(check.checked && unknown?.checked),
          p_is_late: late,
          p_late_reason: reason
        });
        if (error) throw error;
      }

      await loadData();
      if (typeof render === 'function') render();
      closeModal();
    } catch (e) {
      console.error('[FI attendance v228]', e);
      alert(typeof frenchError === 'function'
        ? frenchError(e)
        : 'Impossible d’enregistrer les présences.');
    } finally {
      if (button) {
        button.dataset.busy = '0';
        button.disabled = false;
        button.textContent = button.dataset.oldText || 'Enregistrer les présences';
      }
    }
  };

  window.changeCanonicalAttendanceDay = function(kind,id,dayId){
    window._canonicalAttendanceDayId = Number(dayId);
    window.openAttendance(kind,id);
  };

  window.openAttendance = function(kind,id){
    try {
      if (kind !== 'meeting' && kind !== 'program') {
        throw new Error('Type de présence non reconnu.');
      }

      const item = itemFor(kind,id);
      if (!item) {
        alert('Cette rencontre ou ce programme n’est plus disponible. Actualisez la page.');
        return;
      }

      // Règle métier dans le circuit unique : l'ouverture vient de Paramètres,
      // jamais d'une durée codée en dur.
      const attendanceSetting = (db.settings||[]).find(s => s.key === 'attendance_window');
      const timingSetting = (db.settings||[]).find(s => s.key === 'timing');
      const attendanceCfg = attendanceSetting?.value || {};
      const timingCfg = timingSetting?.value || {};
      const openMinutesRaw = attendanceCfg.opens_before_minutes ?? timingCfg.attendance_open_minutes_before;
      const openMinutes = Number(openMinutesRaw);
      if (kind === 'meeting' && typeof meetingPhase === 'function' && typeof attendanceWindow === 'function') {
        const phase = meetingPhase(item);
        const live = attendanceWindow(item);
        if (phase === 'upcoming' && !live) {
          const label = Number.isFinite(openMinutes) ? String(openMinutes) : 'la durée configurée';
          alert('Les présences ne sont pas encore ouvertes. Elles s’ouvrent selon le réglage de Paramètres ('+label+(Number.isFinite(openMinutes)?' min avant le début':'')+').');
          return;
        }
      }
      if (kind === 'program') {
        const days = (db.programDays||[])
          .filter(d => Number(d.program_id) === Number(id) && d.program_date && d.starts_at)
          .sort((a,b) => String(a.program_date).localeCompare(String(b.program_date)));
        const first = days.find(d => Number(d.id) === Number(window._canonicalAttendanceDayId)) || days[0];
        if (first && Number.isFinite(openMinutes)) {
          const start = new Date(String(first.program_date)+'T'+String(first.starts_at).slice(0,8)).getTime();
          if (Date.now() < start - openMinutes*60000) {
            alert('Les présences ne sont pas encore ouvertes. Elles s’ouvrent '+openMinutes+' minute'+(openMinutes>1?'s':'')+' avant le début, selon le réglage de Paramètres.');
            return;
          }
        }
      }

      if (kind === 'meeting') {
        const fid = item.family_id == null ? null : Number(item.family_id);
        if (fid && !canEditFamily(fid)) {
          alert('Vous n’avez pas les droits nécessaires pour gérer les présences de cette famille.');
          return;
        }
      } else {
        const fids = permittedFamilies(item);
        const allowed = typeof isDirection === 'function' && isDirection()
          ? true
          : fids.some(canEditFamily);
        if (!allowed) {
          alert('Vous n’avez pas les droits nécessaires pour gérer les présences de ce programme.');
          return;
        }
      }

      window._canonicalAttendanceKind = kind;
      window._canonicalAttendanceId = Number(id);
      const requestedDayId = window._canonicalAttendanceDayId == null ? null : Number(window._canonicalAttendanceDayId);
      let selectedDay = null;
      if (kind === 'program') {
        const days = (db.programDays||[]).filter(d => Number(d.program_id) === Number(id)).sort((a,b)=>String(a.program_date).localeCompare(String(b.program_date)));
        if (days.length) {
          selectedDay = days.find(d => Number(d.id) === Number(requestedDayId)) || days.find(d => d.program_date === dateISO(new Date())) || days[0];
          window._canonicalAttendanceDayId = selectedDay?.id ?? null;
        }
      }

      const rows = rowsFor(kind,id,window._canonicalAttendanceDayId);
      const p = plannedMinutes(kind,id);
      const title = item.title || (kind === 'meeting' ? 'Rencontre' : 'Programme');
      const subtitle = [
        selectedDay?.program_date || item.scheduled_date || '',
        selectedDay?.starts_at ? String(selectedDay.starts_at).slice(0,5) : '',
        selectedDay?.ends_at ? '→ '+String(selectedDay.ends_at).slice(0,5) : '',
        kind === 'meeting' && item.family_id ? familyName(item.family_id) : ''
      ].filter(Boolean).join(' · ');

      const html = rows.map(({m,a,arrival,late}) => {
        const unknown = !!a?.arrival_unknown;
        const fid = kind === 'meeting' ? Number(item.family_id) : memberFamily(m.id);
        const tmp = typeof temporaryTransferDisplay === 'function' ? temporaryTransferDisplay(fid,m.id) : null;
        const perm = typeof permanentTransferDisplay === 'function' ? permanentTransferDisplay(fid,m.id) : null;
        const transferLabel = tmp ? '<span class="pill">Affectation temporaire</span>' : perm ? '<span class="pill">Transfert définitif</span>' : '';
        const transferHint = tmp ? ' · Depuis '+esc(familyName(tmp.from_family_id)) : perm ? ' · Ancienne FI : '+esc(familyName(perm.movement.from_family_id)) : '';
        return `
          <div class="attendance-row">
            <label class="attendance-person">
              <input type="checkbox"
                class="canonical-att-present"
                data-member="${m.id}"
                ${a?.present ? 'checked' : ''}>
              <span>
                <b>${esc(memberName(m.id))} ${transferLabel}</b>
                <small>${esc(familyName(fid))}${transferHint}</small>
              </span>
            </label>
            <div class="attendance-arrival">
              <label>
                <span>Heure d’arrivée</span>
                <input type="time"
                  class="canonical-att-time"
                  data-member="${m.id}"
                  value="${esc(arrival)}"
                  ${unknown ? 'disabled' : ''}>
              </label>
              <label class="unknown">
                <input type="checkbox"
                  class="canonical-att-unknown"
                  data-member="${m.id}"
                  ${unknown ? 'checked' : ''}>
                Heure non connue
              </label>
              <div id="canonical-late-${m.id}"
                   class="${late ? '' : 'hidden'} att-late-box">
                <label>
                  Motif du retard <span class="muted">(facultatif)</span>
                  <textarea class="canonical-att-reason"
                    data-member="${m.id}"
                    rows="2"
                    placeholder="Précisez éventuellement le motif du retard">${esc(a?.late_reason||'')}</textarea>
                </label>
              </div>
            </div>
          </div>`;
      }).join('');

      modal.innerHTML = `
        <div class="modal-card wide reporting-sheet">
          <button class="close" onclick="closeModal()">×</button>
          <p class="eyebrow">GESTION DES PRÉSENCES</p>
          <h2>${esc(title)}</h2>
          <p class="muted">${esc(subtitle)}</p>
          ${kind === 'program' && (db.programDays||[]).filter(d=>Number(d.program_id)===Number(id)).length ? `<label class="attendance-day-picker"><span>Journée à gérer</span><select onchange="window.changeCanonicalAttendanceDay('${kind}',${Number(id)},this.value)">${(db.programDays||[]).filter(d=>Number(d.program_id)===Number(id)).sort((a,b)=>String(a.program_date).localeCompare(String(b.program_date))).map(d=>`<option value="${d.id}" ${Number(d.id)===Number(window._canonicalAttendanceDayId)?'selected':''}>${esc(d.program_date)}${d.starts_at?' · '+String(d.starts_at).slice(0,5):''}${d.ends_at?' → '+String(d.ends_at).slice(0,5):''}</option>`).join('')}</select></label>` : ''}
          <p class="muted">
            Cette fiche est le point d’entrée unique des présences.
            Cochez les personnes présentes et renseignez l’heure d’arrivée si elle est connue.
          </p>
          <div class="attendance-list">
            ${html || '<p class="muted">Aucune personne dans votre périmètre.</p>'}
          </div>
          <div class="row-actions">
            <button type="button" class="ghost" onclick="closeModal()">Annuler</button>
            <button type="button" class="primary"
              onclick="saveCanonicalAttendance('${kind}',${Number(id)},this)">
              Enregistrer les présences
            </button>
          </div>
        </div>`;

      modal.classList.remove('hidden');
    } catch (e) {
      console.error('[FI attendance v228 open]', e);
      alert('La gestion des présences n’a pas pu être ouverte. Actualisez la page et réessayez.');
    }
  };

  document.addEventListener('change',function(e){
    const el=e.target;
    if (el.matches('.canonical-att-unknown')) {
      window.toggleCanonicalUnknown(el);
    } else if (el.matches('.canonical-att-time')) {
      window.toggleCanonicalLate(Number(el.dataset.member));
    }
  });

  console.info('[FI] Circuit unique des présences v228 actif.');
})();