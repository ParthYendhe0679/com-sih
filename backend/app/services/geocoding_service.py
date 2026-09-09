"""KRITAGAS Centralized Geocoding & Geographic Validation Service.

Provides deterministic coordinate resolution, bounding box verification, and address
normalization for Indian metropolitan investigation loci (Mumbai, Thane, Navi Mumbai,
Pune, Delhi NCR, Bengaluru, Hyderabad, Kolkata).
"""

import re
from typing import Any, Dict, List, Optional, Tuple
from app.core.logging import get_logger

logger = get_logger("kritagas.geocoding")

# Indian Bounding Box boundaries for coordinate sanitization
INDIA_BOUNDS = {
    "min_lat": 6.5,
    "max_lat": 37.5,
    "min_lng": 68.0,
    "max_lng": 97.5,
}

# Maharashtra Metropolitan Core Bounds (Mumbai, Thane, Navi Mumbai, Pune)
MAHARASHTRA_BOUNDS = {
    "min_lat": 18.2,
    "max_lat": 20.0,
    "min_lng": 72.5,
    "max_lng": 74.2,
}

# Curated high-precision Geo-Dictionary of Indian investigation loci
METROPOLITAN_GEO_REGISTRY: Dict[str, Dict[str, Any]] = {
    # ── Bandra Kurla Complex (BKC) & Bandra ────────────────────
    "bkc atm kiosk no 4": {"lat": 19.0664, "lng": 72.8682, "address": "G-Block, Bandra Kurla Complex, Mumbai, Maharashtra 400051", "city": "Mumbai", "confidence": 0.98, "landmark": "BKC ATM Kiosk"},
    "bkc atm": {"lat": 19.0664, "lng": 72.8682, "address": "G-Block, Bandra Kurla Complex, Mumbai, Maharashtra 400051", "city": "Mumbai", "confidence": 0.96, "landmark": "BKC ATM Kiosk"},
    "asian heart hospital": {"lat": 19.0633, "lng": 72.8659, "address": "G-Block, BKC, Bandra East, Mumbai, Maharashtra 400051", "city": "Mumbai", "confidence": 0.97, "landmark": "Asian Heart Hospital Junction"},
    "asian heart hospital junction": {"lat": 19.0633, "lng": 72.8659, "address": "Asian Heart Hospital Junction, BKC, Mumbai 400051", "city": "Mumbai", "confidence": 0.97, "landmark": "Asian Heart Hospital Junction"},
    "bkc cyber police station": {"lat": 19.0682, "lng": 72.8698, "address": "BKC Cyber Police Station, Bandra Kurla Complex, Mumbai 400051", "city": "Mumbai", "confidence": 0.99, "landmark": "BKC Cyber PS"},
    "bandra kurla complex": {"lat": 19.0657, "lng": 72.8687, "address": "Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400051", "city": "Mumbai", "confidence": 0.95, "landmark": "BKC Financial District"},
    "bkc": {"lat": 19.0657, "lng": 72.8687, "address": "Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400051", "city": "Mumbai", "confidence": 0.94, "landmark": "BKC Financial District"},
    "bandra west": {"lat": 19.0596, "lng": 72.8295, "address": "Bandra West, Mumbai, Maharashtra 400050", "city": "Mumbai", "confidence": 0.92, "landmark": "Bandra West"},
    "bandra east": {"lat": 19.0620, "lng": 72.8520, "address": "Bandra East, Mumbai, Maharashtra 400051", "city": "Mumbai", "confidence": 0.92, "landmark": "Bandra East"},
    "bandra station": {"lat": 19.0544, "lng": 72.8402, "address": "Bandra Railway Station, Mumbai 400050", "city": "Mumbai", "confidence": 0.96, "landmark": "Bandra Station"},
    "bandra": {"lat": 19.0596, "lng": 72.8295, "address": "Bandra, Mumbai, Maharashtra", "city": "Mumbai", "confidence": 0.90, "landmark": "Bandra"},

    # ── Andheri & Western Suburbs ──────────────────────────────
    "andheri metro station": {"lat": 19.1197, "lng": 72.8464, "address": "Andheri Metro Station, Line 1, Andheri, Mumbai 400069", "city": "Mumbai", "confidence": 0.98, "landmark": "Andheri Metro Station"},
    "andheri railway station": {"lat": 19.1197, "lng": 72.8464, "address": "Andheri Railway Station, Mumbai 400069", "city": "Mumbai", "confidence": 0.96, "landmark": "Andheri Railway Station"},
    "andheri station": {"lat": 19.1197, "lng": 72.8464, "address": "Andheri Station, Mumbai 400069", "city": "Mumbai", "confidence": 0.95, "landmark": "Andheri Station"},
    "andheri west": {"lat": 19.1363, "lng": 72.8277, "address": "Andheri West, Mumbai, Maharashtra 400058", "city": "Mumbai", "confidence": 0.94, "landmark": "Andheri West"},
    "andheri east": {"lat": 19.1136, "lng": 72.8697, "address": "Andheri East, Mumbai, Maharashtra 400069", "city": "Mumbai", "confidence": 0.94, "landmark": "Andheri East"},
    "andheri": {"lat": 19.1136, "lng": 72.8697, "address": "Andheri, Mumbai, Maharashtra", "city": "Mumbai", "confidence": 0.91, "landmark": "Andheri"},
    "lokhandwala": {"lat": 19.1418, "lng": 72.8258, "address": "Lokhandwala Complex, Andheri West, Mumbai 400053", "city": "Mumbai", "confidence": 0.95, "landmark": "Lokhandwala Complex"},
    "lokhandwala complex": {"lat": 19.1418, "lng": 72.8258, "address": "Lokhandwala Complex, Andheri West, Mumbai 400053", "city": "Mumbai", "confidence": 0.96, "landmark": "Lokhandwala Complex"},
    "juhu": {"lat": 19.1075, "lng": 72.8263, "address": "Juhu, Mumbai, Maharashtra 400049", "city": "Mumbai", "confidence": 0.93, "landmark": "Juhu"},
    "versova": {"lat": 19.1350, "lng": 72.8140, "address": "Versova, Andheri West, Mumbai 400061", "city": "Mumbai", "confidence": 0.93, "landmark": "Versova"},
    "vile parle atm": {"lat": 19.0990, "lng": 72.8440, "address": "ATM Kiosk, Vile Parle East, Mumbai 400057", "city": "Mumbai", "confidence": 0.96, "landmark": "Vile Parle ATM"},
    "vile parle": {"lat": 19.0990, "lng": 72.8440, "address": "Vile Parle, Mumbai, Maharashtra 400057", "city": "Mumbai", "confidence": 0.93, "landmark": "Vile Parle"},
    "santacruz": {"lat": 19.0843, "lng": 72.8360, "address": "Santacruz, Mumbai, Maharashtra 400054", "city": "Mumbai", "confidence": 0.92, "landmark": "Santacruz"},
    "goregaon": {"lat": 19.1663, "lng": 72.8526, "address": "Goregaon, Mumbai, Maharashtra 400063", "city": "Mumbai", "confidence": 0.92, "landmark": "Goregaon"},
    "malad": {"lat": 19.1874, "lng": 72.8484, "address": "Malad, Mumbai, Maharashtra 400064", "city": "Mumbai", "confidence": 0.93, "landmark": "Malad"},
    "malad west": {"lat": 19.1874, "lng": 72.8484, "address": "Malad West, Mumbai, Maharashtra 400064", "city": "Mumbai", "confidence": 0.94, "landmark": "Malad West"},
    "kandivali": {"lat": 19.2062, "lng": 72.8517, "address": "Kandivali, Mumbai, Maharashtra 400067", "city": "Mumbai", "confidence": 0.92, "landmark": "Kandivali"},
    "borivali": {"lat": 19.2307, "lng": 72.8567, "address": "Borivali, Mumbai, Maharashtra 400092", "city": "Mumbai", "confidence": 0.93, "landmark": "Borivali"},
    "dahisar": {"lat": 19.2570, "lng": 72.8590, "address": "Dahisar, Mumbai, Maharashtra 400068", "city": "Mumbai", "confidence": 0.91, "landmark": "Dahisar"},

    # ── Powai & Eastern Suburbs ────────────────────────────────
    "powai": {"lat": 19.1176, "lng": 72.9060, "address": "Powai, Mumbai, Maharashtra 400076", "city": "Mumbai", "confidence": 0.94, "landmark": "Powai Lake District"},
    "hiranandani powai": {"lat": 19.1190, "lng": 72.9120, "address": "Hiranandani Gardens, Powai, Mumbai 400076", "city": "Mumbai", "confidence": 0.96, "landmark": "Hiranandani Powai"},
    "sakinaka": {"lat": 19.0984, "lng": 72.8893, "address": "Sakinaka Junction, Andheri East, Mumbai 400072", "city": "Mumbai", "confidence": 0.93, "landmark": "Sakinaka Metro"},
    "chakala": {"lat": 19.1114, "lng": 72.8617, "address": "Chakala, Andheri East, Mumbai 400099", "city": "Mumbai", "confidence": 0.93, "landmark": "Chakala Industrial Area"},
    "kurla": {"lat": 19.0726, "lng": 72.8845, "address": "Kurla West, Mumbai, Maharashtra 400070", "city": "Mumbai", "confidence": 0.92, "landmark": "Kurla"},
    "ghatkopar": {"lat": 19.0860, "lng": 72.9090, "address": "Ghatkopar, Mumbai, Maharashtra 400086", "city": "Mumbai", "confidence": 0.92, "landmark": "Ghatkopar"},
    "mulund": {"lat": 19.1726, "lng": 72.9565, "address": "Mulund West, Mumbai, Maharashtra 400080", "city": "Mumbai", "confidence": 0.92, "landmark": "Mulund"},
    "chembur": {"lat": 19.0522, "lng": 72.8994, "address": "Chembur, Mumbai, Maharashtra 400071", "city": "Mumbai", "confidence": 0.92, "landmark": "Chembur"},

    # ── South & Central Mumbai ─────────────────────────────────
    "nariman point": {"lat": 18.9260, "lng": 72.8238, "address": "Nariman Point, Mumbai, Maharashtra 400021", "city": "Mumbai", "confidence": 0.96, "landmark": "Nariman Point Financial District"},
    "colaba": {"lat": 18.9067, "lng": 72.8147, "address": "Colaba, Mumbai, Maharashtra 400005", "city": "Mumbai", "confidence": 0.94, "landmark": "Colaba"},
    "dadar": {"lat": 19.0178, "lng": 72.8478, "address": "Dadar West, Mumbai, Maharashtra 400028", "city": "Mumbai", "confidence": 0.94, "landmark": "Dadar TT"},
    "worli": {"lat": 19.0166, "lng": 72.8185, "address": "Worli, Mumbai, Maharashtra 400018", "city": "Mumbai", "confidence": 0.93, "landmark": "Worli"},
    "lower parel": {"lat": 18.9953, "lng": 72.8310, "address": "Lower Parel, Mumbai, Maharashtra 400013", "city": "Mumbai", "confidence": 0.94, "landmark": "Lower Parel Mills"},
    "fort mumbai": {"lat": 18.9322, "lng": 72.8347, "address": "Fort, Mumbai, Maharashtra 400001", "city": "Mumbai", "confidence": 0.93, "landmark": "Fort Financial Area"},
    "mumbai": {"lat": 19.0760, "lng": 72.8777, "address": "Mumbai Metropolitan Region, Maharashtra", "city": "Mumbai", "confidence": 0.85, "landmark": "Mumbai Capital"},

    # ── Thane Commissionerate ──────────────────────────────────
    "ram maruti road": {"lat": 19.1914, "lng": 72.9732, "address": "Ram Maruti Road, Naupada, Thane West, Maharashtra 400602", "city": "Thane", "confidence": 0.97, "landmark": "Ram Maruti Road Commercial"},
    "naupada police station": {"lat": 19.1895, "lng": 72.9715, "address": "Naupada Police Station, Thane West, Maharashtra 400602", "city": "Thane", "confidence": 0.98, "landmark": "Naupada PS"},
    "naupada market": {"lat": 19.1905, "lng": 72.9720, "address": "Naupada Market, Thane West 400602", "city": "Thane", "confidence": 0.95, "landmark": "Naupada Market"},
    "naupada": {"lat": 19.1895, "lng": 72.9715, "address": "Naupada, Thane West, Maharashtra 400602", "city": "Thane", "confidence": 0.94, "landmark": "Naupada"},
    "panch pakhadi": {"lat": 19.1978, "lng": 72.9642, "address": "Panch Pakhadi, Thane West, Maharashtra 400602", "city": "Thane", "confidence": 0.95, "landmark": "Panch Pakhadi Residential"},
    "majiwada junction": {"lat": 19.2135, "lng": 72.9810, "address": "Majiwada Flyover Junction, Eastern Express Highway, Thane 400601", "city": "Thane", "confidence": 0.97, "landmark": "Majiwada Junction"},
    "majiwada flyover": {"lat": 19.2135, "lng": 72.9810, "address": "Majiwada Flyover, Thane 400601", "city": "Thane", "confidence": 0.96, "landmark": "Majiwada Flyover"},
    "majiwada": {"lat": 19.2135, "lng": 72.9810, "address": "Majiwada, Thane West, Maharashtra 400601", "city": "Thane", "confidence": 0.93, "landmark": "Majiwada"},
    "kopri colony": {"lat": 19.1812, "lng": 72.9805, "address": "Kopri Colony, Thane East, Maharashtra 400603", "city": "Thane", "confidence": 0.96, "landmark": "Kopri Colony"},
    "kopri police station": {"lat": 19.1820, "lng": 72.9790, "address": "Kopri Police Station, Thane East 400603", "city": "Thane", "confidence": 0.98, "landmark": "Kopri PS"},
    "kopri": {"lat": 19.1812, "lng": 72.9805, "address": "Kopri, Thane East, Maharashtra 400603", "city": "Thane", "confidence": 0.93, "landmark": "Kopri"},
    "anand nagar commercial complex": {"lat": 19.1825, "lng": 72.9815, "address": "Shop No. 4, Anand Nagar Complex, Kopri, Thane East 400603", "city": "Thane", "confidence": 0.97, "landmark": "Anand Nagar Complex"},
    "anand nagar": {"lat": 19.1825, "lng": 72.9815, "address": "Anand Nagar, Kopri, Thane East 400603", "city": "Thane", "confidence": 0.92, "landmark": "Anand Nagar Kopri"},
    "thane west": {"lat": 19.2183, "lng": 72.9781, "address": "Thane West, Maharashtra 400601", "city": "Thane", "confidence": 0.92, "landmark": "Thane West"},
    "thane east": {"lat": 19.1860, "lng": 72.9840, "address": "Thane East, Maharashtra 400603", "city": "Thane", "confidence": 0.92, "landmark": "Thane East"},
    "ghodbunder road": {"lat": 19.2610, "lng": 72.9550, "address": "Ghodbunder Road, Thane West 400607", "city": "Thane", "confidence": 0.92, "landmark": "Ghodbunder Highway"},
    "thane": {"lat": 19.2183, "lng": 72.9781, "address": "Thane City, Maharashtra", "city": "Thane", "confidence": 0.89, "landmark": "Thane Commissionerate"},

    # ── Navi Mumbai ────────────────────────────────────────────
    "vashi": {"lat": 19.0771, "lng": 72.9986, "address": "Vashi, Navi Mumbai, Maharashtra 400703", "city": "Navi Mumbai", "confidence": 0.93, "landmark": "Vashi Center"},
    "belapur": {"lat": 19.0190, "lng": 73.0410, "address": "CBD Belapur, Navi Mumbai 400614", "city": "Navi Mumbai", "confidence": 0.93, "landmark": "CBD Belapur"},
    "nerul": {"lat": 19.0330, "lng": 73.0180, "address": "Nerul, Navi Mumbai, Maharashtra 400706", "city": "Navi Mumbai", "confidence": 0.92, "landmark": "Nerul"},
    "kharghar": {"lat": 19.0473, "lng": 73.0699, "address": "Kharghar, Navi Mumbai 410210", "city": "Navi Mumbai", "confidence": 0.92, "landmark": "Kharghar Valley"},
    "navi mumbai": {"lat": 19.0771, "lng": 72.9986, "address": "Navi Mumbai, Maharashtra", "city": "Navi Mumbai", "confidence": 0.88, "landmark": "Navi Mumbai"},

    # ── Pune ───────────────────────────────────────────────────
    "shivajinagar": {"lat": 18.5314, "lng": 73.8446, "address": "Shivajinagar, Pune, Maharashtra 411005", "city": "Pune", "confidence": 0.94, "landmark": "Shivajinagar"},
    "hinjawadi": {"lat": 18.5913, "lng": 73.7389, "address": "Hinjawadi IT Park, Pune, Maharashtra 411057", "city": "Pune", "confidence": 0.95, "landmark": "Hinjawadi IT Park"},
    "kothrud": {"lat": 18.5074, "lng": 73.8077, "address": "Kothrud, Pune, Maharashtra 411038", "city": "Pune", "confidence": 0.93, "landmark": "Kothrud"},
    "viman nagar": {"lat": 18.5679, "lng": 73.9143, "address": "Viman Nagar, Pune, Maharashtra 411014", "city": "Pune", "confidence": 0.93, "landmark": "Viman Nagar"},
    "pune": {"lat": 18.5204, "lng": 73.8567, "address": "Pune, Maharashtra", "city": "Pune", "confidence": 0.88, "landmark": "Pune City"},

    # ── National Metros (Cybercrime / Inter-State Links) ──────
    "connaught place": {"lat": 28.6315, "lng": 77.2167, "address": "Connaught Place, New Delhi 110001", "city": "New Delhi", "confidence": 0.95, "landmark": "Connaught Place"},
    "cyber city": {"lat": 28.4950, "lng": 77.0890, "address": "DLF Cyber City, Gurugram, Haryana 122002", "city": "Gurugram", "confidence": 0.96, "landmark": "DLF Cyber City"},
    "koramangala": {"lat": 12.9352, "lng": 77.6245, "address": "Koramangala, Bengaluru, Karnataka 560034", "city": "Bengaluru", "confidence": 0.94, "landmark": "Koramangala Tech Hub"},
    "indiranagar": {"lat": 12.9784, "lng": 77.6408, "address": "Indiranagar, Bengaluru, Karnataka 560038", "city": "Bengaluru", "confidence": 0.94, "landmark": "Indiranagar"},
    "hitec city": {"lat": 17.4435, "lng": 78.3772, "address": "HITEC City, Hyderabad, Telangana 500081", "city": "Hyderabad", "confidence": 0.95, "landmark": "HITEC City"},
    "salt lake": {"lat": 22.5867, "lng": 88.4170, "address": "Salt Lake Sector V, Kolkata, West Bengal 700091", "city": "Kolkata", "confidence": 0.94, "landmark": "Salt Lake Sector V"},
    "delhi": {"lat": 28.6139, "lng": 77.2090, "address": "New Delhi, Delhi", "city": "Delhi", "confidence": 0.85, "landmark": "National Capital Territory"},
    "bengaluru": {"lat": 12.9716, "lng": 77.5946, "address": "Bengaluru, Karnataka", "city": "Bengaluru", "confidence": 0.85, "landmark": "Bengaluru"},
    "hyderabad": {"lat": 17.3850, "lng": 78.4867, "address": "Hyderabad, Telangana", "city": "Hyderabad", "confidence": 0.85, "landmark": "Hyderabad"},
    "kolkata": {"lat": 22.5726, "lng": 88.3639, "address": "Kolkata, West Bengal", "city": "Kolkata", "confidence": 0.85, "landmark": "Kolkata"},
}


class GeocodingService:
    """Service validating, normalizing, and geocoding investigation loci into geo-coordinates."""

    def __init__(self):
        self.registry = METROPOLITAN_GEO_REGISTRY

    @staticmethod
    def is_valid_coordinates(lat: Optional[float], lng: Optional[float]) -> bool:
        """Strict coordinate range and finiteness verification."""
        if lat is None or lng is None:
            return False
        try:
            f_lat = float(lat)
            f_lng = float(lng)
        except (ValueError, TypeError):
            return False

        # Physical Earth bounds
        if not (-90.0 <= f_lat <= 90.0 and -180.0 <= f_lng <= 180.0):
            return False

        # Check against India geographical bounds
        if not (INDIA_BOUNDS["min_lat"] <= f_lat <= INDIA_BOUNDS["max_lat"] and
                INDIA_BOUNDS["min_lng"] <= f_lng <= INDIA_BOUNDS["max_lng"]):
            return False

        return True

    @staticmethod
    def clean_query(text: str) -> str:
        """Normalizes location string by stripping punctuation, extra spaces, and common stop-phrases."""
        if not text:
            return ""
        # Remove parentheses, brackets, colons, semicolons
        t = re.sub(r"[()\[\]:;,\-]", " ", text)
        t = re.sub(r"\s+", " ", t).strip().lower()
        return t

    def geocode(self, location_query: str, context: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Geocode a location query string into structured coordinates and metadata.
        
        Returns:
            Dict containing latitude, longitude, address, city, confidence, landmark name
            or None if the location is unresolvable.
        """
        if not location_query or len(location_query.strip()) < 2:
            return None

        clean = self.clean_query(location_query)

        # 1. Exact or Substring match against Registry (Ordered by length descending for maximal match)
        sorted_keys = sorted(self.registry.keys(), key=len, reverse=True)
        for key in sorted_keys:
            if key in clean or clean in key:
                data = self.registry[key]
                return {
                    "latitude": data["lat"],
                    "longitude": data["lng"],
                    "address": data["address"],
                    "city": data["city"],
                    "confidence": data["confidence"],
                    "landmark": data["landmark"],
                    "resolved_name": data["landmark"],
                    "geocoded": True,
                    "source": "METROPOLITAN_GEO_REGISTRY",
                    "status": "VALIDATED",
                }

        # 2. Tokenized word-boundary overlap match
        tokens = [t for t in clean.split() if len(t) >= 4]
        for token in tokens:
            for key in sorted_keys:
                if token in key:
                    data = self.registry[key]
                    return {
                        "latitude": data["lat"],
                        "longitude": data["lng"],
                        "address": data["address"],
                        "city": data["city"],
                        "confidence": round(data["confidence"] * 0.90, 2),
                        "landmark": data["landmark"],
                        "resolved_name": data["landmark"],
                        "geocoded": True,
                        "source": "TOKEN_MATCHED_REGISTRY",
                        "status": "VALIDATED",
                    }

        logger.debug(f"[GEOCODE_UNRESOLVED] Location could not be resolved: '{location_query}'")
        return None

    def validate_or_fallback(
        self,
        name: str,
        explicit_lat: Optional[float] = None,
        explicit_lng: Optional[float] = None,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Validates provided explicit coordinates or falls back to internal geocoding."""
        if self.is_valid_coordinates(explicit_lat, explicit_lng):
            return {
                "latitude": float(explicit_lat),  # type: ignore
                "longitude": float(explicit_lng),  # type: ignore
                "address": name,
                "city": "Metropolitan Region",
                "confidence": 0.95,
                "landmark": name,
                "resolved_name": name,
                "geocoded": True,
                "source": "EXPLICIT_COORDINATES",
                "status": "VALIDATED",
            }

        geocoded = self.geocode(name, context=context)
        if geocoded:
            return geocoded

        return {
            "latitude": None,
            "longitude": None,
            "address": name,
            "city": "Unknown",
            "confidence": 0.0,
            "landmark": name,
            "resolved_name": name,
            "geocoded": False,
            "source": "UNRESOLVED",
            "status": "identified_without_coordinates",
        }


geocoding_service = GeocodingService()
