/* Navigation calculée depuis les permissions effectives, y compris exceptions. */
function permissionForModule(module){if(isDirection())return true;const key='can_'+module;return roles.some(r=>ux.permissions.find(p=>p.role===r.role)?.[key])||ux.exceptions.some(e=>e.effect==='allow'&&e.module===module&&e.active&&!e.revoked_at&&(!e.ends_at||new Date(e.ends_at)>=new Date()))}
function deniedModule(module){return ux.exceptions.some(e=>e.effect==='deny'&&e.module===module&&e.active&&!e.revoked_at&&(!e.ends_at||new Date(e.ends_at)>=new Date()))}
const PAGE_MODULE={'Tableau de bord':'dashboard','Planning':'planning','FI & FIJ':'families','Membres':'members','Rencontres':'meetings','Programmes & événements':'programs','Reporting':'reporting','Carte':'map','Pilotage':'pilotage','Paramètres':'settings'};
allowedItems=function(){return items.filter(x=>{const m=PAGE_MODULE[x];return !deniedModule(m)&&permissionForModule(m)})};
