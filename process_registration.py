import os
import json
import re
import urllib.request
from datetime import datetime, timezone

def parse_issue_body(body):
    """Extrait trigramme, rank, base et url depuis le corps de l'issue."""
    data = {}
    for line in body.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            data[key.strip().lower()] = value.strip()
    return data

def process():
    issue_body = os.environ.get("ISSUE_BODY", "")
    info = parse_issue_body(issue_body)
    
    trigram = info.get("trigramme", "").upper()
    rank = info.get("rang", "").upper()
    base = info.get("base", "").upper()
    ical_url = info.get("url", "")

    if not trigram or len(trigram) != 3 or not ical_url:
        print("❌ Données invalides.")
        return

    # 1. Mise à jour de pilots.json
    pilots_file = "pilots.json"
    pilots = []
    if os.path.exists(pilots_file):
        with open(pilots_file, "r", encoding="utf-8") as f:
            try:
                pilots = json.load(f)
            except:
                pilots = []

    # Remplacer ou ajouter le pilote
    pilots = [p for p in pilots if p.get("id") != trigram]
    new_pilot = {"id": trigram, "rank": rank, "base": base, "ical_url": ical_url}
    pilots.append(new_pilot)

    with open(pilots_file, "w", encoding="utf-8") as f:
        json.dump(pilots, f, ensure_ascii=False, indent=2)

    # 2. Création du fichier de redirection / page individuelle (ex: WLH.html)
    # Sur GitHub Pages, l'accès à /WLH servira le fichier WLH.html
    html_template = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Planning BTinder - {trigram}</title>
  <script>
    window.location.href = "index.html?pilot={trigram}";
  </script>
</head>
<body>
  <p>Redirection vers le planning de {trigram}...</p>
</body>
</html>"""
    
    with open(f"{trigram}.html", "w", encoding="utf-8") as f:
        f.write(html_template)

    print(f"✅ Pilote {trigram} enregistré et page {trigram}.html générée !")

if __name__ == "__main__":
    process()
