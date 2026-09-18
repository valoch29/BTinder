import re
from datetime import datetime, timezone

def parse_ics(ics_content: str) -> list[dict]:
    """
    Parse le contenu iCal d'airBaltic et extrait la liste des engagements.
    """
    events = []
    # Découpage par bloc VEVENT
    raw_events = ics_content.split("BEGIN:VEVENT")

    for raw_ev in raw_events[1:]:
        ev_data = {}
        for line in raw_ev.splitlines():
            line = line.strip()
            if line.startswith("SUMMARY:"):
                ev_data["summary"] = line.replace("SUMMARY:", "").strip()
            elif line.startswith("DTSTART"):
                ev_data["start_utc"] = parse_ics_datetime(line)
            elif line.startswith("DTEND"):
                ev_data["end_utc"] = parse_ics_datetime(line)
            elif line.startswith("LOCATION:"):
                ev_data["location"] = line.replace("LOCATION:", "").strip()

        if "summary" in ev_data and "start_utc" in ev_data:
            # Extraction du type d'activité (Vol vs OFF/STBY)
            summary = ev_data["summary"]
            ev_data["is_flight"] = bool(re.match(r"^[A-Z]{2}\d+", summary))
            events.append(ev_data)

    return events

def parse_ics_datetime(line: str) -> datetime:
    """
    Convertit une ligne DTSTART/DTEND (ex: DTSTART:20261012T043000Z) en datetime UTC.
    """
    val = line.split(":")[-1].replace("Z", "")
    dt = datetime.strptime(val, "%Y%m%dT%H%M%S")
    return dt.replace(tzinfo=timezone.utc)
