/* v6 — corrections anti-régression : auth, modèles incomplets, droits réels et menu mobile. */
function validTemplateVersionV6(v){return !!v&&v.weekday!==null&&v.weekday!==undefined&&v.start_time&&v.end_time}
const _activeVersionV6=activeVersion;activeVersion=function(t,date){const v=_activeVersionV6(t,date);return validTemplateVersionV6(v)?v:null}

function effectiveActionScopeV6(key,fid=null){if(isDirection())return'all';const f=fid?db.families.find(x=>+x.id===+fid):null;for(const r of roles){const s=actionPerms?.find(x=>x.role===r.role&&x.action_key===key)?.scope||'none';if(s==='all'||(s==='fi'&&(!f||f.family_type==='FI'))||(s==='fij'&&(!f||f.family_type==='FIJ'))||(s==='mine'&&fid&&+r.family_id===+fid))return s}return'none'}
function canActionV6(key,fid=null){return effectiveActionScopeV6(key,fid)!=='none'}
function pageAllowedV6(page){if(isDirection())return true;const map={
 'Tableau de bord':['dashboard.view'],'FI & FIJ':['fi.view','fij.view'],'Membres':['members.view'],'Rencontres':['meetings.fi.view','meetings.fij.view'],'Programmes & événements':['programs.view'],'Reporting':['reporting.fi.view','reporting.fij.view','reporting.fi.create','reporting.fij.create'],'Pilotage':['pilotage.fi.view','pilotage.fij.view'],'Paramètres':['settings.view']};
 const keys=map[page];if(keys&&keys.some(k=>canActionV6(k)))return true;return typeof permissionForModule==='function'&&PAGE_MODULE?.[page]?permissionForModule(PAGE_MODULE[page]):false}
allowedItems=function(){return items.filter(x=>!deniedModule(PAGE_MODULE[x])&&pageAllowedV6(x))}
const _goRightsV6=go;go=function(x){if(x!=='Accueil'&&!pageAllowedV6(x)){alert('Vous n’avez pas accès à ce module avec vos permissions actuelles.');return}return _goRightsV6(x)}

function secureClickableV6(action,fid,html,cls='card metric'){return canActionV6(action,fid)?`<div class="${cls} clickable" onclick="${html}">`:`<div class="${cls} permission-disabled" title="Accès non autorisé">`}
const _dashboardRightsV6=dashboard;dashboard=function(){let h=_dashboardRightsV6();if(!isDirection()){
 if(!canActionV6('fi.view'))h=h.replace(/onclick="familyTab='FI';go\('FI & FIJ'\)"/g,'title="Accès FI non autorisé"');
 if(!canActionV6('fij.view'))h=h.replace(/onclick="familyTab='FIJ';go\('FI & FIJ'\)"/g,'title="Accès FIJ non autorisé"');
 if(!canActionV6('members.view'))h=h.replace(/onclick="go\('Membres'\)"/g,'title="Accès Membres non autorisé"');
 }return h}

function forceAuthVisibilityV6(){const logged=!!session?.user;authGate.classList.toggle('hidden',logged);workspace.classList.toggle('hidden',!logged);document.body.classList.toggle('fi-authenticated',logged)}
const _bootVisibilityV6=boot;boot=async function(){const out=await _bootVisibilityV6();forceAuthVisibilityV6();setupMobileMenuV6();return out}
const _logoutVisibilityV6=logout;logout=async function(){document.body.classList.remove('fi-authenticated');return _logoutVisibilityV6()}
sb.auth.onAuthStateChange((_event,s)=>{session=s;setTimeout(forceAuthVisibilityV6,0)});

function setupMobileMenuV6(){if(!workspace||document.getElementById('fiMobileMenuBtn'))return;const btn=document.createElement('button');btn.id='fiMobileMenuBtn';btn.className='fi-mobile-menu-btn';btn.setAttribute('aria-label','Ouvrir le menu');btn.innerHTML='☰';btn.onclick=()=>document.body.classList.toggle('fi-mobile-nav-open');document.querySelector('main header')?.prepend(btn);const shade=document.createElement('div');shade.className='fi-mobile-nav-shade';shade.onclick=()=>document.body.classList.remove('fi-mobile-nav-open');workspace.appendChild(shade)}
const _navMobileV6=navMenu;navMenu=function(){_navMobileV6();nav?.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>document.body.classList.remove('fi-mobile-nav-open')))}
const _goMobileV6=go;go=function(x){const out=_goMobileV6(x);document.body.classList.remove('fi-mobile-nav-open');return out}
window.addEventListener('resize',()=>{if(innerWidth>820)document.body.classList.remove('fi-mobile-nav-open')});
