from datetime import datetime, timedelta

def check_rest_legality(previous_duty: dict, next_duty: dict) -> tuple[bool, str]:
    """
    Vérifie si le temps de repos entre deux services successifs respecte l'EASA ORO.FTL.235.
    """
    # Si l'un des deux jours est un jour OFF complet, le repos est valide
    if not previous_duty.get("is_flight") or not next_duty.get("is_flight"):
        return True, "Jour de repos/OFF présent : repos valide."

    end_prev = previous_duty["end_utc"]
    start_next = next_duty["start_utc"]

    # Calcul du repos réel
    rest_duration = start_next - end_prev

    # Calcul du FDP précédent pour déterminer le repos min requis à la base
    fdp_previous = end_prev - previous_duty["start_utc"]
    min_required_rest = max(timedelta(hours=12), fdp_previous)

    if rest_duration < min_required_rest:
        rest_hours = rest_duration.total_seconds() / 3600
        req_hours = min_required_rest.total_seconds() / 3600
        return False, f"ILLEGAL : Repos insuffisant ({rest_hours:.1f}h calculées vs {req_hours:.1f}h requises)."

    return True, "LEGAL : Repos conforme aux minima EASA."
