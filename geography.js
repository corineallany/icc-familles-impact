// Géographie détaillée Le Mans / métropole
const LE_MANS_AREAS={
'Centre / Cœur de ville':['République','Jacobins','Cité Plantagenêt','Préfecture','Mission','Éperon','Gambetta','Halles'],
'Gare / Centre sud':['Gare Nord','Gare Sud','Novaxis','Novaxud','Washington','Jean-Jaurès','Saint-Martin','Miroir','Gué-de-Maulny'],
'Est':['Bollée','Gazonfier','Yzeuville','Jaurès-Bollée','Jardin des Plantes'],
'Sablons / Est':['Sablons','Épau','Newton','Espal','Bords de l’Huisne'],
'Sud':['Pontlieue','Ronceray','Glonnières','Maroc','Pavoine','Bruyères','Vauguyon','Cité des Pins','Batignolles'],
'Nord-Est':['Heuzé','Saint-Georges','Maillets','Bellevue','Banjan','Fontenelles','Villaret','Madeleine'],
'Nord-Ouest':['Université','Ribay','Chasse-Royale','Épine','Hôpital','Saulnières','Gallière'],
'Ouest':['Pâtis Saint-Lazare','Riffaudières','Oasis','Ardriers'],
'Communes proches':['Allonnes','Arnage','Coulaines','Yvré-l’Évêque','Rouillon','La Chapelle-Saint-Aubin','Saint-Saturnin']};
const LE_MANS_GRANDS_SECTEURS=Object.keys(LE_MANS_AREAS);
function geoLabel(o){return [o.neighborhood,o.area].filter(Boolean).join(' · ')||'Localisation à préciser'}
function areaOptions(group){return `<option value="">Sous-quartier / secteur précis</option>`+(LE_MANS_AREAS[group]||[]).map(a=>`<option>${esc(a)}</option>`).join('')}
function syncGeoAreas(){if(window.fGrandSector&&window.fArea)fArea.innerHTML=areaOptions(fGrandSector.value)}
formFamily=function(type){modalForm(`Nouvelle ${type}`,`<input id="fName" placeholder="Nom"><input id="fHost" placeholder="Hôte"><input id="fAddress" placeholder="Adresse exacte"><select id="fGrandSector" onchange="syncGeoAreas()"><option value="">Grand secteur / quartier</option>${LE_MANS_GRANDS_SECTEURS.map(s=>`<option>${esc(s)}</option>`).join('')}</select><select id="fArea"><option value="">Sous-quartier / secteur précis</option></select><small class="muted">Exemple : Gare / Centre sud → Jean-Jaurès ou Saint-Martin. L’adresse exacte reste prioritaire pour la carte et les suggestions de FI proches.</small>`,async()=>{const {error}=await sb.from('families').insert({name:fName.value.trim(),family_type:type,host_name:fHost.value.trim()||null,address:fAddress.value.trim()||null,neighborhood:fGrandSector.value||null,area:fArea.value||null,status:'Active'});if(error)throw error})};
const _geoOpenFamily=openFamily;
openFamily=function(id){_geoOpenFamily(id);const f=db.families.find(x=>x.id===id),card=modal.querySelector('.modal-card');if(!f||!card)return;const h=card.querySelector('h2');if(h)h.insertAdjacentHTML('afterend',`<p class="muted"><b>Localisation :</b> ${esc(geoLabel(f))}${f.address?`<br>${esc(f.address)}`:''}</p>`)};
const _geoFormMemberMove=formMemberMove;
formMemberMove=function(memberId,forcedType=''){_geoFormMemberMove(memberId,forcedType);setTimeout(()=>{if(!window.mvTo)return;[...mvTo.options].forEach(o=>{const f=db.families.find(x=>x.id===+o.value);if(f)o.textContent=`${f.name} · ${geoLabel(f)}`})},0)};