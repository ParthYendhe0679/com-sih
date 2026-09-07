"""General utility functions and identifier generators."""

from datetime import datetime, timezone
import hashlib
import secrets


def generate_fir_number() -> str:
    """Generate a unique FIR tracking number formatted as FIR-YYYY-XXXX."""
    year = datetime.now(timezone.utc).year
    random_suffix = secrets.token_hex(2).upper()  # 4 characters hex
    random_num = secrets.randbelow(9000) + 1000   # 4 digit number
    return f"FIR-{year}-{random_num}{random_suffix[:2]}"


def generate_case_number() -> str:
    """Generate a unique Case investigation number formatted as CASE-YYYY-XXXX."""
    year = datetime.now(timezone.utc).year
    random_num = secrets.randbelow(90000) + 10000  # 5 digit number
    return f"CASE-{year}-{random_num}"


def calculate_sha256(content: bytes) -> str:
    """Calculate cryptographic SHA-256 hash of binary content for chain-of-custody verification."""
    return hashlib.sha256(content).hexdigest()
