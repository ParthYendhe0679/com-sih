"""Deterministic Call Detail Record (CDR) parsing and communication-anomaly analytics.

Powers the SAMANVAYA data-ingestion step. Everything here is computed from the
file the investigating officer actually uploaded - there is no synthetic data and
no inference beyond arithmetic on the supplied records. Findings are phrased as
*anomalies requiring review*, never as assertions of criminality.
"""

from __future__ import annotations

import csv
import io
import json
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger
from app.schemas.samanvaya import (
    CDRAnalysis,
    CommunicationLink,
    CommunicationParty,
    DailyVolumePoint,
    SuspiciousPattern,
)

logger = get_logger("kritagas.samanvaya.cdr")


# ---------------------------------------------------------------------------
# Column alias resolution - real CDR exports differ wildly between telcos
# ---------------------------------------------------------------------------

_ALIASES: Dict[str, Tuple[str, ...]] = {
    "caller": (
        "caller", "a_party", "aparty", "from", "source", "calling_number",
        "caller_number", "msisdn", "a_number", "originating_number",
    ),
    "callee": (
        "callee", "b_party", "bparty", "to", "target", "called_number",
        "callee_number", "b_number", "destination", "terminating_number",
    ),
    "timestamp": (
        "timestamp", "datetime", "date_time", "call_time", "start_time",
        "call_date", "date", "time_stamp", "event_time",
    ),
    "duration": (
        "duration", "duration_sec", "duration_seconds", "call_duration",
        "dur", "secs", "seconds",
    ),
    "call_type": ("call_type", "type", "direction", "event_type", "service_type"),
    "cell": ("cell", "cell_id", "tower", "tower_id", "cellid", "lac", "location", "cell_site", "site"),
    "imei": ("imei", "device_imei"),
}

_TIME_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%d %H:%M",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
    "%d-%m-%Y %H:%M:%S",
    "%d-%m-%Y %H:%M",
    "%Y/%m/%d %H:%M:%S",
    "%Y-%m-%d",
    "%d/%m/%Y",
)

_DELIMITERS = ",;\t|"


def _norm_header(h: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (h or "").strip().lower()).strip("_")


def _build_column_map(headers: List[str]) -> Dict[str, str]:
    """Map canonical field -> actual header present in the uploaded file."""
    normalized = {_norm_header(h): h for h in headers}
    mapping: Dict[str, str] = {}
    for canonical, aliases in _ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                mapping[canonical] = normalized[alias]
                break
    return mapping


def _parse_number(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    digits = re.sub(r"[^0-9+]", "", str(raw)).lstrip("+")
    if len(digits) < 6:
        return None
    if len(digits) > 10:
        digits = digits[-10:]
    return digits


def _parse_dt(raw: Any) -> Optional[datetime]:
    if raw is None:
        return None
    text = str(raw).strip().replace("Z", "")
    if not text:
        return None
    for fmt in _TIME_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _parse_duration(raw: Any) -> int:
    if raw is None:
        return 0
    text = str(raw).strip()
    if not text:
        return 0
    if ":" in text:
        try:
            nums = [int(p) for p in text.split(":")]
        except ValueError:
            return 0
        if len(nums) == 3:
            return nums[0] * 3600 + nums[1] * 60 + nums[2]
        if len(nums) == 2:
            return nums[0] * 60 + nums[1]
        return 0
    try:
        return max(0, int(float(text)))
    except ValueError:
        return 0


def _mask(number: str) -> str:
    """Partially mask a subscriber number for on-screen display."""
    if len(number) <= 4:
        return number
    return number[:2] + ("X" * (len(number) - 6)) + number[-4:]


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

class ParsedCDR:
    __slots__ = ("caller", "callee", "at", "duration", "call_type", "cell")

    def __init__(self, caller: str, callee: str, at: Optional[datetime], duration: int, call_type: str, cell: str):
        self.caller = caller
        self.callee = callee
        self.at = at
        self.duration = duration
        self.call_type = call_type
        self.cell = cell


def parse_cdr_file(content: bytes, file_name: str) -> Tuple[List[ParsedCDR], List[str], int, List[str]]:
    """Parse an uploaded CSV or JSON CDR export.

    Returns (records, detected_columns, rejected_count, notes).
    Raises ValueError with an investigator-readable message on unusable input.
    """
    notes: List[str] = []
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1", errors="replace")
        notes.append("File was not valid UTF-8; decoded using Latin-1 fallback.")

    rows: List[Dict[str, Any]] = []
    headers: List[str] = []
    lowered = file_name.lower()

    if lowered.endswith(".json") or text.lstrip()[:1] in ("[", "{"):
        payload = json.loads(text)
        if isinstance(payload, dict):
            for key in ("records", "data", "calls", "items", "cdr"):
                if isinstance(payload.get(key), list):
                    payload = payload[key]
                    break
        if not isinstance(payload, list):
            raise ValueError("JSON call records must be an array of objects, or an object containing one.")
        rows = [r for r in payload if isinstance(r, dict)]
        headers = list(rows[0].keys()) if rows else []
    else:
        sample = text[:4096]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=_DELIMITERS)
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        headers = list(reader.fieldnames or [])
        rows = list(reader)

    if not headers:
        raise ValueError("Could not read any column headers from the uploaded file.")

    colmap = _build_column_map(headers)
    if "caller" not in colmap or "callee" not in colmap:
        raise ValueError(
            "Could not identify the calling/called number columns. Expected headers such as "
            "'caller'/'a_party'/'from' and 'callee'/'b_party'/'to'. Found: " + ", ".join(headers[:12])
        )
    if "timestamp" not in colmap:
        notes.append("No timestamp column detected - temporal anomaly detection is disabled for this file.")

    records: List[ParsedCDR] = []
    rejected = 0
    for row in rows:
        caller = _parse_number(row.get(colmap["caller"]))
        callee = _parse_number(row.get(colmap["callee"]))
        if not caller or not callee or caller == callee:
            rejected += 1
            continue
        at = _parse_dt(row.get(colmap["timestamp"])) if "timestamp" in colmap else None
        records.append(
            ParsedCDR(
                caller=caller,
                callee=callee,
                at=at,
                duration=_parse_duration(row.get(colmap["duration"])) if "duration" in colmap else 0,
                call_type=str(row.get(colmap["call_type"], "") or "").strip().upper() if "call_type" in colmap else "",
                cell=str(row.get(colmap["cell"], "") or "").strip() if "cell" in colmap else "",
            )
        )

    if not records:
        raise ValueError("No usable call records were found in the uploaded file.")

    return records, list(colmap.keys()), rejected, notes


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

def _severity_for(score: float) -> str:
    if score >= 0.85:
        return "CRITICAL"
    if score >= 0.70:
        return "HIGH"
    if score >= 0.50:
        return "MEDIUM"
    return "LOW"


def analyze_cdr(
    records: List[ParsedCDR],
    file_name: str,
    columns: List[str],
    rejected: int,
    notes: List[str],
    incident_at: Optional[datetime] = None,
    known_numbers: Optional[Dict[str, str]] = None,
) -> CDRAnalysis:
    """Compute communication statistics and flag anomalous patterns for review."""
    known_numbers = known_numbers or {}
    notes = list(notes)
    timed = sorted([r for r in records if r.at is not None], key=lambda r: r.at)

    window_start = timed[0].at if timed else None
    window_end = timed[-1].at if timed else None

    # Without an incident timestamp on the case record, anchor the anomaly windows
    # on the busiest day so "pre-event" still describes a real, explainable point.
    inferred_incident = False
    if incident_at is None and timed:
        per_day: Dict[Any, int] = defaultdict(int)
        for r in timed:
            per_day[r.at.date()] += 1
        busiest = max(per_day.items(), key=lambda kv: kv[1])[0]
        incident_at = datetime.combine(busiest, datetime.min.time()) + timedelta(hours=12)
        inferred_incident = True
        notes.append(
            "No incident timestamp on the case record - anomaly windows are anchored on the "
            "highest-activity day in the dataset (" + busiest.isoformat() + ")."
        )

    # ---- Aggregation ------------------------------------------------------
    party_calls: Dict[str, int] = defaultdict(int)
    party_seconds: Dict[str, int] = defaultdict(int)
    party_contacts: Dict[str, set] = defaultdict(set)
    party_times: Dict[str, List[datetime]] = defaultdict(list)

    link_calls: Dict[Tuple[str, str], int] = defaultdict(int)
    link_seconds: Dict[Tuple[str, str], int] = defaultdict(int)
    link_times: Dict[Tuple[str, str], List[datetime]] = defaultdict(list)

    daily: Dict[Any, int] = defaultdict(int)
    party_daily: Dict[str, Dict[Any, int]] = defaultdict(lambda: defaultdict(int))
    odd_hour: Dict[str, int] = defaultdict(int)

    for r in records:
        for n in (r.caller, r.callee):
            party_calls[n] += 1
            party_seconds[n] += r.duration
        party_contacts[r.caller].add(r.callee)
        party_contacts[r.callee].add(r.caller)

        key = (r.caller, r.callee)
        link_calls[key] += 1
        link_seconds[key] += r.duration

        if r.at:
            day = r.at.date()
            daily[day] += 1
            link_times[key].append(r.at)
            for n in (r.caller, r.callee):
                party_times[n].append(r.at)
                party_daily[n][day] += 1
            if r.at.hour < 5:
                odd_hour[r.caller] += 1

    incident_day = incident_at.date() if incident_at else None

    parties: List[CommunicationParty] = []
    for number, calls in sorted(party_calls.items(), key=lambda kv: kv[1], reverse=True):
        times = sorted(party_times.get(number, []))
        day_counts = party_daily.get(number, {})
        active_days = len(day_counts) or 1
        peak = max(day_counts.values()) if day_counts else 0
        non_peak = [v for v in day_counts.values() if v != peak] or list(day_counts.values())
        baseline = round(sum(non_peak) / len(non_peak), 2) if non_peak else 0.0
        is_new = bool(incident_at and times and (incident_at - timedelta(hours=72)) <= times[0] <= incident_at)
        known = known_numbers.get(number)
        parties.append(
            CommunicationParty(
                number=_mask(number),
                displayName=known,
                role="IDENTIFIED PARTY" if known else ("NEW CONTACT" if is_new else "UNKNOWN CONTACT"),
                totalCalls=calls,
                totalSeconds=party_seconds.get(number, 0),
                uniqueContacts=len(party_contacts.get(number, set())),
                firstSeen=times[0].isoformat(timespec="minutes") if times else None,
                lastSeen=times[-1].isoformat(timespec="minutes") if times else None,
                baselineCallsPerDay=baseline if baseline else round(calls / active_days, 2),
                peakCallsPerDay=peak,
                isNewContact=is_new,
                matchedEntity=known,
            )
        )

    links: List[CommunicationLink] = []
    for (src, dst), calls in sorted(link_calls.items(), key=lambda kv: kv[1], reverse=True)[:120]:
        times = sorted(link_times.get((src, dst), []))
        pre = 0
        if incident_at:
            pre = sum(1 for t in times if incident_at - timedelta(hours=24) <= t <= incident_at)
        links.append(
            CommunicationLink(
                id="cdr-link-" + str(len(links) + 1),
                source=_mask(src),
                target=_mask(dst),
                calls=calls,
                totalSeconds=link_seconds.get((src, dst), 0),
                firstSeen=times[0].isoformat(timespec="minutes") if times else None,
                lastSeen=times[-1].isoformat(timespec="minutes") if times else None,
                preIncidentCalls=pre,
            )
        )

    # ---- Anomaly detection ------------------------------------------------
    patterns: List[SuspiciousPattern] = []

    # 1. Sudden volume spike measured against the party's own baseline
    for number, day_counts in party_daily.items():
        if len(day_counts) < 2:
            continue
        peak_day, peak = max(day_counts.items(), key=lambda kv: kv[1])
        others = [v for d, v in day_counts.items() if d != peak_day]
        if not others:
            continue
        baseline = sum(others) / len(others)
        if peak >= max(baseline * 3, baseline + 4) and peak >= 6:
            score = min(0.97, 0.55 + min(peak / max(baseline, 1.0), 12.0) / 24.0)
            patterns.append(SuspiciousPattern(
                id="cdr-spike-" + str(len(patterns) + 1),
                patternType="VOLUME_SPIKE",
                title="Sudden communication spike",
                partyA=_mask(number),
                description=(
                    _mask(number) + " averages " + format(baseline, ".1f") + " calls/day across the dataset "
                    "but recorded " + str(peak) + " calls on " + peak_day.isoformat() + " - a "
                    + format(peak / max(baseline, 0.5), ".1f") + "x increase."
                ),
                baselineValue=round(baseline, 2),
                observedValue=float(peak),
                riskScore=round(score, 2),
                severity=_severity_for(score),
                window=peak_day.isoformat(),
                evidence=["Uploaded CDR: " + file_name, str(peak) + " records dated " + peak_day.isoformat()],
            ))

    if incident_at:
        pre_window_start = incident_at - timedelta(hours=24)

        # 2. Concentrated burst on one link in the 24h before the reference event
        for (src, dst), raw_times in link_times.items():
            times = sorted(raw_times)
            burst = [t for t in times if pre_window_start <= t <= incident_at]
            earlier = [t for t in times if t < pre_window_start]
            if len(burst) < 4:
                continue
            span_days = max(1.0, (pre_window_start - times[0]).total_seconds() / 86400.0)
            baseline = len(earlier) / span_days
            if len(burst) >= max(baseline * 3, baseline + 3):
                last_gap = (incident_at - burst[-1]).total_seconds() / 60.0
                score = min(0.96, 0.6 + len(burst) / 40.0 + (0.12 if last_gap <= 60 else 0.0))
                patterns.append(SuspiciousPattern(
                    id="cdr-burst-" + str(len(patterns) + 1),
                    patternType="PRE_INCIDENT_BURST",
                    title="Communication burst before reference event",
                    partyA=_mask(src),
                    partyB=_mask(dst),
                    description=(
                        str(len(burst)) + " calls between " + _mask(src) + " and " + _mask(dst) +
                        " in the 24 hours before the reference event, against a prior average of "
                        + format(baseline, ".1f") + "/day. Last contact " + str(int(last_gap)) +
                        " minutes before the reference time."
                    ),
                    baselineValue=round(baseline, 2),
                    observedValue=float(len(burst)),
                    riskScore=round(score, 2),
                    severity=_severity_for(score),
                    window=pre_window_start.isoformat(timespec="minutes") + " to " + incident_at.isoformat(timespec="minutes"),
                    evidence=["Uploaded CDR: " + file_name, str(len(burst)) + " records in pre-event window"],
                ))

        # 3. Dormant link reactivated close to the reference event
        for (src, dst), raw_times in link_times.items():
            times = sorted(raw_times)
            if len(times) < 3:
                continue
            near = [t for t in times if abs((t - incident_at).total_seconds()) <= 48 * 3600]
            before = [t for t in times if t < incident_at - timedelta(hours=48)]
            if len(near) >= 3 and before:
                gap_days = (near[0] - before[-1]).days
                if gap_days >= 14:
                    score = min(0.93, 0.58 + min(gap_days, 90) / 300.0 + len(near) / 40.0)
                    patterns.append(SuspiciousPattern(
                        id="cdr-dormant-" + str(len(patterns) + 1),
                        patternType="DORMANT_REACTIVATION",
                        title="Dormant contact reactivated",
                        partyA=_mask(src),
                        partyB=_mask(dst),
                        description=(
                            "No contact between " + _mask(src) + " and " + _mask(dst) + " for " +
                            str(gap_days) + " days, then " + str(len(near)) +
                            " calls within 48 hours of the reference event."
                        ),
                        baselineValue=float(gap_days),
                        observedValue=float(len(near)),
                        riskScore=round(score, 2),
                        severity=_severity_for(score),
                        window="within 48h of " + incident_at.isoformat(timespec="minutes"),
                        evidence=["Uploaded CDR: " + file_name, "Silence gap of " + str(gap_days) + " days"],
                    ))

        # 4. Number appearing for the first time immediately before the event
        for number, raw_times in party_times.items():
            times = sorted(raw_times)
            if not times:
                continue
            if incident_at - timedelta(hours=72) <= times[0] <= incident_at and len(times) >= 3:
                hours_before = (incident_at - times[0]).total_seconds() / 3600.0
                score = min(0.92, 0.6 + len(times) / 40.0 + (0.1 if hours_before <= 24 else 0.0))
                patterns.append(SuspiciousPattern(
                    id="cdr-new-" + str(len(patterns) + 1),
                    patternType="NEW_CONTACT_BEFORE_INCIDENT",
                    title="New contact appears before reference event",
                    partyA=_mask(number),
                    description=(
                        _mask(number) + " has no prior history in this dataset and first appears " +
                        format(hours_before, ".0f") + " hours before the reference event, with " +
                        str(len(times)) + " calls."
                    ),
                    baselineValue=0.0,
                    observedValue=float(len(times)),
                    riskScore=round(score, 2),
                    severity=_severity_for(score),
                    window=times[0].isoformat(timespec="minutes"),
                    evidence=["Uploaded CDR: " + file_name],
                ))

        # 5. Relay chain A -> B then B -> C shortly before the event
        pre_calls = sorted(
            [r for r in timed if incident_at - timedelta(hours=12) <= r.at <= incident_at],
            key=lambda r: r.at,
        )
        seen_chains: set = set()
        for i, first in enumerate(pre_calls):
            if len(seen_chains) >= 6:
                break
            for second in pre_calls[i + 1:]:
                if second.at - first.at > timedelta(minutes=30):
                    break
                if second.caller == first.callee and second.callee != first.caller:
                    key = (first.caller, first.callee, second.callee)
                    if key in seen_chains:
                        continue
                    seen_chains.add(key)
                    minutes = (second.at - first.at).total_seconds() / 60.0
                    before_event = (incident_at - second.at).total_seconds() / 60.0
                    score = min(0.9, 0.66 + (30.0 - minutes) / 200.0)
                    patterns.append(SuspiciousPattern(
                        id="cdr-chain-" + str(len(patterns) + 1),
                        patternType="COMMUNICATION_CHAIN",
                        title="Relay communication chain",
                        partyA=_mask(first.caller),
                        partyB=_mask(second.callee),
                        description=(
                            _mask(first.caller) + " to " + _mask(first.callee) + " to " + _mask(second.callee) +
                            " within " + format(minutes, ".0f") + " minutes, " + format(before_event, ".0f") +
                            " minutes before the reference event."
                        ),
                        baselineValue=0.0,
                        observedValue=round(minutes, 1),
                        riskScore=round(score, 2),
                        severity=_severity_for(score),
                        window=first.at.isoformat(timespec="minutes"),
                        evidence=["Uploaded CDR: " + file_name, "Sequential relay within 30 minutes"],
                    ))
                    if len(seen_chains) >= 6:
                        break

        # 6. Went silent immediately after the event
        if window_end and (window_end - incident_at) >= timedelta(hours=24):
            for number, raw_times in party_times.items():
                times = sorted(raw_times)
                after = [t for t in times if t > incident_at]
                tail = [t for t in times if incident_at - timedelta(hours=48) <= t < incident_at]
                if len(tail) >= 5 and not after:
                    score = min(0.88, 0.55 + len(tail) / 50.0)
                    patterns.append(SuspiciousPattern(
                        id="cdr-silence-" + str(len(patterns) + 1),
                        patternType="POST_INCIDENT_SILENCE",
                        title="Activity ceases after reference event",
                        partyA=_mask(number),
                        description=(
                            _mask(number) + " recorded " + str(len(tail)) +
                            " calls in the 48 hours before the reference event and none afterwards, "
                            "although the dataset continues to " + window_end.isoformat(timespec="minutes") + "."
                        ),
                        baselineValue=float(len(tail)),
                        observedValue=0.0,
                        riskScore=round(score, 2),
                        severity=_severity_for(score),
                        window="after " + incident_at.isoformat(timespec="minutes"),
                        evidence=["Uploaded CDR: " + file_name],
                    ))

    # 7. Sustained late-night activity
    for number, count in odd_hour.items():
        total = party_calls.get(number, 0)
        if count >= 5 and total and count / total >= 0.4:
            score = min(0.8, 0.45 + count / 40.0)
            patterns.append(SuspiciousPattern(
                id="cdr-oddhour-" + str(len(patterns) + 1),
                patternType="ODD_HOUR_ACTIVITY",
                title="Concentrated late-night activity",
                partyA=_mask(number),
                description=(
                    str(count) + " of " + str(total) + " outgoing calls from " + _mask(number) +
                    " were placed between 00:00 and 05:00."
                ),
                baselineValue=float(total),
                observedValue=float(count),
                riskScore=round(score, 2),
                severity=_severity_for(score),
                window="00:00 - 05:00",
                evidence=["Uploaded CDR: " + file_name],
            ))

    patterns.sort(key=lambda p: p.riskScore, reverse=True)
    patterns = patterns[:14]

    # Records touching a flagged party are the ones carried forward to the agents.
    flagged = set()
    for p in patterns:
        flagged.add(p.partyA)
        if p.partyB:
            flagged.add(p.partyB)
    relevant = sum(1 for r in records if _mask(r.caller) in flagged or _mask(r.callee) in flagged)

    daily_points = [
        DailyVolumePoint(date=d.isoformat(), calls=c, isIncidentDay=(incident_day is not None and d == incident_day))
        for d, c in sorted(daily.items())
    ]

    if inferred_incident:
        notes.append("Reference-event anchoring is an analytical convenience and is not evidence of timing.")

    return CDRAnalysis(
        fileName=file_name,
        uploadedAt=datetime.utcnow().isoformat(timespec="seconds"),
        totalRecords=len(records) + rejected,
        parsedRecords=len(records),
        rejectedRecords=rejected,
        relevantRecords=relevant,
        filteredOut=max(0, len(records) - relevant),
        uniqueNumbers=len(party_calls),
        windowStart=window_start.isoformat(timespec="minutes") if window_start else None,
        windowEnd=window_end.isoformat(timespec="minutes") if window_end else None,
        incidentReference=incident_at.isoformat(timespec="minutes") if incident_at else None,
        parties=parties[:24],
        links=links,
        patterns=patterns,
        dailyVolume=daily_points,
        columnsDetected=columns,
        notes=notes,
    )
