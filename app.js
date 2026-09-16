const SUPABASE_URL='https://uaxjqsocbegjappkjscs.supabase.co';
const SUPABASE_KEY='sb_publishable_lS_d8jGZc9ioVDVy_NYHfA_MCnDGmY-';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const ROLE_LABELS={
  pasteur:'Pasteur',
  super_admin:'Super Admin',
  responsable_fi:'Responsable FI',
  responsable_fij:'Responsable FIJ',
  coordinateur_fi:'Coordinateur FI',
  coordinateur_fij:'Coordinateur FIJ',
  pilote:'Pilote',
  copilote:'Copilote'
};

const items=[
  'Tableau de bord',
  'FI & FIJ',
  'Membres',
  'Rencontres',
  'Programmes & événements',
  'Reporting',
  'Carte',
  'Pilotage',
  'Administration'
];

const icons=['▦','⌂','♙','◷','▣','✓','⌖','⌁','⚙'];

let current='Tableau de bord';
let session=null;
let profile=null;
let roles=[];
let cachedAllRoles=[];
let realtimeChannel=null;

let db={
  families:[],
  members:[],
  assignments:[],
  meetings:[],
  programs:[],
  reports:[],
  followups:[]
};

/* =========================================================
   AUTHENTIFICATION
========================================================= */

function showAuth(mode,btn){
  document.querySelectorAll('.auth-tabs button')
    .forEach(x=>x.classList.remove('active'));

  if(btn) btn.classList.add('active');

  const f=document.getElementById('authForm');

  if(mode==='login'){
    f.innerHTML=`
      <div class="form-stack">
        <input id="loginEmail" type="email" placeholder="Adresse e-mail">
        <input id="loginPassword" type="password" placeholder="Mot de passe">

        <button class="primary" onclick="login()">
          Se connecter
        </button>

        <button class="link-btn" onclick="showAuth('forgot')">
          Mot de passe oublié ?
        </button>
      </div>
    `;
  }

  if(mode==='signup'){
    f.innerHTML=`
      <div class="form-stack">
        <input id="signupName" placeholder="Prénom et nom">
        <input id="signupEmail" type="email" placeholder="Adresse e-mail">
        <input id="signupPassword" type="password" placeholder="Mot de passe">

        <button class="primary" onclick="signup()">
          Créer mon compte
        </button>

        <p class="muted">
          Après la création du compte, confirmez simplement votre adresse
          e-mail. Aucune validation supplémentaire d'un administrateur
          n'est nécessaire. Vos droits dépendent automatiquement de votre
          fiche membre et de vos responsabilités FI/FIJ.
        </p>
      </div>
    `;
  }

  if(mode==='forgot'){
    f.innerHTML=`
      <div class="form-stack">
        <h3>Réinitialiser le mot de passe</h3>

        <input id="forgotEmail"
               type="email"
               placeholder="Adresse e-mail">

        <button class="primary" onclick="forgot()">
          Envoyer le lien de réinitialisation
        </button>

        <button class="link-btn" onclick="showAuth('login')">
          Retour à la connexion
        </button>
      </div>
    `;
  }
}

async function signup(){
  const email=signupEmail.value.trim().toLowerCase();
  const password=signupPassword.value;
  const name=signupName.value.trim();

  if(!email || !password){
    return alert('Renseignez votre e-mail et un mot de passe.');
  }

  const {data,error}=await sb.auth.signUp({
    email,
    password,
    options:{
      data:{
        full_name:name
      },
      emailRedirectTo:location.origin+location.pathname
    }
  });

  if(error){
    return alert('Création du compte impossible : '+error.message);
  }

  if(data.session){
    alert('Compte créé et connecté.');
    await boot();
  }else{
    alert(
      'Compte créé. Consultez votre e-mail et cliquez sur le lien de confirmation, puis revenez vous connecter.'
    );
    showAuth('login');
  }
}

async function login(){
  const email=loginEmail.value.trim().toLowerCase();
  const password=loginPassword.value;

  if(!email || !password){
    return alert('Renseignez votre e-mail et votre mot de passe.');
  }

  const {error}=await sb.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    const message=(error.message||'').toLowerCase();

    if(message.includes('email not confirmed')){
      return alert(
        'Confirmez d’abord votre adresse e-mail avec le message envoyé par FI — ICC Le Mans.'
      );
    }

    return alert('Connexion impossible : '+error.message);
  }

  await boot();
}

async function forgot(){
  const email=forgotEmail.value.trim().toLowerCase();

  if(!email){
    return alert('Renseignez votre adresse e-mail.');
  }

  const {error}=await sb.auth.resetPasswordForEmail(
    email,
    {
      redirectTo:location.origin+location.pathname
    }
  );

  if(error){
    return alert(
      'Impossible d’envoyer le lien : '+error.message
    );
  }

  alert(
    'Le lien de réinitialisation vient d’être envoyé par e-mail.'
  );

  showAuth('login');
}

async function logout(){
  await sb.auth.signOut();

  session=null;
  profile=null;
  roles=[];
  cachedAllRoles=[];

  if(realtimeChannel){
    await sb.removeChannel(realtimeChannel);
    realtimeChannel=null;
  }

  authGate.classList.remove('hidden');
  workspace.classList.add('hidden');

  showAuth('login');
}

/* =========================================================
   UTILISATEUR & DROITS
========================================================= */

function me(){
  if(!session?.user){
    return null;
  }

  const member=profile?.member||{};

  const name=
    [member.first_name,member.last_name]
      .filter(Boolean)
      .join(' ')
    ||
    session.user.user_metadata?.full_name
    ||
    session.user.email;

  return {
    email:session.user.email,
    name,
    role:ROLE_LABELS[roles[0]?.role]||'Accès FI'
  };
}

function isDirection(){
  return roles.some(
    r=>['pasteur','super_admin'].includes(r.role)
  );
}

function isGlobal(){
  return roles.some(
    r=>[
      'pasteur',
      'super_admin',
      'responsable_fi',
      'responsable_fij',
      'coordinateur_fi',
      'coordinateur_fij'
    ].includes(r.role)
  );
}

function allowedItems(){
  if(isDirection()){
    return items;
  }

  return items.filter(
    x=>x!=='Administration'
  );
}

/* =========================================================
   CHARGEMENT DU PROFIL
========================================================= */

async function loadProfile(){

  const {data:p,error}=await sb
    .from('app_profiles')
    .select('user_id,member_id')
    .eq('user_id',session.user.id)
    .maybeSingle();

  if(error){
    throw error;
  }

  if(!p){
    throw new Error(
      'Cette adresse e-mail confirmée n’est pas associée à une responsabilité FI/FIJ autorisée.'
    );
  }

  const [
    {data:m,error:memberError},
    {data:r,error:roleError}
  ]=await Promise.all([

    sb
      .from('members')
      .select('*')
      .eq('id',p.member_id)
      .single(),

    sb
      .from('role_assignments')
      .select('*')
      .eq('member_id',p.member_id)
      .eq('active',true)

  ]);

  if(memberError){
    throw memberError;
  }

  if(roleError){
    throw roleError;
  }

  profile={
    ...p,
    member:m
  };

  roles=r||[];

  if(!roles.length){
    throw new Error(
      'Aucune responsabilité FI/FIJ active n’est associée à ce compte.'
    );
  }
}

/* =========================================================
   DONNÉES SUPABASE
========================================================= */

async function loadData(){

  const queries=await Promise.all([

    sb
      .from('families')
      .select('*')
      .order('name'),

    sb
      .from('members')
      .select('*')
      .order('last_name'),

    sb
      .from('member_assignments')
      .select('*'),

    sb
      .from('meetings')
      .select('*')
      .order('scheduled_date',{ascending:false}),

    sb
      .from('programs')
      .select('*')
      .order('scheduled_date',{ascending:false}),

    sb
      .from('reporting')
      .select('*'),

    sb
      .from('followups')
      .select('*')
      .order('created_at',{ascending:false})

  ]);

  const firstError=
    queries.find(q=>q.error)?.error;

  if(firstError){
    throw firstError;
  }

  [
    db.families,
    db.members,
    db.assignments,
    db.meetings,
    db.programs,
    db.reports,
    db.followups
  ]=queries.map(q=>q.data||[]);
}

/* =========================================================
   DÉMARRAGE
========================================================= */

async function boot(){

  const {
    data:{session:s}
  }=await sb.auth.getSession();

  session=s;

  if(!session){

    authGate.classList.remove('hidden');
    workspace.classList.add('hidden');

    showAuth('login');

    return;
  }

  try{

    await loadProfile();
    await loadData();
    await refreshRolesAll();

    authGate.classList.add('hidden');
    workspace.classList.remove('hidden');

    const u=me();

    userName.textContent=u.name;
    userRole.textContent=u.role;
    avatar.textContent=u.name[0].toUpperCase();

    navMenu();
    render();
    subscribeRealtime();

  }catch(e){

    console.error(e);

    await sb.auth.signOut();

    session=null;

    authGate.classList.remove('hidden');
    workspace.classList.add('hidden');

    showAuth('login');

    alert(
      e.message||
      'Accès FI impossible.'
    );
  }
}

/* =========================================================
   TEMPS RÉEL
========================================================= */

function subscribeRealtime(){

  if(realtimeChannel){
    return;
  }

  realtimeChannel=
    sb.channel('fi-live');

  [
    'families',
    'members',
    'member_assignments',
    'meetings',
    'programs',
    'reporting',
    'followups'
  ].forEach(table=>{

    realtimeChannel.on(
      'postgres_changes',
      {
        event:'*',
        schema:'public',
        table
      },
      async()=>{

        try{

          await loadData();
          await refreshRolesAll();

          render();

        }catch(e){
          console.error(e);
        }

      }
    );

  });

  realtimeChannel.subscribe();
}

/* =========================================================
   NAVIGATION
========================================================= */

function navMenu(){

  document.getElementById('nav').innerHTML=
    allowedItems()
      .map(x=>{

        const i=items.indexOf(x);

        return `
          <button
            class="${x===current?'active':''}"
            onclick="go('${x}')">

            ${icons[i]} &nbsp;
            <span>${x}</span>

          </button>
        `;

      })
      .join('');
}

function go(x){

  if(!allowedItems().includes(x)){
    x='Tableau de bord';
  }

  current=x;

  pageTitle.textContent=x;

  navMenu();
  render();
  closeModal();
}

/* =========================================================
   OUTILS
========================================================= */

function esc(v=''){

  return String(v??'')
    .replace(
      /[&<>"']/g,
      c=>({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[c])
    );
}

function famOpts(){

  return `
    <option value="">
      Sans FI/FIJ
    </option>
  `+
  db.families
    .map(
      x=>`
        <option value="${x.id}">
          ${x.family_type||'FI'} · ${esc(x.name)}
        </option>
      `
    )
    .join('');
}

function familyName(id){

  return db.families.find(
    f=>String(f.id)===String(id)
  )?.name||'Sans FI/FIJ';
}

function activeAssignment(memberId){

  return db.assignments.find(
    a=>
      String(a.member_id)===String(memberId)
      &&
      !a.ends_at
  );
}

function memberById(id){

  return db.members.find(
    m=>String(m.id)===String(id)
  );
}

async function refreshRolesAll(){

  if(!isDirection()){

    cachedAllRoles=roles;

    return;
  }

  const {data,error}=await sb
    .from('role_assignments')
    .select('*')
    .eq('active',true);

  if(error){
    console.error(error);
    return;
  }

  cachedAllRoles=data||[];
}

/* =========================================================
   TABLEAU DE BORD
========================================================= */

function dashboard(){

  const activeFamilies=
    db.families.filter(
      x=>['Active','active'].includes(x.status)
    ).length;

  const unattached=
    db.members.filter(
      x=>!activeAssignment(x.id)
    ).length;

  const reportsTodo=
    db.reports.filter(
      x=>x.status!=='Validé'
    ).length;

  const followupsTodo=
    db.followups.filter(
      x=>x.status!=='Terminé'
    ).length;

  return `

    <div class="grid">

      <div class="card metric">
        <span>Familles actives</span>
        <strong>${activeFamilies}</strong>
        <small>FI & FIJ</small>
      </div>

      <div class="card metric">
        <span>Membres</span>
        <strong>${db.members.length}</strong>
        <small>${unattached} sans rattachement</small>
      </div>

      <div class="card metric">
        <span>Rencontres</span>
        <strong>${db.meetings.length}</strong>
        <small>Données Supabase</small>
      </div>

      <div class="card metric">
        <span>Reporting à traiter</span>
        <strong>${reportsTodo}</strong>
        <small>${followupsTodo} suivi(s)</small>
      </div>

    </div>

    <div class="section-grid">

      <div class="card">

        <h2>Prochaines rencontres</h2>

        ${
          db.meetings
            .slice(0,6)
            .map(x=>`

              <div class="meeting">

                <div>

                  <b>${esc(x.title)}</b>

                  <div class="muted">
                    ${esc(x.scheduled_date||'')}
                    ${x.theme?' · '+esc(x.theme):''}
                  </div>

                </div>

                <span class="pill">
                  ${esc(x.meeting_kind)}
                </span>

              </div>

            `)
            .join('')
          ||
          '<div class="empty">Aucune rencontre programmée</div>'
        }

      </div>

      <div class="card">

        <h2>Centre d’alertes</h2>

        <div class="alert">
          <span>Reportings en brouillon</span>
          <b>${reportsTodo}</b>
        </div>

        <div class="alert">
          <span>Membres sans FI/FIJ</span>
          <b>${unattached}</b>
        </div>

      </div>

    </div>
  `;
}

/* =========================================================
   MODALES
========================================================= */

function modalForm(title,fields,saveFn){

  modal.innerHTML=`

    <div class="modal-card">

      <button
        class="close"
        onclick="closeModal()">
        ×
      </button>

      <h2>${title}</h2>

      <div class="form-stack">

        ${fields}

        <button
          class="primary"
          id="modalSave">
          Enregistrer
        </button>

      </div>

    </div>
  `;

  modal.classList.remove('hidden');

  document.getElementById('modalSave').onclick=
    async()=>{

      const button=
        document.getElementById('modalSave');

      button.disabled=true;

      try{

        await saveFn();

        closeModal();

        await loadData();
        await refreshRolesAll();

        render();

      }catch(e){

        console.error(e);

        alert(
          e.message||
          'Enregistrement impossible.'
        );

      }finally{

        button.disabled=false;

      }
    };
}

/* =========================================================
   CRÉER UNE FI / FIJ
========================================================= */

function formFamily(){

  modalForm(

    'Nouvelle FI / FIJ',

    `

      <select id="fType">
        <option>FI</option>
        <option>FIJ</option>
      </select>

      <input
        id="fName"
        placeholder="Nom de la famille">

      <input
        id="fHost"
        placeholder="Hôte">

      <input
        id="fAddress"
        placeholder="Adresse complète">

      <input
        id="fNeighborhood"
        placeholder="Quartier">

      <select id="fDay">
        <option>Lundi</option>
        <option>Mardi</option>
        <option>Mercredi</option>
        <option>Jeudi</option>
        <option>Vendredi</option>
        <option>Samedi</option>
        <option>Dimanche</option>
      </select>

      <input
        id="fTime"
        type="time">

      <input
        id="fEnd"
        type="time">

      <select id="fStatus">
        <option>Active</option>
        <option>Temporairement indisponible</option>
        <option>Suspendue</option>
        <option>Fermée</option>
      </select>

    `,

    async()=>{

      if(!fName.value.trim()){
        throw Error(
          'Renseignez le nom de la FI/FIJ.'
        );
      }

      const {error}=await sb
        .from('families')
        .insert({

          family_type:fType.value,

          name:fName.value.trim(),

          host_name:
            fHost.value.trim()||null,

          address:
            fAddress.value.trim()||null,

          neighborhood:
            fNeighborhood.value.trim()||null,

          regular_day:
            fDay.value,

          regular_start:
            fTime.value||null,

          regular_end:
            fEnd.value||null,

          status:
            fStatus.value

        });

      if(error){
        throw error;
      }
    }
  );
}

/* =========================================================
   CRÉER UN MEMBRE
========================================================= */

function formMember(){

  modalForm(

    'Nouveau membre',

    `

      <input
        id="mFirst"
        placeholder="Prénom">

      <input
        id="mLast"
        placeholder="Nom">

      <input
        id="mEmail"
        type="email"
        placeholder="Adresse e-mail">

      <input
        id="mPhone"
        placeholder="Téléphone">

      <input
        id="mAddress"
        placeholder="Adresse complète">

      <select id="mFamily">
        ${famOpts()}
      </select>

    `,

    async()=>{

      if(
        !mFirst.value.trim()
        ||
        !mLast.value.trim()
      ){
        throw Error(
          'Renseignez le prénom et le nom.'
        );
      }

      const {data,error}=await sb
        .from('members')
        .insert({

          first_name:
            mFirst.value.trim(),

          last_name:
            mLast.value.trim(),

          email:
            mEmail.value
              .trim()
              .toLowerCase()
            ||null,

          phone:
            mPhone.value.trim()
            ||null,

          address:
            mAddress.value.trim()
            ||null,

          active:true

        })
        .select('id')
        .single();

      if(error){
        throw error;
      }

      if(mFamily.value){

        const {error:aerr}=await sb
          .from('member_assignments')
          .insert({

            member_id:data.id,

            family_id:
              Number(mFamily.value),

            assignment_type:'home',

            starts_at:
              new Date()
                .toISOString()
                .slice(0,10)

          });

        if(aerr){
          throw aerr;
        }
      }
    }
  );
}

/* =========================================================
   CRÉER UNE RENCONTRE
========================================================= */

function formMeeting(){

  modalForm(

    'Programmer une rencontre',

    `

      <input
        id="rTitle"
        placeholder="Titre">

      <select id="rKind">

        <option>
          Rencontre FI/FIJ
        </option>

        <option>
          Temps de prière
        </option>

        <option>
          Rencontre commune
        </option>

        <option>
          Rencontre exceptionnelle
        </option>

      </select>

      <select id="rFamily">
        ${famOpts()}
      </select>

      <input
        id="rDate"
        type="date">

      <input
        id="rTime"
        type="time">

      <input
        id="rTheme"
        placeholder="Thème">

    `,

    async()=>{

      if(
        !rTitle.value.trim()
        ||
        !rDate.value
      ){
        throw Error(
          'Renseignez le titre et la date.'
        );
      }

      let plannedStart=null;

      if(rTime.value){

        plannedStart=
          new Date(
            `${rDate.value}T${rTime.value}:00`
          ).toISOString();

      }

      const {error}=await sb
        .from('meetings')
        .insert({

          title:
            rTitle.value.trim(),

          meeting_kind:
            rKind.value,

          family_id:
            rFamily.value
              ?Number(rFamily.value)
              :null,

          scheduled_date:
            rDate.value,

          planned_start:
            plannedStart,

          theme:
            rTheme.value.trim()
            ||null

        });

      if(error){
        throw error;
      }
    }
  );
}

/* =========================================================
   PROGRAMMES & ÉVÉNEMENTS
========================================================= */

function formProgram(){

  modalForm(

    'Nouveau programme / événement',

    `

      <input
        id="pTitle"
        placeholder="Titre">

      <select id="pKind">
        <option>Programme spécial</option>
        <option>Rencontre commune</option>
        <option>Temps de prière</option>
        <option>Événement</option>
      </select>

      <input
        id="pDate"
        type="date">

      <textarea
        id="pNotes"
        placeholder="Notes">
      </textarea>

    `,

    async()=>{

      if(!pTitle.value.trim()){
        throw Error(
          'Renseignez le titre.'
        );
      }

      const {error}=await sb
        .from('programs')
        .insert({

          title:
            pTitle.value.trim(),

          kind:
            pKind.value,

          scheduled_date:
            pDate.value||null,

          notes:
            pNotes.value.trim()
            ||null

        });

      if(error){
        throw error;
      }
    }
  );
}

/* =========================================================
   REPORTING
========================================================= */

function formReport(){

  modalForm(

    'Nouveau reporting',

    `

      <select id="qMeeting">

        ${
          db.meetings
            .map(
              x=>`
                <option value="${x.id}">
                  ${esc(x.title)}
                  —
                  ${esc(x.scheduled_date)}
                </option>
              `
            )
            .join('')
        }

      </select>

      <select id="qAtmos">
        <option>Excellente</option>
        <option>Bonne</option>
        <option>Correcte</option>
        <option>Mitigée</option>
        <option>Difficile</option>
      </select>

      <select id="qUnderstand">
        <option>Très bonne compréhension</option>
        <option>Bonne compréhension</option>
        <option>Compréhension moyenne</option>
        <option>Difficile</option>
      </select>

      <textarea
        id="qNotes"
        placeholder="Témoignages, suivis, notes…">
      </textarea>

      <select id="qStatus">
        <option>Brouillon</option>
        <option>Validé</option>
      </select>

    `,

    async()=>{

      if(!qMeeting.value){
        throw Error(
          'Créez d’abord une rencontre.'
        );
      }

      const {error}=await sb
        .from('reporting')
        .insert({

          meeting_id:
            Number(qMeeting.value),

          atmosphere:
            qAtmos.value,

          understanding:
            qUnderstand.value,

          notes:
            qNotes.value.trim()
            ||null,

          status:
            qStatus.value

        });

      if(error){
        throw error;
      }
    }
  );
}

/* =========================================================
   COMPOSANT PAGE
========================================================= */

function modulePage(
  title,
  desc,
  action,
  content
){

  return `

    <div class="card page-card">

      <div class="toolbar">

        <div>

          <h2>${title}</h2>

          <p class="muted">
            ${desc}
          </p>

        </div>

        ${
          action
            ?`
              <button
                class="primary"
                onclick="${action}">
                ＋ Ajouter
              </button>
            `
            :''
        }

      </div>

      ${
        content
        ||
        '<div class="empty">Aucune donnée pour le moment</div>'
      }

    </div>
  `;
}

/* =========================================================
   FI & FIJ
========================================================= */

function families(){

  return modulePage(

    'FI & FIJ',

    'Données centrales synchronisées entre tous les appareils.',

    isGlobal()
      ?'formFamily()'
      :'',

    db.families
      .map(
        x=>`

          <div class="family-row">

            <div>

              <span
                class="pill ${(x.family_type||'fi').toLowerCase()}">

                ${esc(x.family_type||'FI')}

              </span>

              <b>
                ${esc(x.name)}
              </b>

              <div class="muted">

                ${esc(x.regular_day||'—')}

                ${esc(
                  x.regular_start
                    ?.slice(0,5)
                  ||''
                )}

                ·

                ${esc(
                  x.address
                  ||
                  x.neighborhood
                  ||
                  'Adresse non renseignée'
                )}

                <br>

                Hôte :
                ${esc(x.host_name||'—')}

              </div>

            </div>

            <span class="pill">
              ${esc(x.status||'Active')}
            </span>

          </div>

        `
      )
      .join('')
  );
}

/* =========================================================
   MEMBRES
========================================================= */

function members(){

  return modulePage(

    'Membres',

    'Annuaire central Supabase. Les comptes de connexion restent distincts des fiches membres.',

    isGlobal()
      ?'formMember()'
      :'',

    db.members
      .map(
        x=>{

          const assignment=
            activeAssignment(x.id);

          return `

            <div class="family-row">

              <div>

                <b>
                  ${esc(x.first_name)}
                  ${esc(x.last_name)}
                </b>

                <div class="muted">

                  ${
                    esc(
                      x.email
                      ||
                      'E-mail non renseigné'
                    )
                  }

                  ·

                  ${
                    esc(
                      x.phone
                      ||
                      'Sans téléphone'
                    )
                  }

                  <br>

                  ${esc(x.address||'')}

                </div>

              </div>

              <span class="pill">

                ${
                  esc(
                    assignment
                      ?familyName(
                          assignment.family_id
                        )
                      :'Sans FI/FIJ'
                  )
                }

              </span>

            </div>
          `;
        }
      )
      .join('')
  );
}

/* =========================================================
   RENCONTRES
========================================================= */

function meetings(){

  return modulePage(

    'Rencontres',

    'Rencontres enregistrées dans Supabase.',

    'formMeeting()',

    db.meetings
      .map(
        x=>`

          <div class="family-row">

            <div>

              <b>
                ${esc(x.title)}
              </b>

              <div class="muted">

                ${esc(x.scheduled_date)}

                ·

                ${esc(x.theme||'')}

              </div>

            </div>

            <span class="pill">
              ${esc(x.meeting_kind)}
            </span>

          </div>

        `
      )
      .join('')
  );
}

/* =========================================================
   PROGRAMMES
========================================================= */

function programs(){

  return modulePage(

    'Programmes & événements',

    'Activités particulières et rencontres communes.',

    isGlobal()
      ?'formProgram()'
      :'',

    db.programs
      .map(
        x=>`

          <div class="family-row">

            <div>

              <b>
                ${esc(x.title)}
              </b>

              <div class="muted">

                ${esc(x.scheduled_date||'')}

                ·

                ${esc(x.kind||'')}

              </div>

            </div>

          </div>

        `
      )
      .join('')
  );
}

/* =========================================================
   REPORTING
========================================================= */

function reporting(){

  return modulePage(

    'Reporting',

    'Les pilotes et copilotes agissent uniquement sur leur périmètre autorisé.',

    'formReport()',

    db.reports
      .map(
        x=>{

          const meeting=
            db.meetings.find(
              y=>
                String(y.id)
                ===
                String(x.meeting_id)
            );

          return `

            <div class="family-row">

              <div>

                <b>
                  ${
                    esc(
                      meeting?.title
                      ||
                      'Rencontre'
                    )
                  }
                </b>

                <div class="muted">

                  ${esc(x.atmosphere||'')}

                  ·

                  ${esc(x.understanding||'')}

                </div>

              </div>

              <span class="pill">
                ${esc(x.status||'Brouillon')}
              </span>

            </div>

          `;
        }
      )
      .join('')
  );
}

/* =========================================================
   CARTE
========================================================= */

function mapPage(){

  return `

    <div class="card page-card">

      <h2>
        Trouver une FI / FIJ
      </h2>

      <div class="map-search">

        <input
          placeholder="Adresse ou quartier">

        <select>
          <option>FI & FIJ</option>
          <option>FI</option>
          <option>FIJ</option>
        </select>

        <button class="primary">
          Rechercher
        </button>

      </div>

      <div class="map-canvas">

        <div class="map-watermark">
          LE MANS & ENVIRONS
        </div>

      </div>

    </div>
  `;
}

/* =========================================================
   PILOTAGE
========================================================= */

function pilotage(){

  return `

    <div class="grid">

      <div class="card metric">
        <span>FI/FIJ</span>
        <strong>${db.families.length}</strong>
      </div>

      <div class="card metric">
        <span>Membres</span>
        <strong>${db.members.length}</strong>
      </div>

      <div class="card metric">
        <span>Rencontres</span>
        <strong>${db.meetings.length}</strong>
      </div>

      <div class="card metric">
        <span>Reporting</span>
        <strong>${db.reports.length}</strong>
      </div>

    </div>
  `;
}

/* =========================================================
   ADMINISTRATION
========================================================= */

function admin(){

  const u=me();

  return `

    <div class="card">

      <h2>
        Administration
      </h2>

      <p class="muted">

        L'accès n'est plus approuvé compte par compte.

        Une adresse e-mail confirmée est automatiquement reliée
        à sa fiche membre lorsqu'une responsabilité autorisée existe.

      </p>

      <div class="family-row">

        <div>

          <b>
            ${esc(u.name)}
          </b>

          <div class="muted">
            ${esc(u.email)}
          </div>

        </div>

        <span class="pill">
          ${esc(u.role)}
        </span>

      </div>

    </div>
  `;
}

/* =========================================================
   AFFICHAGE
========================================================= */

function render(){

  const fn={

    'Tableau de bord':
      dashboard,

    'FI & FIJ':
      families,

    'Membres':
      members,

    'Rencontres':
      meetings,

    'Programmes & événements':
      programs,

    'Reporting':
      reporting,

    'Carte':
      mapPage,

    'Pilotage':
      pilotage,

    'Administration':
      admin

  }[current];

  app.innerHTML=fn();
}

/* =========================================================
   ACTION RAPIDE
========================================================= */

function openQuick(){

  modal.innerHTML=`

    <div class="modal-card">

      <button
        class="close"
        onclick="closeModal()">
        ×
      </button>

      <h2>
        Nouvelle action
      </h2>

      <div class="action-grid">

        <button onclick="formMeeting()">
          Rencontre
        </button>

        <button onclick="formMember()">
          Membre
        </button>

        <button onclick="formFamily()">
          FI/FIJ
        </button>

        <button onclick="formReport()">
          Reporting
        </button>

      </div>

    </div>
  `;

  modal.classList.remove('hidden');
}

function closeModal(){
  modal.classList.add('hidden');
}

/* =========================================================
   SURVEILLANCE AUTH
========================================================= */

sb.auth.onAuthStateChange(
  async(event,s)=>{

    session=s;

    if(event==='SIGNED_OUT'){

      authGate.classList.remove('hidden');
      workspace.classList.add('hidden');

    }

    else if(
      event==='SIGNED_IN'
      &&
      s
    ){

      setTimeout(
        ()=>boot(),
        0
      );

    }
  }
);

/* =========================================================
   LANCEMENT
========================================================= */

showAuth('login');

boot()
  .then(refreshRolesAll)
  .catch(console.error);
