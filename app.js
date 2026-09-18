document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnCompare');
  
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const fileInputA = document.getElementById('fileA');
    const fileInputB = document.getElementById('fileB');
    const resultDiv = document.getElementById('result');

    resultDiv.classList.remove('hidden', 'valid', 'invalid');

    if (!fileInputA.files[0] || !fileInputB.files[0]) {
      resultDiv.className = "result-box invalid";
      resultDiv.textContent = "Veuillez sélectionner les deux fichiers .ics.";
      return;
    }

    try {
      const readFile = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.onerror = () => reject(new Error("Erreur de lecture : " + file.name));
        reader.readAsText(file);
      });

      const [contentA, contentB] = await Promise.all([
        readFile(fileInputA.files[0]),
        readFile(fileInputB.files[0])
      ]);

      const eventsA = parseICS(contentA);
      const eventsB = parseICS(contentB);

      // Trouver toutes les opportunités de swap par date
      const swapOpportunities = findSwapDays(eventsA, eventsB);

      if (swapOpportunities.length === 0) {
        resultDiv.className = "result-box invalid";
        resultDiv.innerHTML = "AUCUN SWAP FACILE TROUVÉ ❌<br><small>Pas de journées travail/OFF croisées identifiées.</small>";
      } else {
        resultDiv.className = "result-box valid";
        let html = `<strong>${swapOpportunities.length} JOURS SWAPPABLES DÉTECTÉS ✅</strong><br><br>`;
        html += `<ul style="text-align: left; margin: 0; padding-left: 1rem; font-size: 0.9rem;">`;
        
        swapOpportunities.forEach(opp => {
          html += `<li style="margin-bottom: 0.4rem;"><strong>${opp.date}</strong> : ${opp.detail}</li>`;
        });
        
        html += `</ul>`;
        resultDiv.innerHTML = html;
      }

    } catch (err) {
      resultDiv.className = "result-box invalid";
      resultDiv.textContent = `Erreur : ${err.message}`;
    }
  });
});

function parseICS(icsText) {
  const events = [];
  const blocks = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const startMatch = block.match(/DTSTART[^:]*:(\d{8}(?:T\d{6}Z?)?)/);
    const endMatch = block.match(/DTEND[^:]*:(\d{8}(?:T\d{6}Z?)?)/);
    const summaryMatch = block.match(/SUMMARY:(.*)/);

    if (startMatch && endMatch) {
      const start = parseICSDate(startMatch[1]);
      const end = parseICSDate(endMatch[1]);
      const summary = summaryMatch ? summaryMatch[1].trim().replace(/\r/g, '') : 'Activité';

      // Filtrer les événements valides (exclure les tâches d'arrière-plan d'une journée entière si besoin)
      events.push({ start, end, summary, dateStr: start.toISOString().split('T')[0] });
    }
  }
  return events;
}

function parseICSDate(str) {
  const y = parseInt(str.substring(0, 4), 10);
  const m = parseInt(str.substring(4, 6), 10) - 1;
  const d = parseInt(str.substring(6, 8), 10);
  
  if (str.includes('T')) {
    const h = parseInt(str.substring(9, 11) || '0', 10);
    const min = parseInt(str.substring(11, 13) || '0', 10);
    const s = parseInt(str.substring(13, 15) || '0', 10);
    return new Date(Date.UTC(y, m, d, h, min, s));
  }
  return new Date(Date.UTC(y, m, d, 0, 0, 0));
}

function findSwapDays(eventsA, eventsB) {
  // Indexer les activités par jour (YYYY-MM-DD)
  const mapA = {};
  const mapB = {};

  eventsA.forEach(e => { mapA[e.dateStr] = e; });
  eventsB.forEach(e => { mapB[e.dateStr] = e; });

  // Récupérer l'ensemble de toutes les dates présentes dans les 2 plannings
  const allDates = Array.from(new Set([...Object.keys(mapA), ...Object.keys(mapB)])).sort();
  const opportunities = [];

  allDates.forEach(date => {
    const actA = mapA[date];
    const actB = mapB[date];

    // Cas 1 : Pilote A travaille, Pilote B est libre (pas d'activité enregistrée ce jour)
    if (actA && !actB) {
      opportunities.push({
        date: formatDateFr(date),
        detail: `Tu as <strong>${actA.summary}</strong> / Collègue est OFF`
      });
    }
    // Cas 2 : Pilote B travaille, Pilote A est libre
    else if (!actA && actB) {
      opportunities.push({
        date: formatDateFr(date),
        detail: `Tu es OFF / Collègue a <strong>${actB.summary}</strong>`
      });
    }
  });

  return opportunities;
}

function formatDateFr(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
