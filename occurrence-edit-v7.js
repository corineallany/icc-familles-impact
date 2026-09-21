/* v7 — occurrence modification désactivée.
   Les occurrences hebdomadaires sont globales : aucune FI ne peut modifier
   individuellement une occurrence depuis son espace. Les fiches passent par
   le circuit canonique des fiches d'activité. */
(function(){
  'use strict';
  window.editOccurrenceV7=function(){ return alert('Les occurrences hebdomadaires sont globales. Elles ne sont pas modifiables individuellement par FI.'); };
  window.editMeetingOccurrenceV7=function(){ return alert('Les occurrences hebdomadaires sont globales. Elles ne sont pas modifiables individuellement par FI.'); };
})();
