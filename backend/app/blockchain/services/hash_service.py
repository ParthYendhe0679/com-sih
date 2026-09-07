"""SHA-256 evidence hashing service.

Provides deterministic cryptographic hashing for all evidence types:
files, text, structured JSON objects, and composite evidence records.
"""

import hashlib
import json
from typing import Any, Dict, Optional, Union

from app.core.logging import get_logger

logger = get_logger("kritagas.blockchain.hash")


class EvidenceHashService:
    """Stateless service generating deterministic SHA-256 hashes for evidence integrity."""

    @staticmethod
    def hash_bytes(data: bytes) -> str:
        """Generate SHA-256 hex digest from raw bytes."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def hash_text(text: str) -> str:
        """Generate SHA-256 hex digest from a text string (UTF-8 encoded)."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    @staticmethod
    def hash_file(file_bytes: bytes) -> str:
        """Generate SHA-256 hex digest from file content bytes."""
        return hashlib.sha256(file_bytes).hexdigest()

    @staticmethod
    def hash_json(data: Any) -> str:
        """Generate deterministic SHA-256 hash from a JSON-serializable object.

        Uses canonical JSON (sorted keys, no extra whitespace) to ensure
        the same logical data always produces the same hash regardless
        of key ordering or formatting.
        """
        canonical = json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def hash_evidence_metadata(
        evidence_id: str,
        file_hash: Optional[str],
        title: str,
        evidence_type: str,
        file_name: str,
        case_id: Optional[str] = None,
        fir_id: Optional[str] = None,
    ) -> str:
        """Generate a composite hash from evidence metadata fields.

        This creates a deterministic fingerprint of the evidence record's
        key attributes, independent of the actual file content.
        """
        composite = {
            "evidence_id": str(evidence_id),
            "file_hash": file_hash or "",
            "title": title,
            "evidence_type": evidence_type,
            "file_name": file_name,
            "case_id": str(case_id) if case_id else "",
            "fir_id": str(fir_id) if fir_id else "",
        }
        canonical = json.dumps(composite, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def hash_fir(
        fir_id: str,
        fir_number: str,
        title: str,
        description: str,
        crime_category: str,
        incident_location: str,
    ) -> str:
        """Generate a composite hash from FIR core fields."""
        composite = {
            "fir_id": str(fir_id),
            "fir_number": fir_number,
            "title": title,
            "description": description,
            "crime_category": crime_category,
            "incident_location": incident_location,
        }
        canonical = json.dumps(composite, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def hash_case(
        case_id: str,
        case_number: str,
        title: str,
        description: str,
        crime_category: str,
    ) -> str:
        """Generate a composite hash from Case core fields."""
        composite = {
            "case_id": str(case_id),
            "case_number": case_number,
            "title": title,
            "description": description,
            "crime_category": crime_category,
        }
        canonical = json.dumps(composite, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def hash_ai_report(
        case_id: str,
        report_type: str,
        content: str,
    ) -> str:
        """Generate SHA-256 hash for an AI-generated investigation report."""
        composite = {
            "case_id": str(case_id),
            "report_type": report_type,
            "content": content,
        }
        canonical = json.dumps(composite, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def verify_hash(current_data: Union[str, bytes], expected_hash: str) -> bool:
        """Verify that current data matches an expected SHA-256 hash.

        Args:
            current_data: The data to hash (string or bytes).
            expected_hash: The expected SHA-256 hex digest.

        Returns:
            True if hashes match (data integrity verified), False otherwise.
        """
        if isinstance(current_data, bytes):
            current_hash = hashlib.sha256(current_data).hexdigest()
        else:
            current_hash = hashlib.sha256(current_data.encode("utf-8")).hexdigest()
        return current_hash == expected_hash
