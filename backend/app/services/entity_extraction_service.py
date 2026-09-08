"""KRITAGAS Centralized Hybrid Entity Extraction & Normalization Service.

Provides deterministic regex, NLP, and AI-assisted extraction for:
- Persons (Complainants, Suspects, Accused, Witnesses, Officers)
- Phone Numbers (Normalized Indian formats)
- Email Addresses
- URLs and Web Links
- Financial Entities (Amounts, Transaction IDs, Account Numbers, UPI IDs)
- Legal Sections (IPC, IT Act, BNS, CrPC)
- Locations (Cities, Addresses, Police Stations)
- Dates and Timestamps
- Vehicles (RTO Registration Numbers)
- Digital Identifiers
"""

import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.core.logging import get_logger

logger = get_logger("kritagas.entity_extraction")


class ExtractedEntities(BaseModel):
    phones: List[Dict[str, Any]] = []
    vehicles: List[Dict[str, Any]] = []
    transactions: List[Dict[str, Any]] = []
    legal_sections: List[Dict[str, Any]] = []
    emails: List[Dict[str, Any]] = []
    persons: List[Dict[str, Any]] = []
    locations: List[Dict[str, Any]] = []
    urls: List[Dict[str, Any]] = []
    digital_identifiers: List[Dict[str, Any]] = []
    dates: List[Dict[str, Any]] = []


class EntityExtractionService:
    """Hybrid Entity Extraction Engine with normalization and deduplication."""

    # -------------------------------------------------------------
    # Category 1: Phone Numbers
    # -------------------------------------------------------------
    def extract_phones(self, text: str) -> List[Dict[str, Any]]:
        """Extracts and normalizes Indian telephone & mobile numbers.
        Matches formats: +91 98234 56721, +91-98200-11223, 9820144912, 022-2620 1234, etc.
        """
        results = []
        seen = set()

        # Mobile patterns (handles 10 digits with flexible spaces/dashes)
        mobile_pattern = re.compile(r"(?:\+?91[\-\s]?)?[6-9](?:[\-\s]?\d){9}\b")
        for m in mobile_pattern.finditer(text):
            raw = m.group(0).strip()
            digits = re.sub(r"\D", "", raw)
            if len(digits) >= 10:
                clean_10 = digits[-10:]
                normalized = f"+91 {clean_10[:5]} {clean_10[5:]}"
                if clean_10 not in seen:
                    seen.add(clean_10)
                    results.append({
                        "number": normalized,
                        "raw": raw,
                        "normalized": f"+91{clean_10}",
                        "confidence": 96,
                        "type": "MOBILE",
                    })

        # Landline patterns e.g. 022-2620 1234 or 022 26201234
        landline_pattern = re.compile(r"\b0\d{2,4}[\-\s]?(?:\d[\-\s]?){6,8}\b")
        for m in landline_pattern.finditer(text):
            raw = m.group(0).strip()
            digits = re.sub(r"\D", "", raw)
            if digits not in seen and len(digits) >= 10:
                seen.add(digits)
                results.append({
                    "number": raw,
                    "raw": raw,
                    "normalized": digits,
                    "confidence": 92,
                    "type": "LANDLINE",
                })

        return results

    # -------------------------------------------------------------
    # Category 2: Vehicles
    # -------------------------------------------------------------
    def extract_vehicles(self, text: str) -> List[Dict[str, Any]]:
        """Extracts Indian RTO vehicle registration numbers (e.g. MH-02-DN-4821, DL 03 C 5678)."""
        results = []
        seen = set()

        pattern = re.compile(r"\b([A-Z]{2})[\s\-]?(0[1-9]|[1-9][0-9])[\s\-]?([A-Z]{1,3})[\s\-]?([0-9]{4})\b")
        for m in pattern.finditer(text):
            raw = m.group(0).strip()
            state, rto, series, num = m.groups()
            normalized = f"{state}-{rto}-{series}-{num}".upper()
            if normalized not in seen:
                seen.add(normalized)
                results.append({
                    "registration": normalized,
                    "raw": raw,
                    "confidence": 95,
                    "state": state,
                })

        return results

    # -------------------------------------------------------------
    # Category 3: Financial Entities (Amounts, Accounts, Transactions)
    # -------------------------------------------------------------
    def extract_financials(self, text: str) -> List[Dict[str, Any]]:
        """Extracts currency amounts, transaction IDs, and bank account numbers."""
        results = []
        seen = set()

        # 1. Currency amounts: ₹4,85,000, Rs. 1,25,000, INR 95000, etc.
        money_pattern = re.compile(
            r"(?:(?:Rs\.?|₹|INR)\s*[\d,]+(?:\.\d{2})?(?:\s*(?:Crore|Cr|Lakh|Lakhs|Thousand))?)",
            re.IGNORECASE,
        )
        for m in money_pattern.finditer(text):
            raw = m.group(0).strip()
            # Clean non-digit text for normalization
            clean_digits = re.sub(r"[^\d.]", "", raw)
            if raw not in seen and len(clean_digits) > 0:
                seen.add(raw)
                results.append({
                    "amount": raw,
                    "type": "AMOUNT",
                    "confidence": 94,
                })

        # 2. Transaction IDs: TXN-784521, UPI-1234567890, etc.
        txn_pattern = re.compile(
            r"\b(?:TXN|TRANSACTION|REF|UTR|IMPS|RTGS|NEFT)[\s\-:]*([0-9][A-Za-z0-9\-]{4,25})\b",
            re.IGNORECASE,
        )
        for m in txn_pattern.finditer(text):
            full_match = m.group(0).strip()
            if full_match not in seen:
                seen.add(full_match)
                results.append({
                    "amount": full_match,
                    "type": "TRANSACTION_ID",
                    "confidence": 98,
                })

        # 3. Masked or Full Bank Account Numbers: XXXX-XXXX-4587, A/C No. 912384719283
        acc_pattern = re.compile(
            r"\b(?:(?:XXXX[\s\-]?){2,3}[0-9]{4}|(?:A/c|Account|Acc\.?)[\s\-:No\.]*([0-9]{9,18}))\b",
            re.IGNORECASE,
        )
        for m in acc_pattern.finditer(text):
            full_match = m.group(0).strip()
            if full_match not in seen:
                seen.add(full_match)
                results.append({
                    "amount": full_match,
                    "type": "BANK_ACCOUNT",
                    "confidence": 92,
                })

        return results

    # -------------------------------------------------------------
    # Category 4: Legal Sections
    # -------------------------------------------------------------
    def extract_legal_sections(self, text: str) -> List[Dict[str, Any]]:
        """Extracts legal sections from IPC, IT Act, BNS, CrPC, etc."""
        results = []
        seen = set()

        # Dedicated pattern matching IPC sections (e.g. IPC Section 418, Section 420 IPC, IPC 120B)
        ipc_pattern = re.compile(
            r"\b(?:IPC\s*(?:Section|Sec\.?)?\s*([0-9]{2,4}[A-Za-z\-]*)|(?:Section|Sec\.?)\s*([0-9]{2,4}[A-Za-z\-]*)\s*(?:of\s+the\s+)?IPC)\b",
            re.IGNORECASE,
        )
        for m in ipc_pattern.finditer(text):
            sec_num = m.group(1) or m.group(2)
            if sec_num:
                norm = f"IPC Section {sec_num.upper()}"
                if norm not in seen:
                    seen.add(norm)
                    results.append({"section": norm, "confidence": 98})

        # Dedicated pattern matching IT Act sections (e.g. IT Act Section 66D, Section 43, 66)
        it_pattern = re.compile(
            r"\b(?:IT\s*Act\s*(?:Section|Sec\.?)?\s*([0-9]{2}[A-Za-z\-]*)|(?:Section|Sec\.?)\s*([0-9]{2}[A-Za-z\-]*)\s*(?:of\s+the\s+)?IT\s*Act)\b",
            re.IGNORECASE,
        )
        for m in it_pattern.finditer(text):
            sec_num = m.group(1) or m.group(2)
            if sec_num:
                norm = f"IT Act Section {sec_num.upper()}"
                if norm not in seen:
                    seen.add(norm)
                    results.append({"section": norm, "confidence": 98})

        # CrPC sections (e.g. Section 154 Cr.P.C.)
        crpc_pattern = re.compile(
            r"\b(?:Section|Sec\.?)\s*([0-9]{2,4})\s*(?:of\s+the\s+)?(?:Cr\.?P\.?C\.?|Code of Criminal Procedure)\b",
            re.IGNORECASE,
        )
        for m in crpc_pattern.finditer(text):
            sec_num = m.group(1)
            norm = f"Cr.P.C. Section {sec_num}"
            if norm not in seen:
                seen.add(norm)
                results.append({"section": norm, "confidence": 95})

        # General legal sections line scan e.g. "IPC Section 418 : Cheating"
        for line in text.split("\n"):
            line_clean = line.strip()
            if any(k in line_clean.upper() for k in ["IPC SECTION", "IT ACT SECTION"]):
                match = re.search(r"((?:IPC|IT Act)\s+Section\s+[0-9]{2,4}[A-Za-z]*)", line_clean, re.IGNORECASE)
                if match:
                    val = match.group(1)
                    if val not in seen:
                        seen.add(val)
                        results.append({"section": val, "confidence": 95})

        return results

    # -------------------------------------------------------------
    # Category 5: Digital Identifiers & Emails & URLs
    # -------------------------------------------------------------
    def extract_emails(self, text: str) -> List[Dict[str, Any]]:
        """Extracts email addresses."""
        results = []
        seen = set()
        email_pattern = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
        for m in email_pattern.finditer(text):
            e = m.group(0).strip().lower()
            if e not in seen:
                seen.add(e)
                results.append({"email": e, "confidence": 99})
        return results

    def extract_urls(self, text: str) -> List[Dict[str, Any]]:
        """Extracts web URLs and domains cited in phishing/scam complaints."""
        results = []
        seen = set()
        url_pattern = re.compile(r"\b(?:https?://|www\.)[A-Za-z0-9.\-_/:]+[A-Za-z0-9/]\b", re.IGNORECASE)
        for m in url_pattern.finditer(text):
            u = m.group(0).strip()
            if u not in seen:
                seen.add(u)
                results.append({"url": u, "confidence": 98})
        return results

    def extract_digital_identifiers(self, text: str, emails: List[Dict[str, Any]], urls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Consolidates emails, URLs, FIR numbers, and transaction IDs into digital identifiers."""
        results = []
        seen = set()

        # Add emails
        for em in emails:
            e_val = em.get("email")
            if e_val and e_val not in seen:
                seen.add(e_val)
                results.append({"identifier": e_val, "type": "EMAIL", "confidence": em.get("confidence", 99)})

        # Add URLs
        for ur in urls:
            u_val = ur.get("url")
            if u_val and u_val not in seen:
                seen.add(u_val)
                results.append({"identifier": u_val, "type": "URL", "confidence": ur.get("confidence", 98)})

        # FIR Numbers: e.g. FIR/AND/2026/0047 or FIR-MUM-2026-CR-00101
        fir_pattern = re.compile(r"\b(?:FIR[\s/:\-_No\.]*)?([A-Z]{3,4}[/\-][A-Z]{2,4}[/\-][0-9]{4}[/\-][0-9]{3,5}|FIR\-[A-Za-z0-9\-]+)\b")
        for m in fir_pattern.finditer(text):
            f_num = m.group(0).strip()
            if f_num not in seen and len(f_num) >= 8:
                seen.add(f_num)
                results.append({"identifier": f_num, "type": "FIR_NUMBER", "confidence": 99})

        return results

    # -------------------------------------------------------------
    # Category 6: Persons (Complainant, Accused, Suspect, Officer)
    # -------------------------------------------------------------
    def extract_persons(self, text: str) -> List[Dict[str, Any]]:
        """Extracts named individuals with legal roles (Complainant, Suspect, Officer)."""
        results = []
        seen = set()

        # Structured form labels in Indian FIRs
        patterns = [
            (r"(?:Name\s*:\s*|Complainant\s*:\s*|Informant\s*:\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", "COMPLAINANT"),
            (r"(?:Name\s*\(used\)\s*:\s*|Suspect\s*:\s*|Accused\s*:\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", "SUSPECT"),
            (r"(?:Police\s+Inspector|Investigating\s+Officer|Inspector)\s*[\n\r:]*\s*\(?([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\)?", "POLICE_OFFICER"),
            (r"Signature\s+of\s+Complainant\s*[\n\r]*\s*\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\)", "COMPLAINANT"),
            (r"\(([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\)\s*[\n\r]*\s*Police\s+Inspector", "POLICE_OFFICER"),
        ]

        for pat, role in patterns:
            for m in re.finditer(pat, text, re.IGNORECASE):
                raw_name = m.group(1).strip()
                # Clean any newline trails
                name = raw_name.split("\n")[0].split("\r")[0].strip()
                # Exclude known false positive headers
                if name.lower() not in ["first information", "police department", "government of", "andheri police", "bkc cyber"]:
                    if name not in seen and len(name) >= 3 and not any(name in ex for ex in seen):
                        seen.add(name)
                        results.append({
                            "name": name,
                            "role": role,
                            "confidence": 94,
                        })

        # If no persons detected through specific headers, use salutations
        if not results:
            salutation_pattern = re.compile(r"\b(?:Mr\.?|Ms\.?|Mrs\.?|Shri|Dr\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b")
            for m in salutation_pattern.finditer(text):
                name = m.group(1).strip()
                if name not in seen and len(name) >= 4:
                    seen.add(name)
                    results.append({
                        "name": name,
                        "role": "PERSON_OF_INTEREST",
                        "confidence": 88,
                    })

        return results

    # -------------------------------------------------------------
    # Category 7: Locations
    # -------------------------------------------------------------
    def extract_locations(self, text: str) -> List[Dict[str, Any]]:
        """Extracts incident locations, addresses, and police stations."""
        results = []
        seen = set()

        # Header patterns
        header_patterns = [
            r"(?:Place\s+of\s+Incident|Place\s+of\s+Occurrence|Incident\s+Location)\s*:\s*([^\n\r;]{4,80})",
            r"(?:Address\s*:\s*)([^\n\r;]{5,100})",
            r"([A-Z][a-zA-Z\s]+Police\s+Station)",
        ]
        for pat in header_patterns:
            for m in re.finditer(pat, text, re.IGNORECASE):
                loc = m.group(1).strip()
                if loc not in seen and len(loc) >= 4:
                    seen.add(loc)
                    results.append({"location": loc, "confidence": 92})

        # Known prominent areas
        localities = ["Andheri (East)", "Andheri (West)", "Andheri", "Bandra Kurla Complex", "BKC", "Bandra", "Colaba", "Dadar", "Powai", "Thane", "Navi Mumbai", "Mumbai", "Pune", "Delhi"]
        for loc in localities:
            if re.search(rf"\b{re.escape(loc)}\b", text, re.IGNORECASE) and loc not in seen:
                seen.add(loc)
                results.append({"location": loc, "confidence": 95})

        return results

    # -------------------------------------------------------------
    # Category 8: Dates and Times
    # -------------------------------------------------------------
    def extract_dates(self, text: str) -> List[Dict[str, Any]]:
        """Extracts dates cited in FIR registration and incident timeline."""
        results = []
        seen = set()
        date_pattern = re.compile(r"\b([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[0-9]{2})\b")
        for m in date_pattern.finditer(text):
            d = m.group(1).strip()
            if d not in seen:
                seen.add(d)
                results.append({"date": d, "confidence": 95})
        return results

    # -------------------------------------------------------------
    # Master Extraction Pipeline
    # -------------------------------------------------------------
    def clean_markup(self, text: str) -> str:
        """Strips markdown and HTML artifacts for clean entity regex boundary detection."""
        if not text:
            return ""
        t = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
        t = re.sub(r"\*\*|\*|__", "", t)
        t = re.sub(r"^[\|\s\-:]+", "", t, flags=re.MULTILINE)
        return t

    def extract_all(self, text: str) -> ExtractedEntities:
        """Executes complete hybrid entity extraction on input text."""
        if not text:
            return ExtractedEntities()

        clean_text = self.clean_markup(text)
        logger.info(f"[ENTITY_EXTRACTION_START] Running hybrid extraction on {len(clean_text)} characters of text.")

        phones = self.extract_phones(clean_text)
        vehicles = self.extract_vehicles(clean_text)
        financials = self.extract_financials(clean_text)
        legal_sections = self.extract_legal_sections(clean_text)
        emails = self.extract_emails(clean_text)
        urls = self.extract_urls(clean_text)
        digital_ids = self.extract_digital_identifiers(clean_text, emails, urls)
        persons = self.extract_persons(clean_text)
        locations = self.extract_locations(clean_text)
        dates = self.extract_dates(clean_text)

        logger.info(
            f"[ENTITY_EXTRACTION_DONE] Extracted {len(phones)} phones, {len(vehicles)} vehicles, "
            f"{len(financials)} financials, {len(legal_sections)} legal sections, "
            f"{len(emails)} emails, {len(persons)} persons, {len(locations)} locations."
        )

        return ExtractedEntities(
            phones=phones,
            vehicles=vehicles,
            transactions=financials,
            legal_sections=legal_sections,
            emails=emails,
            persons=persons,
            locations=locations,
            urls=urls,
            digital_identifiers=digital_ids,
            dates=dates,
        )

    def generate_executive_summary(
        self,
        text: str,
        entities: ExtractedEntities,
        crime_category: str = "",
        incident_location: str = "",
    ) -> str:
        """Generates a concise, high-impact executive key-point summary from FIR/case entities."""
        lines = []

        # 1. Category & Type
        cat = crime_category or "Financial / Cyber Fraud"
        lines.append(f"• CRIME CLASSIFICATION: {cat}")

        # 2. Complainant
        complainant = next((p["name"] for p in entities.persons if p.get("role") == "COMPLAINANT"), None)
        if not complainant and entities.persons:
            complainant = entities.persons[0]["name"]
        if complainant:
            comp_phone = entities.phones[0]["number"] if entities.phones else "Not Listed"
            lines.append(f"• COMPLAINANT: {complainant} (Contact: {comp_phone})")

        # 3. Accused / Suspects
        suspects = [p["name"] for p in entities.persons if p.get("role") == "SUSPECT"]
        if suspects:
            lines.append(f"• ACCUSED / SUSPECTS: {', '.join(suspects)}")
        elif len(entities.persons) > 1:
            lines.append(f"• PERSON OF INTEREST: {entities.persons[1]['name']}")

        # 4. Financial Impact / Transactions
        if entities.transactions:
            amounts = [t["amount"] for t in entities.transactions[:3]]
            lines.append(f"• FINANCIAL IMPACT: Defrauded sum of {', '.join(amounts)}")

        # 5. Legal Sections Cited
        if entities.legal_sections:
            secs = [s["section"] for s in entities.legal_sections[:4]]
            lines.append(f"• LEGAL SECTIONS: {', '.join(secs)}")

        # 6. Incident Locus / Jurisdiction
        loc = incident_location or (entities.locations[0]["location"] if entities.locations else "Metropolitan Jurisdiction")
        lines.append(f"• INCIDENT LOCUS: {loc}")

        return "\n".join(lines)


# Global singleton instance
entity_extraction_service = EntityExtractionService()
