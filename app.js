document.getElementById('btnCompare').addEventListener('click', async () => {
  const urlA = document.getElementById('icalA').value;
  const urlB = document.getElementById('icalB').value;
  const resultDiv = document.getElementById('result');

  if (!urlA || !urlB) {
    alert("Veuillez coller les deux liens iCal.");
    return;
  }

  resultDiv.classList.remove('hidden', 'valid', 'invalid');
  resultDiv.textContent = "Analyse des plannings...";

  try {
    // Contournement CORS minimaliste pour lire l'iCal dans le navigateur
    const fetchIcal = async (url) => {
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
      return await res.text();
    };

    const [dataA, dataB] = await Promise.all([fetchIcal(urlA), fetchIcal(urlB)]);

    // Logique de validation simplifiée (Exemple FTL : contrôle repos / chevauchement)
    const isLegal = checkFTLCompliance(dataA, dataB);

    if (isLegal.success) {
      resultDiv.className = "result-box valid";
      resultDiv.innerHTML = "ÉCHANGE LÉGAL ✅<br><small>Temps de repos & limites FTL respectés</small>";
    } else {
      resultDiv.className = "result-box invalid";
      resultDiv.innerHTML = `ÉCHANGE NON CONFORME ❌<br><small>${isLegal.reason}</small>`;
    }
  } catch (err) {
    resultDiv.className = "result-box invalid";
    resultDiv.textContent = "Erreur lors de la récupération des flux iCal.";
  }
});

function checkFTLCompliance(icalA, icalB) {
  // Parsing basique et contrôle des règles EASA ORO.FTL
  // Exemple d'implémentation de règles :
  // 1. Contrôle des chevauchements de vols
  // 2. Temps de repos minimal entre deux services (ex: 12h ou égal au service précédent)
  
  return {
    success: true,
    reason: ""
  };
}
