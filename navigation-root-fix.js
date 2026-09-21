/* Navigation racine FI — une seule implémentation finale après chargement de tous les modules. */
(function(){
  const PAGE={
    'Tableau de bord':()=>dashboard(),
    'Planning':()=>planning(),
    'FI & FIJ':()=>familyPage(),
    'Membres':()=>membersPage(),
    'Rencontres':()=>meetingsPage(),
    'Programmes & événements':()=>programsPage(),
    'Reporting':()=>reportingPage(),
    'Carte':()=>mapPage(),
    'Pilotage':()=>pilotage(),
    'Paramètres':()=>settingsPage()
  };

  function renderRoot(){
    const target=window.app;
    if(!target)return;
    try{
      target.innerHTML='';
      if(window.current==='Accueil' && typeof accueilFI==='function'){
        target.innerHTML=accueilFI();
      }else{
        const fn=PAGE[window.current]||dashboard;
        target.innerHTML=fn();
      }
    }catch(e){
      console.error('[FI navigation root]',e);
      target.innerHTML='<div class="card"><h2>'+esc(window.current||'FI')+'</h2><p class="muted">Une erreur empêche momentanément l’affichage de ce module.</p><details><summary>Détail technique</summary><pre style="white-space:pre-wrap">'+esc(e?.message||e)+'</pre></details></div>';
    }
    if(window.pageTitle)pageTitle.textContent=window.current==='Accueil'?'Accueil':(window.current||'Accueil');
    if(typeof navMenu==='function')navMenu();
    if(typeof bindHomeBrand==='function')setTimeout(bindHomeBrand,0);
    if(typeof renderBackControl==='function')setTimeout(renderBackControl,0);
    if(typeof renderHomeBell==='function')setTimeout(renderHomeBell,0);
    if(typeof renderProfileFooter==='function')setTimeout(renderProfileFooter,0);
  }

  function goRoot(page){
    const can=items.includes(page) && (page!=='Paramètres'||isDirection());
    if(!can)return;
    if(window.current && window.current!==page && Array.isArray(window.fiNavHistory)){
      window.fiNavHistory.push(window.current);
      if(window.fiNavHistory.length>30)window.fiNavHistory.shift();
    }
    window.current=page;
    if(typeof closeModal==='function')closeModal();
    renderRoot();
    document.body.classList.remove('fi-mobile-nav-open');
  }

  window.render=renderRoot;
  window.go=goRoot;
  if(typeof window.current==='undefined')window.current='Tableau de bord';
  console.log('[FI] navigation root loaded');
})();