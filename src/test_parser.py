from parser import parse_ics

# Exemple d'extrait iCal airBaltic (A220 / Base TLL)
sample_ics = """
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:BT311
DTSTART:20261012T043000Z
DTEND:20261012T114500Z
LOCATION:TLL
END:VEVENT
BEGIN:VEVENT
SUMMARY:OFF
DTSTART:20261013T000000Z
DTEND:20261013T235900Z
LOCATION:TLL
END:VEVENT
END:VCALENDAR
"""

duties = parse_ics(sample_ics)

print(f"Nombre d'événements détectés : {len(duties)}")
for d in duties:
    print(f"- {d['summary']} | UTC: {d['start_utc']} -> {d['end_utc']} | Vol: {d['is_flight']}")
