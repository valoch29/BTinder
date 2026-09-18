from parser import parse_ics
from ftl_engine import check_rest_legality

# Exemple de test : Vérifier l'enchaînement de deux vols consécutifs
sample_schedule = """
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:BT311
DTSTART:20261012T043000Z
DTEND:20261012T160000Z
LOCATION:TLL
END:VEVENT
BEGIN:VEVENT
SUMMARY:BT313
DTSTART:20261013T030000Z
DTEND:20261013T120000Z
LOCATION:TLL
END:VEVENT
END:VCALENDAR
"""

duties = parse_ics(sample_schedule)

if len(duties) >= 2:
    is_legal, reason = check_rest_legality(duties[0], duties[1])
    print(f"Statut du swap : {is_legal}")
    print(f"Raison : {reason}")
