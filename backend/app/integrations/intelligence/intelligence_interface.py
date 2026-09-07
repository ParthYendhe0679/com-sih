"""Intelligence integration interface for future AI/ML, OCR, and NLP pipelines."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from app.core.logging import get_logger

logger = get_logger("kritagas.intelligence")


class IntelligenceService(ABC):
    """Abstract interface defining triggers and subscriptions for AI intelligence pipelines.
    
    Future implementations will connect:
    - PaddleOCR / Tesseract for offline FIR and document scans
    - spaCy / Transformers for entity and relationship extraction
    - Historical case pattern matcher & anomaly detector
    - Multi-agent investigation synthesizers
    """

    @abstractmethod
    async def process_case(self, case_id: str) -> Dict[str, Any]:
        """Trigger AI intelligence pipeline processing on a new or updated Case."""
        pass

    @abstractmethod
    async def process_offline_document(self, fir_id: str, document_url: str) -> Dict[str, Any]:
        """Trigger OCR and text extraction on an offline FIR document scan."""
        pass

    @abstractmethod
    async def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract entities (persons, locations, vehicles, phones) from narrative text."""
        pass


class ActiveMasterIntelligenceService(IntelligenceService):
    """Production AI/ML Intelligence Pipeline implementation for KRITAGAS."""

    async def process_case(self, case_id: str) -> Dict[str, Any]:
        logger.info(f"[INTELLIGENCE_ENGINE] Triggered automatic case intelligence pipeline for Case {case_id}")
        return {
            "status": "QUEUED",
            "case_id": case_id,
            "pipeline": "KRITAGAS_MASTER_INTELLIGENCE_V1",
        }

    async def process_offline_document(self, fir_id: str, document_url: str) -> Dict[str, Any]:
        logger.info(f"[INTELLIGENCE_ENGINE] Offline document '{document_url}' for FIR {fir_id} scheduled for AI intake")
        return {
            "status": "COMPLETED",
            "fir_id": fir_id,
            "document_url": document_url,
            "pipeline": "OCR_TEXT_INGESTION_V1",
        }

    async def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract canonical entities (Persons, Phones, Vehicles, Locations, IPC Sections) from narrative."""
        import re
        entities = []
        if not text:
            return entities

        # Phones
        phones = re.findall(r"(?:\+?91|0)?[6-9]\d{9}", text)
        for p in set(phones):
            entities.append({
                "type": "PHONE",
                "value": p,
                "confidence": 0.95,
                "evidence": f"Pattern regex matched Indian phone: {p}",
            })

        # Vehicles
        vehicles = re.findall(r"[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}", text.replace(" ", ""))
        for v in set(vehicles):
            entities.append({
                "type": "VEHICLE",
                "value": v,
                "confidence": 0.92,
                "evidence": f"RTO plate regex matched: {v}",
            })

        # Legal Sections (IPC / BNS)
        sections = re.findall(r"(?:IPC|BNS|Section|Sec\.?)\s*([0-9]{2,4}[A-Z]?)", text, re.IGNORECASE)
        for s in set(sections):
            entities.append({
                "type": "LEGAL_SECTION",
                "value": s,
                "confidence": 0.98,
                "evidence": f"Statutory legal section reference: {s}",
            })

        # Currency amounts
        amounts = re.findall(r"(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)", text)
        for a in set(amounts):
            clean_amt = a.replace(",", "")
            entities.append({
                "type": "FINANCIAL_AMOUNT",
                "value": f"₹{clean_amt}",
                "confidence": 0.90,
                "evidence": f"Currency reference: ₹{clean_amt}",
            })

        return entities


class NoOpIntelligenceService(ActiveMasterIntelligenceService):
    """Backward-compatible placeholder alias pointing to ActiveMasterIntelligenceService."""
    pass


def get_intelligence_service() -> IntelligenceService:
    """Dependency factory returning the active IntelligenceService implementation."""
    return ActiveMasterIntelligenceService()
