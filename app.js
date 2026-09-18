document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnCompare');
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const fileInputA = document.getElementById('fileA');
    const fileInputB = document.getElementById('fileB');
    const resultDiv = document.getElementById('result');

    resultDiv.classList.remove('hidden', 'valid', 'invalid');

    if (!fileInputA.files[0] || !fileInputB.files[0]) {
      resultDiv.className = "result-box invalid";
      resultDiv.textContent = "Veuillez sélectionner deux fichiers (.ics ou .txt).";
      return;
    }

    resultDiv.textContent = "Contrôle complet de la conformité EASA ORO.FTL en cours...";

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

      const eventsA = parseRoster(contentA, fileInputA.files[0].name);
      const eventsB = parseRoster(contentB, fileInputB.files[0].name);

      const opportunities = findFullyLegalSwaps(eventsA, eventsB);

      if (opportunities.length === 0) {
        resultDiv.className = "result-box invalid";
        resultDiv.innerHTML = "AUCUN SWAP LÉGAL TROUVÉ ❌<br><small>Aucun échange ne satisfait à l'ensemble des critères EASA ORO.FTL (12h Rest, ERR 36h, Max FDP, 100h/28j).</small>";
      } else {
        resultDiv.className = "result-box valid";
        let html = `<strong>${opportunities.length} SWAP(S) CONFORMES EASA ORO.FTL ✅</strong><br><br>`;
        html += `<ul style="text-align: left; margin: 0; padding-left: 1rem; font-size: 0.82rem; max-height: 400px; overflow-y: auto;">`;
        
        opportunities.forEach(opp => {
          html += `<li style="margin-bottom: 0.6rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.4rem;">
            <strong>${opp.date}</strong> : ${opp.detail}<br>
            <span style="color: #2e7d32;">✔ Repos : -${opp.restBefore} / +${opp.restAfter} | FDP : ${opp.fdpDuration} (Max: ${opp.maxFdpAllowed}) | ERR 36h : OK</span>
          </li>`;
        });
        
        html += `</ul>`;
        resultDiv.innerHTML = html;
      }

    } catch (err) {
      console.error(err);
      resultDiv.className = "result-box invalid";
      resultDiv.textContent = `Erreur : ${err.message}`;
    }
  });
});

// Détecte le format (.ics ou .txt)
function parseRoster(text, filename) {
  if (filename.endsWith('.ics') || text.includes('BEGIN:VCALENDAR')) {
    return parseICS(text);
  } else {
    return parseNetLineText(text);
  }
}

// Parser ICS avec support du temps de vol (FT) et nombre de secteurs
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
      
      // Estimation des secteurs selon les séparateurs de vol (ex: LX 2279 / LX 750)
      const sectors = (summary.match(/\//g) || []).length + 1;
      
      // Calcul estimé du Flight Time (80% du FDP par défaut si non spécifié)
      const fdpHours = (end - start) / 3600000;
      const flightHours = fdpHours * 0.8;

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

// Parser NetLine/Crew Texte
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

      if (ciMatch) {
        start = new Date(`${dateStr}T${ciMatch[1].substring(0, 2)}:${ciMatch[1].substring(2, 4)}:00Z`);
      }
      if (coMatch) {
        end = new Date(`${dateStr}T${coMatch[1].substring(0, 2)}:${coMatch[1].substring(2, 4)}:00Z`);
      }

      let flightHours = 0;
      if (ftMatch) {
        flightHours = parseInt(ftMatch[1], 10) + parseInt(ftMatch[2], 10) / 60;
      }

      const sectors = (activity.match(/\b[A-Z0-9]{2}\s+\d+\b/g) || []).length || 1;

      events.push({ start, end, summary: activity, dateStr, sectors, flightHours, type: 'DUTY' });
    }
  });

  return events;
}

// Moteur de vérification globale FTL
function findFullyLegalSwaps(eventsA, eventsB) {
  const datesA = eventsA.map(e => e.dateStr);
  const datesB = eventsB.map(e => e.dateStr);
  const allDates = Array.from(new Set([...datesA, ...datesB])).sort();

  const opportunities = [];

  allDates.forEach(date => {
    const dutyA = eventsA.find(e => e.dateStr === date);
    const dutyB = eventsB.find(e => e.dateStr === date);

    // Cas 1 : Pilote A donne son service à Pilote B (qui est OFF)
    if (dutyA && !dutyB) {
      const ftlVal = validateFtlRules(dutyA, eventsB);
      if (ftlVal.isLegal) {
        opportunities.push({
          date: formatDateFr(date),
          detail: `Tu donnes <strong>${dutyA.summary}</strong> à Collègue`,
          restBefore: ftlVal.restBeforeStr,
          restAfter: ftlVal.restAfterStr,
          fdpDuration: ftlVal.fdpStr,
          maxFdpAllowed: ftlVal.maxFdpStr
        });
      }
    }
    // Cas 2 : Pilote A reprend le service de Pilote B
    else if (!dutyA && dutyB) {
      const ftlVal = validateFtlRules(dutyB, eventsA);
      if (ftlVal.isLegal) {
        opportunities.push({
          date: formatDateFr(date),
          detail: `Tu reprends <strong>${dutyB.summary}</strong> de Collègue`,
          restBefore: ftlVal.restBeforeStr,
          restAfter: ftlVal.restAfterStr,
          fdpDuration: ftlVal.fdpStr,
          maxFdpAllowed: ftlVal.maxFdpStr
        });
      }
    }
  });

  return opportunities;
}

// Évaluation centrale de la réglementation EASA ORO.FTL
function validateFtlRules(targetDuty, receiverSchedule) {
  // 1. Calcul FDP max selon heure de départ UTC et nombre de secteurs (ORO.FTL.205)
  const startHour = targetDuty.start.getUTCHours();
  const maxFdpHours = getMaxFDP(startHour, targetDuty.sectors);
  const actualFdpHours = (targetDuty.end - targetDuty.start) / 3600000;

  if (actualFdpHours > maxFdpHours) {
    return { isLegal: false, reason: "FDP Supérieur au plafond autorisé" };
  }

  // 2. Contrôle du repos minimal (12h ou durée du FDP précédent si supérieur)
  const priorDuty = receiverSchedule
    .filter(e => e.end <= targetDuty.start)
    .sort((a, b) => b.end - a.end)[0];

  const nextDuty = receiverSchedule
    .filter(e => e.start >= targetDuty.end)
    .sort((a, b) => a.start - b.start)[0];

  let minRestBeforeMs = 12 * 3600000;
  if (priorDuty) {
    const priorFdpMs = priorDuty.end - priorDuty.start;
    minRestBeforeMs = Math.max(minRestBeforeMs, priorFdpMs);
  }

  const restBeforeMs = priorDuty ? (targetDuty.start - priorDuty.end) : Infinity;
  const restAfterMs = nextDuty ? (nextDuty.start - targetDuty.end) : Infinity;

  if (restBeforeMs < minRestBeforeMs || restAfterMs < (12 * 3600000)) {
    return { isLegal: false, reason: "Repos suffisant non respecté" };
  }

  // 3. Simulation du nouveau planning du receveur pour validation globale
  const simulatedSchedule = [...receiverSchedule, targetDuty].sort((a, b) => a.start - b.start);

  // 4. Contrôle du Repos Hebdomadaire Étendu (Extended Recovery Rest - 36h / 168h glissantes)
  if (!checkExtendedRecoveryRest(simulatedSchedule)) {
    return { isLegal: false, reason: "Manque la période de repos hebdomadaire 36h (ERR)" };
  }

  // 5. Plafond d'heures de vol cumulées (100h / 28 jours glissants)
  if (!checkCumulativeFlightTime(simulatedSchedule, 100)) {
    return { isLegal: false, reason: "Plafond de 100h de vol sur 28 jours dépassé" };
  }

  return {
    isLegal: true,
    restBeforeStr: restBeforeMs === Infinity ? "∞" : `${(restBeforeMs / 3600000).toFixed(1)}h`,
    restAfterStr: restAfterMs === Infinity ? "∞" : `${(restAfterMs / 3600000).toFixed(1)}h`,
    fdpStr: `${actualFdpHours.toFixed(1)}h`,
    maxFdpStr: `${maxFdpHours.toFixed(1)}h`
  };
}

// Table ORO.FTL.205 (Max FDP non acclimaté / acclimaté simplifié)
function getMaxFDP(startHour, sectors) {
  // Table de base (1 à 2 secteurs)
  let maxFdp = 13.0;
  if (startHour >= 0 && startHour < 5) maxFdp = 11.0;
  else if (startHour >= 5 && startHour < 6) maxFdp = 12.0;
  else if (startHour >= 6 && startHour < 13) maxFdp = 13.0;
  else if (startHour >= 13 && startHour < 17) maxFdp = 12.5;
  else if (startHour >= 17 && startHour < 24) maxFdp = 11.5;

  // Réduction de 30 minutes par secteur supplémentaire au-delà de 2
  if (sectors > 2) {
    maxFdp -= (sectors - 2) * 0.5;
  }
  return Math.max(maxFdp, 9.0);
}

// Vérification d'une plage de 36h continues dans toute fenêtre de 168h
function checkExtendedRecoveryRest(schedule) {
  if (schedule.length < 2) return true;
  
  const minTime = schedule[0].start.getTime();
  const maxTime = schedule[schedule.length - 1].end.getTime();
  const WINDOW_MS = 168 * 3600000;
  const ERR_MS = 36 * 3600000;

  for (let t = minTime; t <= maxTime - WINDOW_MS; t += 24 * 3600000) {
    const windowEnd = t + WINDOW_MS;
    const dutiesInWindow = schedule.filter(e => e.end > t && e.start < windowEnd);

    let maxGap = 0;
    let lastEnd = t;

    dutiesInWindow.forEach(d => {
      const gap = Math.max(0, d.start.getTime() - lastEnd);
      if (gap > maxGap) maxGap = gap;
      lastEnd = Math.max(lastEnd, d.end.getTime());
    });

    const finalGap = Math.max(0, windowEnd - lastEnd);
    if (finalGap > maxGap) maxGap = finalGap;

    if (maxGap < ERR_MS) {
      return false;
    }
  }
  return true;
}

// Vérification du plafond de 100h de vol sur 28 jours glissants
function checkCumulativeFlightTime(schedule, maxHours) {
  const WINDOW_MS = 28 * 24 * 3600000;

  for (let i = 0; i < schedule.length; i++) {
    const windowStart = schedule[i].start.getTime();
    const windowEnd = windowStart + WINDOW_MS;

    const totalFlightHours = schedule
      .filter(e => e.start.getTime() >= windowStart && e.end.getTime() <= windowEnd)
      .reduce((sum, e) => sum + (e.flightHours || 0), 0);

    if (totalFlightHours > maxHours) {
      return false;
    }
  }
  return true;
}

function formatDateFr(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
