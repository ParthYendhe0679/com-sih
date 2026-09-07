"""FIR management and workflow domain service."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence
import uuid
from app.core.constants import (
    AuditAction,
    DocumentProcessingStatus,
    FIRPriority,
    FIRStatus,
    NotificationType,
    UserRole,
)
from app.core.exceptions import (
    BadRequestException,
    PermissionDeniedException,
    ResourceNotFoundException,
)
from app.integrations.intelligence.intelligence_interface import IntelligenceService
from app.models.fir import FIR
from app.models.user import User
from app.repositories.fir_repository import FIRRepository
from app.schemas.fir import (
    FIRCreate,
    FIRReviewRequest,
    FIRUpdate,
    OfflineFIRCreate,
)
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.utils.helpers import generate_fir_number
from app.utils.validators import validate_fir_transition


class FIRService:
    """Service orchestrating the FIR lifecycle, citizen intake, police triage review, and offline lodging."""

    def __init__(
        self,
        fir_repo: FIRRepository,
        audit_service: AuditService,
        notification_service: NotificationService,
        intelligence_service: IntelligenceService,
    ):
        self.fir_repo = fir_repo
        self.audit_service = audit_service
        self.notification_service = notification_service
        self.intelligence_service = intelligence_service

    async def get_fir_by_id(self, fir_id: uuid.UUID, current_user: User) -> FIR:
        """Retrieve FIR by ID enforcing citizen access boundaries."""
        fir = await self.fir_repo.get_by_id(fir_id)
        if not fir:
            raise ResourceNotFoundException("FIR", fir_id)

        # Citizens can only view their own FIRs
        if current_user.role == UserRole.CITIZEN and fir.submitted_by_id != current_user.id:
            raise PermissionDeniedException("You are not authorized to view this complaint.")

        return fir

    async def create_fir(
        self,
        data: FIRCreate,
        citizen_user: User,
        client_ip: Optional[str] = None,
        auto_submit: bool = False,
    ) -> FIR:
        """Create a new citizen FIR in DRAFT or SUBMITTED status."""
        fir_num = generate_fir_number()
        initial_status = FIRStatus.SUBMITTED if auto_submit else FIRStatus.DRAFT

        new_fir = FIR(
            fir_number=fir_num,
            title=data.title.strip(),
            description=data.description.strip(),
            crime_category=data.crime_category.strip(),
            incident_date=data.incident_date,
            incident_time=data.incident_time,
            incident_location=data.incident_location.strip(),
            status=initial_status,
            priority=data.priority,
            submitted_by_id=citizen_user.id,
            is_offline=False,
            processing_status=DocumentProcessingStatus.NOT_PROCESSED,
        )

        fir = await self.fir_repo.create(new_fir)

        action = AuditAction.FIR_SUBMITTED.value if auto_submit else AuditAction.FIR_CREATED.value
        await self.audit_service.log_action(
            action=action,
            resource_type="fir",
            resource_id=str(fir.id),
            description=f"Citizen '{citizen_user.username}' created FIR {fir.fir_number} ({initial_status.value})",
            user_id=citizen_user.id,
            ip_address=client_ip,
        )

        if auto_submit:
            await self.notification_service.send_notification(
                user_id=citizen_user.id,
                title="Complaint Submitted",
                message=f"Your complaint has been registered with tracking number {fir.fir_number}.",
                notification_type=NotificationType.SUCCESS,
                data={"fir_id": str(fir.id), "fir_number": fir.fir_number},
            )

        return fir

    async def update_draft_fir(
        self,
        fir_id: uuid.UUID,
        data: FIRUpdate,
        citizen_user: User,
    ) -> FIR:
        """Update fields of an FIR while still in DRAFT status."""
        fir = await self.get_fir_by_id(fir_id, citizen_user)
        if fir.status != FIRStatus.DRAFT:
            raise BadRequestException("Only complaints in DRAFT status can be modified.")

        if data.title is not None:
            fir.title = data.title.strip()
        if data.description is not None:
            fir.description = data.description.strip()
        if data.incident_location is not None:
            fir.incident_location = data.incident_location.strip()
        if data.priority is not None:
            fir.priority = data.priority

        return await self.fir_repo.update(fir)

    async def submit_draft_fir(
        self,
        fir_id: uuid.UUID,
        citizen_user: User,
        client_ip: Optional[str] = None,
    ) -> FIR:
        """Transition an FIR from DRAFT to SUBMITTED."""
        fir = await self.get_fir_by_id(fir_id, citizen_user)
        validate_fir_transition(fir.status, FIRStatus.SUBMITTED)

        fir.status = FIRStatus.SUBMITTED
        updated = await self.fir_repo.update(fir)

        await self.audit_service.log_action(
            action=AuditAction.FIR_SUBMITTED.value,
            resource_type="fir",
            resource_id=str(fir.id),
            description=f"Citizen submitted FIR {fir.fir_number} for police review",
            user_id=citizen_user.id,
            ip_address=client_ip,
        )

        await self.notification_service.send_notification(
            user_id=citizen_user.id,
            title="Complaint Submitted for Review",
            message=f"Your complaint {fir.fir_number} has been submitted to the police triage queue.",
            notification_type=NotificationType.SUCCESS,
            data={"fir_id": str(fir.id), "fir_number": fir.fir_number},
        )

        return updated

    async def start_review(
        self,
        fir_id: uuid.UUID,
        police_user: User,
        client_ip: Optional[str] = None,
    ) -> FIR:
        """Mark an FIR as UNDER_REVIEW when a police officer begins triage."""
        fir = await self.fir_repo.get_by_id(fir_id)
        if not fir:
            raise ResourceNotFoundException("FIR", fir_id)

        validate_fir_transition(fir.status, FIRStatus.UNDER_REVIEW)

        fir.status = FIRStatus.UNDER_REVIEW
        fir.reviewed_by_id = police_user.id
        updated = await self.fir_repo.update(fir)

        await self.audit_service.log_action(
            action=AuditAction.FIR_REVIEWED.value,
            resource_type="fir",
            resource_id=str(fir.id),
            description=f"Officer '{police_user.username}' began review of FIR {fir.fir_number}",
            user_id=police_user.id,
            ip_address=client_ip,
        )

        return updated

    async def review_fir(
        self,
        fir_id: uuid.UUID,
        review_data: FIRReviewRequest,
        police_user: User,
        client_ip: Optional[str] = None,
    ) -> FIR:
        """Process police officer review decision (ACCEPTED, REJECTED, MORE_INFORMATION_REQUIRED)."""
        fir = await self.fir_repo.get_by_id(fir_id)
        if not fir:
            raise ResourceNotFoundException("FIR", fir_id)

        target_status = review_data.status
        validate_fir_transition(fir.status, target_status)

        old_status = fir.status
        fir.status = target_status
        fir.reviewed_by_id = police_user.id
        fir.reviewed_at = datetime.now(timezone.utc)

        if review_data.priority is not None:
            fir.priority = review_data.priority

        if target_status == FIRStatus.REJECTED:
            if not review_data.rejection_reason or not review_data.rejection_reason.strip():
                raise BadRequestException("A valid rejection reason must be provided when rejecting an FIR.")
            fir.rejection_reason = review_data.rejection_reason.strip()

        updated = await self.fir_repo.update(fir)

        # Audit decision
        audit_action = {
            FIRStatus.ACCEPTED: AuditAction.FIR_ACCEPTED.value,
            FIRStatus.REJECTED: AuditAction.FIR_REJECTED.value,
            FIRStatus.MORE_INFORMATION_REQUIRED: AuditAction.FIR_MORE_INFO_REQUESTED.value,
        }.get(target_status, AuditAction.FIR_REVIEWED.value)

        await self.audit_service.log_action(
            action=audit_action,
            resource_type="fir",
            resource_id=str(fir.id),
            description=f"Officer '{police_user.username}' transitioned FIR {fir.fir_number} from {old_status.value} to {target_status.value}",
            user_id=police_user.id,
            old_value={"status": old_status.value},
            new_value={"status": target_status.value, "reason": fir.rejection_reason},
            ip_address=client_ip,
        )

        # Notify complainant
        notification_messages = {
            FIRStatus.ACCEPTED: (
                "FIR Accepted",
                f"Your complaint {fir.fir_number} has been officially accepted by law enforcement.",
                NotificationType.SUCCESS,
            ),
            FIRStatus.REJECTED: (
                "FIR Rejected",
                f"Your complaint {fir.fir_number} was rejected. Reason: {fir.rejection_reason}",
                NotificationType.WARNING,
            ),
            FIRStatus.MORE_INFORMATION_REQUIRED: (
                "Additional Information Required",
                f"Law enforcement has requested additional details regarding your complaint {fir.fir_number}.",
                NotificationType.ACTION_REQUIRED,
            ),
        }

        if target_status in notification_messages:
            title, msg, ntype = notification_messages[target_status]
            await self.notification_service.send_notification(
                user_id=fir.submitted_by_id,
                title=title,
                message=msg,
                notification_type=ntype,
                data={"fir_id": str(fir.id), "fir_number": fir.fir_number},
            )

        return updated

    async def request_additional_information(
        self,
        fir_id: uuid.UUID,
        instructions: str,
        police_user: User,
        client_ip: Optional[str] = None,
    ) -> FIR:
        """Police officer requests specific information from the citizen."""
        fir = await self.fir_repo.get_by_id(fir_id)
        if not fir:
            raise ResourceNotFoundException("FIR", fir_id)

        validate_fir_transition(fir.status, FIRStatus.MORE_INFORMATION_REQUIRED)

        fir.status = FIRStatus.MORE_INFORMATION_REQUIRED
        fir.reviewed_by_id = police_user.id

        history = fir.additional_information or []
        history.append({
            "type": "REQUEST",
            "date": datetime.now(timezone.utc).isoformat(),
            "officer": police_user.full_name,
            "message": instructions.strip(),
        })
        fir.additional_information = history

        updated = await self.fir_repo.update(fir)

        await self.audit_service.log_action(
            action=AuditAction.FIR_MORE_INFO_REQUESTED.value,
            resource_type="fir",
            resource_id=str(fir.id),
            description=f"Officer '{police_user.username}' requested additional info for FIR {fir.fir_number}",
            user_id=police_user.id,
            ip_address=client_ip,
        )

        await self.notification_service.send_notification(
            user_id=fir.submitted_by_id,
            title="Action Required: FIR Additional Info",
            message=f"Police officer {police_user.full_name} requested more information on {fir.fir_number}: {instructions}",
            notification_type=NotificationType.ACTION_REQUIRED,
            data={"fir_id": str(fir.id), "fir_number": fir.fir_number},
        )

        return updated

    async def provide_additional_information(
        self,
        fir_id: uuid.UUID,
        response_text: str,
        citizen_user: User,
        client_ip: Optional[str] = None,
    ) -> FIR:
        """Citizen submits requested information, returning FIR to review."""
        fir = await self.get_fir_by_id(fir_id, citizen_user)

        if fir.status != FIRStatus.MORE_INFORMATION_REQUIRED:
            raise BadRequestException(f"Cannot provide information when FIR status is '{fir.status.value}'.")

        history = fir.additional_information or []
        history.append({
            "type": "RESPONSE",
            "date": datetime.now(timezone.utc).isoformat(),
            "complainant": citizen_user.full_name,
            "message": response_text.strip(),
        })
        fir.additional_information = history
        fir.status = FIRStatus.UNDER_REVIEW

        updated = await self.fir_repo.update(fir)

        await self.audit_service.log_action(
            action=AuditAction.FIR_INFO_PROVIDED.value,
            resource_type="fir",
            resource_id=str(fir.id),
            description=f"Citizen provided additional details for FIR {fir.fir_number}",
            user_id=citizen_user.id,
            ip_address=client_ip,
        )

        # Notify reviewing officer if assigned
        if fir.reviewed_by_id:
            await self.notification_service.send_notification(
                user_id=fir.reviewed_by_id,
                title="Citizen Response Received",
                message=f"Citizen responded to information request for FIR {fir.fir_number}.",
                notification_type=NotificationType.INFO,
                data={"fir_id": str(fir.id), "fir_number": fir.fir_number},
            )

        return updated

    async def register_offline_fir(
        self,
        data: OfflineFIRCreate,
        police_user: User,
        client_ip: Optional[str] = None,
    ) -> FIR:
        """Register an offline FIR lodgment with scanned document metadata and trigger OCR integration hook."""
        fir_num = generate_fir_number()

        offline_fir = FIR(
            fir_number=fir_num,
            title=data.title.strip(),
            description=data.description.strip(),
            crime_category=data.crime_category.strip(),
            incident_date=data.incident_date,
            incident_time=data.incident_time,
            incident_location=data.incident_location.strip(),
            status=FIRStatus.ACCEPTED,  # Offline lodged FIRs accepted directly by intake officer
            priority=data.priority,
            submitted_by_id=police_user.id,
            reviewed_by_id=police_user.id,
            reviewed_at=datetime.now(timezone.utc),
            is_offline=True,
            document_name=data.document_name.strip(),
            document_type=data.document_type.strip(),
            document_url=data.document_url.strip(),
            processing_status=DocumentProcessingStatus.QUEUED,
        )

        fir = await self.fir_repo.create(offline_fir)

        await self.audit_service.log_action(
            action=AuditAction.OFFLINE_FIR_REGISTERED.value,
            resource_type="fir",
            resource_id=str(fir.id),
            description=f"Officer '{police_user.username}' logged offline FIR {fir.fir_number} with document '{data.document_name}'",
            user_id=police_user.id,
            ip_address=client_ip,
        )

        # Trigger future OCR and NLP extraction hook
        await self.intelligence_service.process_offline_document(
            fir_id=str(fir.id),
            document_url=fir.document_url,
        )

        return fir

    async def list_citizen_firs(
        self,
        citizen_user: User,
        status: Optional[FIRStatus] = None,
        page: int = 1,
        size: int = 20,
    ) -> Sequence[FIR]:
        """Fetch paginated FIRs submitted by the active citizen."""
        offset = (page - 1) * size
        return await self.fir_repo.list_for_citizen(
            citizen_id=citizen_user.id,
            status=status,
            offset=offset,
            limit=size,
        )

    async def count_citizen_firs(
        self,
        citizen_user: User,
        status: Optional[FIRStatus] = None,
    ) -> int:
        """Count total FIRs submitted by the active citizen."""
        return await self.fir_repo.count_for_citizen(citizen_id=citizen_user.id, status=status)

    async def list_police_queue(
        self,
        status: Optional[FIRStatus] = None,
        priority: Optional[FIRPriority] = None,
        page: int = 1,
        size: int = 20,
    ) -> Sequence[FIR]:
        """Fetch submitted complaints awaiting triage in the police queue."""
        offset = (page - 1) * size
        return await self.fir_repo.list_for_police_queue(
            status=status,
            priority=priority,
            offset=offset,
            limit=size,
        )

    async def count_police_queue(
        self,
        status: Optional[FIRStatus] = None,
        priority: Optional[FIRPriority] = None,
    ) -> int:
        """Count complaints in the police queue."""
        return await self.fir_repo.count_for_police_queue(status=status, priority=priority)

    async def search_firs(
        self,
        query: str,
        current_user: User,
        page: int = 1,
        size: int = 20,
    ) -> Sequence[FIR]:
        """Search FIRs with role boundaries."""
        offset = (page - 1) * size
        firs = await self.fir_repo.search(query=query, offset=offset, limit=size)
        if current_user.role == UserRole.CITIZEN:
            return [f for f in firs if f.submitted_by_id == current_user.id]
        return firs
