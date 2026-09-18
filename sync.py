import json
import urllib.request
from datetime import datetime

def parse_ics(ics_text):
    """
    Découpe basique d'un fichier iCal pour extraire les VEVENT.
    """
    events = []
    current_event = {}
    in_event = False

    for line in ics_text.splitlines():
        line = line.strip()
        if line == "BEGIN:VEVENT":
            in_event = True
            current_event = {}
        elif line == "END:VEVENT":
            in_event = False
            if "SUMMARY" in current_event:
                events.append(current_event)
        elif in_event and ":" in line:
            key, val = line.split(":", 1)
            # Gestion basique des clés principales
            if key.startswith("SUMMARY"):
                current_event["SUMMARY"] = val
            elif key.startswith("DTSTART"):
                current_event["DTSTART"] = val
            elif key.startswith("DTEND"):
                current_event["DTEND"] = val

    return events

def main():
    # 1. Charger la liste des pilotes
    with open("pilots.json", "r", encoding="utf-8") as f:
        pilots = json.load(f)

    all_data = []

    # 2. Télécharger et analyser le roster de chaque pilote
    for pilot in pilots:
        print(f"Synchronisation pour {pilot['trigram']}...")
        try:
            req = urllib.request.Request(
                pilot["ics_url"], 
                headers={"User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req) as response:
                ics_text = response.read().decode("utf-8")
                
            events = parse_ics(ics_text)
            
            all_data.append({
                "trigram": pilot["trigram"],
                "name": pilot["name"],
                "rank": pilot["rank"],
                "base": pilot["base"],
                "last_updated": datetime.utcnow().isoformat(),
                "events": events
            })
        except Exception as e:
            print(f"Erreur pour {pilot['trigram']}: {e}")

    # 3. Sauvegarder les données compilées
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print("Mise à jour de data.json terminée.")

if __name__ == "__main__":
    main()
