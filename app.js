document.getElementById('btnCompare').addEventListener('click', async () => {
  const fileInputA = document.getElementById('fileA');
  const fileInputB = document.getElementById('fileB');
  const resultDiv = document.getElementById('result');

  if (!fileInputA.files[0] || !fileInputB.files[0]) {
    alert("Veuillez sélectionner les deux fichiers .ics.");
    return;
  }

  resultDiv.classList.remove('hidden', 'valid', 'invalid');
  resultDiv.textContent = "Lecture & analyse des plannings...";

  try {
    const readFile = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
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
      throw new Error("Impossible de lire les événements d'un des fichiers (fichier vide ou format invalide).");
    }

    const check = checkConflict(eventsA, eventsB);

    if (check.success) {
      resultDiv.className = "result-box valid";
      resultDiv.innerHTML = `ÉCHANGE COMPATIBLE ✅<br><small>${eventsA.length} et ${eventsB.length} activités analysées. Aucun conflit direct.</small>`;
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

function parseICS(icsText) {
  const events = [];
  const blocks = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const startMatch = block.match(/DTSTART(?:;[^:]*)?:(\d{8}T\d{6}Z?)/);
    const endMatch = block.match(/DTEND(?:;[^:]*)?:(\d{8}T\d{6}Z?)/);
    const summaryMatch = block.match(/SUMMARY:(.*)/);

    if (startMatch && endMatch) {
      events.push({
        start: parseICSDate(startMatch[1]),
        end: parseICSDate(endMatch[1]),
        summary: summaryMatch ? summaryMatch[1].trim() : 'Activité'
      });
    }
  }
  return events;
}

function parseICSDate(icsDateStr) {
  const y = parseInt(icsDateStr.substring(0, 4), 10);
  const m = parseInt(icsDateStr.substring(4, 6), 10) - 1;
  const d = parseInt(icsDateStr.substring(6, 8), 10);
  const h = parseInt(icsDateStr.substring(9, 11) || 0, 10);
  const min = parseInt(icsDateStr.substring(11, 13) || 0, 10);
  const s = parseInt(icsDateStr.substring(13, 15) || 0, 10);
  return new Date(Date.UTC(y, m, d, h, min, s));
}

function checkConflict(eventsA, eventsB) {
  for (const a of eventsA) {
    for (const b of eventsB) {
      if (a.start < b.end && a.end > b.start) {
        return {
          success: false,
          reason: `Conflit horaire : "${a.summary}" entre en chevauchement avec "${b.summary}".`
        };
      }
    }
  }
  return { success: true };
}
