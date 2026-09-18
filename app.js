document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnCompare');
  
  if (!btn) {
    console.error("Bouton #btnCompare introuvable.");
    return;
  }

  btn.addEventListener('click', async (e) => {
    e.preventDefault(); // Empêche tout rechargement de page
    
    const fileInputA = document.getElementById('fileA');
    const fileInputB = document.getElementById('fileB');
    const resultDiv = document.getElementById('result');

    resultDiv.classList.remove('hidden', 'valid', 'invalid');

    if (!fileInputA.files[0] || !fileInputB.files[0]) {
      resultDiv.className = "result-box invalid";
      resultDiv.textContent = "Veuillez sélectionner les deux fichiers .ics avant de cliquer.";
      return;
    }

    resultDiv.textContent = "Analyse des fichiers en cours...";

    try {
      const readFile = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (evt) => resolve(evt.target.result);
          reader.onerror = (err) => reject(new Error("Erreur de lecture du fichier " + file.name));
          reader.readAsText(file);
        });
      };

      const [contentA, contentB] = await Promise.all([
        readFile(fileInputA.files[0]),
        readFile(fileInputB.files[0])
      ]);

      const eventsA = parseICS(contentA);
      const eventsB = parseICS(contentB);

      if (eventsA.length === 0 || eventsB.length === 0) {
        throw new Error("L'un des fichiers .ics ne contient aucun événement valide (VEVENT).");
      }

      const check = checkConflict(eventsA, eventsB);

      if (check.success) {
        resultDiv.className = "result-box valid";
        resultDiv.innerHTML = `ÉCHANGE COMPATIBLE ✅<br><small>${eventsA.length} activités vs ${eventsB.length} activités analysées. Aucun conflit direct.</small>`;
      } else {
        resultDiv.className = "result-box invalid";
        resultDiv.innerHTML = `ÉCHANGE NON CONFORME ❌<br><small>${check.reason}</small>`;
      }

    } catch (err) {
      console.error(err);
      resultDiv.className = "result-box invalid";
      resultDiv.textContent = `Erreur : ${err.message}`;
    }
  });
});

function parseICS(icsText) {
  const events = [];
  // Découpage par bloc VEVENT
  const blocks = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    
    // Extraction flexible pour DTSTART et DTEND (gère Z, pas de Z, et paramètres optionnels)
    const startMatch = block.match(/DTSTART[^:]*:(\d{8}(?:T\d{6}Z?)?)/);
    const endMatch = block.match(/DTEND[^:]*:(\d{8}(?:T\d{6}Z?)?)/);
    const summaryMatch = block.match(/SUMMARY:(.*)/);

    if (startMatch && endMatch) {
      events.push({
        start: parseICSDate(startMatch[1]),
        end: parseICSDate(endMatch[1]),
        summary: summaryMatch ? summaryMatch[1].trim().replace(/\r/g, '') : 'Activité'
      });
    }
  }
  return events;
}

function parseICSDate(str) {
  // Format YYYYMMDDTHHMMSSZ ou YYYYMMDD
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

function checkConflict(eventsA, eventsB) {
  for (const a of eventsA) {
    for (const b of eventsB) {
      // Vérification du chevauchement d'horaires
      if (a.start < b.end && a.end > b.start) {
        return {
          success: false,
          reason: `Chevauchement : "${a.summary}" entre en conflit avec "${b.summary}".`
        };
      }
    }
  }
  return { success: true };
}
