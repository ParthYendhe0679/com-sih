import hashlib
import math
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.ai_ml.models.ai_models import Entity
from app.api.deps import (
    get_case_service,
    get_client_ip,
    get_fir_service,
    require_roles,
)
from app.core.constants import DocumentProcessingStatus, FIRPriority, FIRStatus, UserRole
from app.db.session import get_db
from app.integrations.storage.storage_interface import StorageService, get_storage_service
from app.models.user import User
from app.schemas.case import CaseResponse
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.fir import FIRDetailResponse, FIRResponse, OfflineFIRCreate
from app.services.case_service import CaseService
from app.services.entity_extraction_service import entity_extraction_service
from app.services.fir_service import FIRService
from app.services.ocr_service import ocr_service
from app.utils.response import success_response

router = APIRouter()


def _extract_entities_from_text(text: str) -> Dict[str, List[Dict[str, Any]]]:
    """Hybrid rule, regex, and NLP entity extractor from raw document text."""
    res = entity_extraction_service.extract_all(text)
    return {
        "phones": res.phones,
        "vehicles": res.vehicles,
        "transactions": res.transactions,
        "legal_sections": res.legal_sections,
        "emails": res.emails,
        "persons": res.persons,
        "locations": res.locations,
        "digital_identifiers": res.digital_identifiers,
        "dates": res.dates,
    }


def _detect_crime_category(text: str) -> str:
    """Auto-detects crime category from extracted FIR text using IPC sections and contextual terms."""
    text_lower = text.lower()
    if re.search(r'\b(420|406|409|467|468|471)\b', text):
        return "Financial Fraud"
    if re.search(r'\b(384|386|387|388|389)\b', text):
        return "Extortion"
    if re.search(r'\b(379|380|381|382)\b', text):
        return "Vehicle Theft" if any(w in text_lower for w in ["vehicle", "bike", "car", "motorcycle", "scooter"]) else "Theft"
    if re.search(r'\b(392|394|395|396|397)\b', text):
        return "Robbery"
    if (re.search(r'\b(66[A-F]?|43|65)\b', text) and "it act" in text_lower) or any(
        k in text_lower for k in ["cyber", "phishing", "online", "hack", "unauthorized access", "otp", "sim swap", "social media", "telegram", "whatsapp", "crypto"]
    ):
        return "Cybercrime"
    if any(k in text_lower for k in ["fraud", "scam", "crore", "lakh", "embezzle", "ponzi", "cheating", "fake invoice", "bank transaction"]):
        return "Financial Fraud"
    if any(k in text_lower for k in ["narcotic", "drug", "ndps", "ganja", "cocaine", "heroin", "mdma", "contraband"]):
        return "Narcotics"
    if any(k in text_lower for k in ["extortion", "ransom", "threat", "blackmail", "protection money", "underworld"]):
        return "Extortion"
    if any(k in text_lower for k in ["vehicle", "car theft", "bike stolen", "stolen vehicle", "rto", "registration"]):
        return "Vehicle Theft"
    if any(k in text_lower for k in ["robbery", "dacoity", "loot", "armed robbery"]):
        return "Robbery"
    if any(k in text_lower for k in ["murder", "homicide", "assault", "violent", "302", "307"]):
        return "Violent Crime"
    return "Cybercrime"


def _detect_incident_location(text: str) -> str:
    """Extracts incident occurrence location from FIR text using header markers or Indian locality recognition."""
    patterns = [
        r'(?:place\s+of\s+occurrence|incident\s+location|scene\s+of\s+crime|location\s+of\s+incident)[\s:=]+([^\n\r;]{3,60})',
        r'(?:police\s+station|P\.S\.)[\s:=]+([^\n\r;]{3,40})',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            if len(val) > 2 and not val.lower().startswith("not"):
                return val

    known_localities = [
        "Bandra Kurla Complex, Mumbai",
        "Andheri West, Mumbai",
        "Andheri East, Mumbai",
        "Nariman Point, Mumbai",
        "Colaba, Mumbai",
        "Dadar, Mumbai",
        "Powai, Mumbai",
        "Thane West, Thane",
        "Navi Mumbai",
        "Shivajinagar, Pune",
        "Hinjawadi, Pune",
        "Koramangala, Bengaluru",
        "Indiranagar, Bengaluru",
        "Connaught Place, New Delhi",
        "Cyber City, Gurugram",
        "Salt Lake, Kolkata",
        "Bandra, Mumbai",
        "Worli, Mumbai",
        "Kurla, Mumbai",
        "Mumbai",
        "Pune",
        "Delhi",
        "Bengaluru",
    ]
    text_lower = text.lower()
    for loc in known_localities:
        if loc.lower() in text_lower or loc.split(",")[0].lower() in text_lower:
            return loc

    return "Metropolitan Jurisdiction (Auto-extracted from FIR)"


@router.post(
    "/upload-fir-document",
    response_model=APIResponse[Dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
    summary="Upload and Ingest Physical FIR Document",
    description="Receive physical FIR scanned document via multipart/form-data, extract text and entities, and persist record.",
)
async def upload_fir_document(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    crime_category: Optional[str] = Form(None),
    incident_date_str: Optional[str] = Form(None, alias="incident_date"),
    incident_location: Optional[str] = Form(None),
    priority_str: Optional[str] = Form("MEDIUM", alias="priority"),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    fir_service: FIRService = Depends(get_fir_service),
    storage_service: StorageService = Depends(get_storage_service),
    db: AsyncSession = Depends(get_db),
):
    client_ip = get_client_ip(request)

    # 1. Read file bytes and validate
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 50MB limit.")

    file_hash = hashlib.sha256(content).hexdigest()
    file_name = file.filename or "fir_document.pdf"
    content_type = file.content_type or "application/pdf"
    ext = file_name.lower().split(".")[-1] if "." in file_name else ""

    # 2. Upload to storage
    file_url = await storage_service.upload(
        file_content=content,
        file_name=file_name,
        mime_type=content_type,
    )

    # 3. Real OCR Document Ingestion Pipeline
    ocr_res = await ocr_service.process_document(
        file_bytes=content,
        file_name=file_name,
        content_type=content_type,
    )

    if ocr_res.success:
        extracted_text = ocr_res.cleaned_text
        proc_status = DocumentProcessingStatus.COMPLETED
    elif description and len(description.strip()) >= 15:
        extracted_text = description.strip()
        proc_status = DocumentProcessingStatus.COMPLETED
    else:
        raise HTTPException(
            status_code=422,
            detail=f"OCR_TEXT_INSUFFICIENT: {ocr_res.error or 'Unable to extract legible text from this document.'}",
        )

    # 4. Extract entities via hybrid pipeline
    extracted_entities = entity_extraction_service.extract_all(extracted_text)
    entities = {
        "phones": extracted_entities.phones,
        "vehicles": extracted_entities.vehicles,
        "transactions": extracted_entities.transactions,
        "legal_sections": extracted_entities.legal_sections,
        "emails": extracted_entities.emails,
        "persons": extracted_entities.persons,
        "locations": extracted_entities.locations,
        "digital_identifiers": extracted_entities.digital_identifiers,
        "dates": extracted_entities.dates,
    }

    # Parse incident date
    parsed_date = date.today()
    if incident_date_str:
        try:
            parsed_date = datetime.strptime(incident_date_str.strip()[:10], "%Y-%m-%d").date()
        except Exception:
            pass
    elif extracted_entities.dates:
        try:
            # Attempt to use first extracted incident date e.g. 05/09/2026
            raw_d = extracted_entities.dates[0]["date"].replace(".", "/").replace("-", "/")
            parts = raw_d.split("/")
            if len(parts) == 3:
                day, month, yr = int(parts[0]), int(parts[1]), int(parts[2])
                if yr < 100:
                    yr += 2000
                parsed_date = date(yr, month, day)
        except Exception:
            pass

    # Parse priority
    prio = FIRPriority.MEDIUM
    if priority_str:
        try:
            prio = FIRPriority(priority_str.upper())
        except Exception:
            pass

    # Auto-infer crime category if not explicitly provided or generic
    final_crime_category = (crime_category or "").strip()
    if not final_crime_category or final_crime_category == "General Criminal Inquiry":
        final_crime_category = _detect_crime_category(extracted_text)

    # Auto-infer incident location if not explicitly provided or generic
    final_incident_location = (incident_location or "").strip()
    if not final_incident_location or final_incident_location == "Local Jurisdiction":
        final_incident_location = _detect_incident_location(extracted_text)

    # 5. Generate concise executive NLP summary
    executive_summary = entity_extraction_service.generate_executive_summary(
        text=extracted_text,
        entities=extracted_entities,
        crime_category=final_crime_category,
        incident_location=final_incident_location,
    )

    # 6. Persist offline FIR record
    offline_data = OfflineFIRCreate(
        title=title.strip(),
        description=executive_summary,
        crime_category=final_crime_category,
        incident_date=parsed_date,
        incident_location=final_incident_location,
        priority=prio,
        document_name=file_name,
        document_type=ext.upper() or "DOCUMENT",
        document_url=file_url,
    )

    fir = await fir_service.register_offline_fir(
        data=offline_data,
        police_user=current_user,
        client_ip=client_ip,
    )

    # Persist extracted entities to PostgreSQL linked to this FIR
    try:
        for p in extracted_entities.phones:
            db.add(Entity(
                fir_id=fir.id,
                entity_type="PHONE",
                name=p["number"],
                normalized_value=p["normalized"],
                confidence=p["confidence"] / 100.0,
                source_text=p.get("raw"),
                is_canonical=True,
            ))
        for v in extracted_entities.vehicles:
            db.add(Entity(
                fir_id=fir.id,
                entity_type="VEHICLE",
                name=v["registration"],
                normalized_value=v["registration"],
                confidence=v["confidence"] / 100.0,
                source_text=v.get("raw"),
                is_canonical=True,
            ))
        for t in extracted_entities.transactions:
            db.add(Entity(
                fir_id=fir.id,
                entity_type=t.get("type", "FINANCIAL"),
                name=t["amount"],
                normalized_value=t["amount"],
                confidence=t["confidence"] / 100.0,
                is_canonical=True,
            ))
        for s in extracted_entities.legal_sections:
            db.add(Entity(
                fir_id=fir.id,
                entity_type="LEGAL_SECTION",
                name=s["section"],
                normalized_value=s["section"],
                confidence=s["confidence"] / 100.0,
                is_canonical=True,
            ))
        for e in extracted_entities.emails:
            db.add(Entity(
                fir_id=fir.id,
                entity_type="EMAIL",
                name=e["email"],
                normalized_value=e["email"],
                confidence=e["confidence"] / 100.0,
                is_canonical=True,
            ))
        for per in extracted_entities.persons:
            db.add(Entity(
                fir_id=fir.id,
                entity_type="PERSON",
                name=per["name"],
                normalized_value=per["name"].lower().replace(" ", "_"),
                confidence=per["confidence"] / 100.0,
                attributes_json={"role": per.get("role")},
                is_canonical=True,
            ))
        for loc in extracted_entities.locations:
            db.add(Entity(
                fir_id=fir.id,
                entity_type="LOCATION",
                name=loc["location"],
                normalized_value=loc["location"].upper(),
                confidence=loc["confidence"] / 100.0,
                attributes_json={
                    "type": loc.get("type", "LOCATION"),
                    "label": loc.get("label", "Location"),
                    "importance": loc.get("importance", "HIGH"),
                    "latitude": loc.get("latitude"),
                    "longitude": loc.get("longitude"),
                    "address": loc.get("address"),
                    "geocoded": loc.get("geocoded", False),
                },
                is_canonical=True,
            ))
        for dig in extracted_entities.digital_identifiers:
            db.add(Entity(
                fir_id=fir.id,
                entity_type="DIGITAL_ID",
                name=dig["identifier"],
                normalized_value=dig["identifier"],
                confidence=dig["confidence"] / 100.0,
                attributes_json={"type": dig.get("type")},
                is_canonical=True,
            ))
        await db.commit()
    except Exception as persist_err:
        import logging
        logging.getLogger("kritagas.police").warning(f"Entity DB persistence warning: {persist_err}")

    fir_response = FIRDetailResponse.model_validate(fir)

    return success_response(
        data={
            "fir": fir_response.model_dump(mode="json"),
            "file_url": file_url,
            "file_hash": file_hash,
            "file_size": len(content),
            "extracted_text": extracted_text,
            "executive_summary": executive_summary,
            "entities": entities,
            "processing_status": proc_status.value,
        },
        message=f"FIR document '{file_name}' successfully uploaded and ingested with {len(entities['phones']) + len(entities['transactions']) + len(entities['legal_sections'])} extracted intelligence entities.",
        status_code=status.HTTP_201_CREATED,
    )


@router.post(
    "/offline-fir",
    response_model=APIResponse[FIRDetailResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register Offline FIR",
    description="Intake a walk-in offline physical FIR lodged at the police station with document scan metadata.",
)
async def register_offline_fir(
    request: Request,
    body: OfflineFIRCreate,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    fir_service: FIRService = Depends(get_fir_service),
):
    client_ip = get_client_ip(request)
    fir = await fir_service.register_offline_fir(
        data=body,
        police_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=FIRDetailResponse.model_validate(fir),
        message=f"Offline FIR {fir.fir_number} registered and queued for document intelligence.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/fir-queue",
    response_model=APIResponse[PaginatedResponse[FIRResponse]],
    summary="Police FIR Review Queue",
    description="Triage queue of submitted complaints requiring police assessment.",
)
async def get_fir_queue(
    status_filter: Optional[FIRStatus] = Query(None, alias="status"),
    priority_filter: Optional[FIRPriority] = Query(None, alias="priority"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    fir_service: FIRService = Depends(get_fir_service),
):
    firs = await fir_service.list_police_queue(
        status=status_filter,
        priority=priority_filter,
        page=page,
        size=size,
    )
    total = await fir_service.count_police_queue(status=status_filter, priority=priority_filter)
    total_pages = math.ceil(total / size) if size > 0 else 1

    paginated = PaginatedResponse(
        items=[FIRResponse.model_validate(f) for f in firs],
        page=page,
        size=size,
        total=total,
        total_pages=total_pages,
    )
    return success_response(data=paginated, message="Police FIR review queue retrieved.")


@router.get(
    "/assigned-cases",
    response_model=APIResponse[PaginatedResponse[CaseResponse]],
    summary="Officer Assigned Cases",
    description="Shortcut endpoint returning cases assigned to the current officer.",
)
async def get_assigned_cases(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    cases = await case_service.list_my_cases(police_user=current_user, page=page, size=size)
    total = await case_service.count_my_cases(police_user=current_user)
    total_pages = math.ceil(total / size) if size > 0 else 1

    paginated = PaginatedResponse(
        items=[CaseResponse.model_validate(c) for c in cases],
        page=page,
        size=size,
        total=total,
        total_pages=total_pages,
    )
    return success_response(data=paginated, message="Assigned cases retrieved.")
