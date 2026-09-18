let uploadedFiles = [];

// S'assure que le DOM est entièrement chargé avant d'exécuter le moindre script
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('filesInput');
  const dropZone = document.getElementById('dropZone');
  const btnCompare = document.getElementById('btnCompare');
  const fileListDiv = document.getElementById('fileList');
  const resultDiv = document.getElementById('result');

  if (!fileInput || !dropZone || !btnCompare) {
    console.error("Erreur critique : un élément HTML est introuvable.");
    return;
  }

  // Clic sur la zone de dépôt
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // Sélection des fichiers via l'explorateur
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadedFiles = Array.from(e.target.files);
      updateFileList(fileListDiv, btnCompare);
    }
  });

  // Lancement de l'analyse au clic sur le bouton
  btnCompare.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (uploadedFiles.length < 2) {
      resultDiv.className = "result-box invalid";
      resultDiv.classList.remove('hidden');
      resultDiv.textContent = "Veuillez sélectionner au moins 2 fichiers .ics ou .txt.";
      return;
    }

    resultDiv.classList.remove('hidden', 'valid', 'invalid');
    resultDiv.textContent = "Analyse croisée des plannings en cours...";

    try {
      const pilotsData = {};

      for (const file of uploadedFiles) {
        const text = await readFileAsync(file);
        const name = file.name.replace(/\.[^/.]+$/, ""); // Nom du pilote basé sur le fichier
        pilotsData[name] = parseRoster(text, file.name);
      }

      const results = analyzeSwaps(pilotsData);

      if (results.length === 0) {
        resultDiv.className = "result-box invalid";
        resultDiv.innerHTML = "AUCUN SWAP LÉGAL TROUVÉ ❌<br><small>Aucune combinaison 1v1 ou triangulaire ne respecte les critères FTL.</small>";
      } else {
        resultDiv.className = "result-box valid";
        let html = `<strong>${results.length} OPPORTUNITÉ(S) DÉTECTÉE(S) ✅</strong><br><br>`;
        html += `<ul style="text-align: left; margin: 0; padding-left: 1rem; max-height: 350px; overflow-y: auto;">`;
        
        results.forEach(res => {
          html += `<li style="margin-bottom: 0.6rem; border-bottom: 1px solid #c8e6c9; padding-bottom: 0.4rem;">
            📅 <strong>${res.date}</strong><br>
            🔄 <em>${res.type}</em> : ${res.description}<br>
            <span style="font-size: 0.78rem; color: #2e7d32;">✔️ FTL OK (12h Repos, FDP)</span>
          </li>`;
        });
        
        html += `</ul>`;
        resultDiv.innerHTML = html;
      }

    } catch (err) {
      console.error(err);
      resultDiv.className = "result-box invalid";
      resultDiv.textContent = `Erreur d'analyse : ${err.message}`;
    }
  });
});

function updateFileList(container, btn) {
  container.innerHTML = '';
  uploadedFiles.forEach(f => {
    const badge = document.createElement('span');
    badge.className = 'file-badge';
    badge.textContent = f.name;
    container.appendChild(badge);
  });
  btn.classList.remove('hidden');
}

function readFileAsync(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Impossible de lire le fichier " + file.name));
    reader.readAsText(file);
  });
}

// --- PARSERS ---
function parseRoster(text, filename) {
  if (filename.endsWith('.ics') || text.includes('BEGIN:VCALENDAR')) {
    return parseICS(text);
  } else {
    return parseNetLineText(text);
  }
}

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
      const summary = summaryMatch ? summaryMatch[1].trim().replace(/\r/g, '') : 'Duty';
      const dateStr = start.toISOString().split('T')[0];
      const sectors = (summary.match(/\//g) || []).length + 1;
      const flightHours = ((end - start) / 3600000) * 0.8;

      events.push({ start, end, summary, dateStr, sectors, flightHours, type: 'DUTY' });
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

function parseNetLineText(text) {
  const events = [];
  const periodMatch = text.match(/Period:\s*\d{2}([A-Za-z]{3})(\d{2})/);
  let year = "2026", monthStr = "Oct";
  if (periodMatch) { monthStr = periodMatch[1]; year = "20" + periodMatch[2]; }
  
  const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
  const month = months[monthStr] || '10';

  const lines = text.split('\n');
  lines.forEach(line => {
    const flightMatch = line.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\d{2})\s+([A-Z0-9\/\s]+)/);
    if (flightMatch) {
      const day = flightMatch[2];
      const activity = flightMatch[3].trim();
      const dateStr = `${year}-${month}-${day}`;

      const ciMatch = line.match(/C\/I\s+[A-Z]{3}\s+(\d{4})/);
      const coMatch = line.match(/C\/O\s+(\d{4})/);
      const ftMatch = line.match(/\[FT\s+(\d{2}):(\d{2})\]/);

      let start = new Date(`${dateStr}T00:00:00Z`);
      let end = new Date(`${dateStr}T23:59:00Z`);

      if (ciMatch) start = new Date(`${dateStr}T${ciMatch[1].substring(0, 2)}:${ciMatch[1].substring(2, 4)}:00Z`);
      if (coMatch) end = new Date(`${dateStr}T${coMatch[1].substring(0, 2)}:${coMatch[1].substring(2, 4)}:00Z`);

      let flightHours = ftMatch ? parseInt(ftMatch[1], 10) + parseInt(ftMatch[2], 10) / 60 : 0;
      const sectors = (activity.match(/\b[A-Z0-9]{2}\s+\d+\b/g) || []).length || 1;

      events.push({ start, end, summary: activity, dateStr, sectors, flightHours, type: 'DUTY' });
    }
  });
  return events;
}

// --- MOTEUR DE SWAP MULTI-PILOTES & TRIANGULAIRE ---
function analyzeSwaps(pilotsData) {
  const pilotNames = Object.keys(pilotsData);
  const allDates = new Set();
  
  Object.values(pilotsData).forEach(events => {
    events.forEach(e => allDates.add(e.dateStr));
  });

  const sortedDates = Array.from(allDates).sort();
  const validSwaps = [];

  sortedDates.forEach(date => {
    const dailyDuties = {};
    pilotNames.forEach(name => {
      const duty = pilotsData[name].find(e => e.dateStr === date);
      dailyDuties[name] = duty || null;
    });

    // 1v1
    for (let i = 0; i < pilotNames.length; i++) {
      for (let j = 0; j < pilotNames.length; j++) {
        if (i === j) continue;
        const nameA = pilotNames[i];
        const nameB = pilotNames[j];

        const dutyA = dailyDuties[nameA];
        const dutyB = dailyDuties[nameB];

        if (dutyA && !dutyB) {
          if (validateFtlRules(dutyA, pilotsData[nameB]).isLegal) {
            validSwaps.push({
              date: formatDateFr(date),
              type: "Swap Direct (1v1)",
              description: `<strong>${nameB}</strong> reprend le service de <strong>${nameA}</strong> (${dutyA.summary})`
            });
          }
        }
      }
    }

    // Triangulaire (3 pilotes ou plus)
    if (pilotNames.length >= 3) {
      for (let i = 0; i < pilotNames.length; i++) {
        for (let j = 0; j < pilotNames.length; j++) {
          for (let k = 0; k < pilotNames.length; k++) {
            if (i === j || j === k || i === k) continue;
            const pA = pilotNames[i];
            const pB = pilotNames[j];
            const pC = pilotNames[k];

            const dutyA = dailyDuties[pA];
            const dutyB = dailyDuties[pB];
            const dutyC = dailyDuties[pC];

            if (dutyA && dutyB && dutyC) {
              if (
                validateFtlRules(dutyA, pilotsData[pB]).isLegal &&
                validateFtlRules(dutyB, pilotsData[pC]).isLegal &&
                validateFtlRules(dutyC, pilotsData[pA]).isLegal
              ) {
                validSwaps.push({
                  date: formatDateFr(date),
                  type: "🔄 Swap Triangulaire",
                  description: `<strong>${pB}</strong> prend ${pA} ➔ <strong>${pC}</strong> prend ${pB} ➔ <strong>${pA}</strong> prend ${pC}`
                });
              }
            }
          }
        }
      }
    }
  });

  return validSwaps;
}

function validateFtlRules(targetDuty, receiverSchedule) {
  const startHour = targetDuty.start.getUTCHours();
  const maxFdpHours = getMaxFDP(startHour, targetDuty.sectors);
  const actualFdpHours = (targetDuty.end - targetDuty.start) / 3600000;

  if (actualFdpHours > maxFdpHours) return { isLegal: false };

  const priorDuty = receiverSchedule.filter(e => e.end <= targetDuty.start).sort((a, b) => b.end - a.end)[0];
  const nextDuty = receiverSchedule.filter(e => e.start >= targetDuty.end).sort((a, b) => a.start - b.start)[0];

  let minRestBeforeMs = 12 * 3600000;
  if (priorDuty) minRestBeforeMs = Math.max(minRestBeforeMs, priorDuty.end - priorDuty.start);

  const restBeforeMs = priorDuty ? (targetDuty.start - priorDuty.end) : Infinity;
  const restAfterMs = nextDuty ? (nextDuty.start - targetDuty.end) : Infinity;

  if (restBeforeMs < minRestBeforeMs || restAfterMs < (12 * 3600000)) return { isLegal: false };

  return { isLegal: true };
}

function getMaxFDP(startHour, sectors) {
  let maxFdp = 13.0;
  if (startHour >= 0 && startHour < 5) maxFdp = 11.0;
  else if (startHour >= 5 && startHour < 6) maxFdp = 12.0;
  else if (startHour >= 6 && startHour < 13) maxFdp = 13.0;
  else if (startHour >= 13 && startHour < 17) maxFdp = 12.5;
  else if (startHour >= 17 && startHour < 24) maxFdp = 11.5;
  if (sectors > 2) maxFdp -= (sectors - 2) * 0.5;
  return Math.max(maxFdp, 9.0);
}

function formatDateFr(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
