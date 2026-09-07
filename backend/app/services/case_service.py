"""Case investigation management and workflow domain service."""

from datetime import datetime, timezone
from typing import List, Optional, Sequence
import uuid
from app.core.constants import (
    AuditAction,
    CasePriority,
    CaseStatus,
    FIRStatus,
    NotificationType,
    UserRole,
)
from app.core.exceptions import (
    BadRequestException,
    PermissionDeniedException,
    ResourceNotFoundException,
)
from app.integrations.graph.graph_interface import GraphService
from app.integrations.intelligence.intelligence_interface import IntelligenceService
from app.models.case import Case
from app.models.case_note import CaseNote
from app.models.user import User
from app.repositories.case_repository import CaseRepository
from app.repositories.fir_repository import FIRRepository
from app.repositories.user_repository import UserRepository
from app.schemas.case import (
    CaseAssignRequest,
    CaseCreate,
    CaseNoteCreate,
    CaseStatusUpdateRequest,
    CaseTimelineEventResponse,
    CaseUpdate,
)
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.utils.helpers import generate_case_number
from app.utils.validators import validate_case_transition


class CaseService:
    """Service governing criminal investigation Cases, investigator assignments, and timeline aggregation."""

    def __init__(
        self,
        case_repo: CaseRepository,
        fir_repo: FIRRepository,
        user_repo: UserRepository,
        audit_service: AuditService,
        notification_service: NotificationService,
        intelligence_service: IntelligenceService,
        graph_service: GraphService,
    ):
        self.case_repo = case_repo
        self.fir_repo = fir_repo
        self.user_repo = user_repo
        self.audit_service = audit_service
        self.notification_service = notification_service
        self.intelligence_service = intelligence_service
        self.graph_service = graph_service

    async def get_case_by_id(self, case_id: uuid.UUID, current_user: User) -> Case:
        """Fetch Case by UUID enforcing role permissions (Citizens cannot view general police Cases)."""
        case = await self.case_repo.get_by_id(case_id)
        if not case:
            raise ResourceNotFoundException("Case", case_id)

        if current_user.role == UserRole.CITIZEN:
            # Citizens can only view if it originated from their own FIR
            if not case.fir_id:
                raise PermissionDeniedException("Access restricted to authorized personnel.")
            fir = await self.fir_repo.get_by_id(case.fir_id)
            if not fir or fir.submitted_by_id != current_user.id:
                raise PermissionDeniedException("Access restricted to authorized personnel.")

        return case

    async def create_case(
        self,
        data: CaseCreate,
        police_user: User,
        client_ip: Optional[str] = None,
    ) -> Case:
        """Create a new Case originating from an accepted FIR or direct offline entry."""
        case_num = generate_case_number()

        # If originating from an FIR, verify FIR status is ACCEPTED
        if data.fir_id:
            fir = await self.fir_repo.get_by_id(data.fir_id)
            if not fir:
                raise ResourceNotFoundException("FIR", data.fir_id)
            if fir.status != FIRStatus.ACCEPTED:
                raise BadRequestException(
                    f"A Case can only be created from an ACCEPTED FIR. Current status is '{fir.status.value}'."
                )
            # Mark FIR as converted
            fir.status = FIRStatus.CONVERTED_TO_CASE
            await self.fir_repo.update(fir)

        # Validate investigator if assigned
        if data.lead_investigator_id:
            investigator = await self.user_repo.get_by_id(data.lead_investigator_id)
            if not investigator or investigator.role != UserRole.POLICE:
                raise BadRequestException("Lead investigator must be a registered Police Officer.")

        initial_status = CaseStatus.UNDER_INVESTIGATION if data.lead_investigator_id else CaseStatus.OPEN

        new_case = Case(
            case_number=case_num,
            title=data.title.strip(),
            description=data.description.strip(),
            crime_category=data.crime_category.strip(),
            status=initial_status,
            priority=data.priority,
            fir_id=data.fir_id,
            lead_investigator_id=data.lead_investigator_id,
            created_by_id=police_user.id,
            opened_at=datetime.now(timezone.utc),
        )

        case = await self.case_repo.create(new_case)

        # Audit creation
        await self.audit_service.log_action(
            action=AuditAction.CASE_CREATED.value,
            resource_type="case",
            resource_id=str(case.id),
            description=f"Case {case.case_number} created by '{police_user.username}' (Origin: {'FIR' if data.fir_id else 'Direct'})",
            user_id=police_user.id,
            new_value={"case_number": case.case_number, "fir_id": str(data.fir_id) if data.fir_id else None},
            ip_address=client_ip,
        )

        # Notify lead investigator if assigned
        if case.lead_investigator_id:
            await self.notification_service.send_notification(
                user_id=case.lead_investigator_id,
                title="Assigned as Lead Investigator",
                message=f"You have been assigned to Case {case.case_number}: '{case.title}'.",
                notification_type=NotificationType.ACTION_REQUIRED,
                data={"case_id": str(case.id), "case_number": case.case_number},
            )

        # Trigger future Intelligence and Knowledge Graph hooks
        await self.intelligence_service.process_case(case_id=str(case.id))
        await self.graph_service.sync_case_node(
            case_id=str(case.id),
            case_number=case.case_number,
            title=case.title,
            crime_category=case.crime_category,
            status=case.status.value,
        )

        return case

    async def assign_lead_investigator(
        self,
        case_id: uuid.UUID,
        req: CaseAssignRequest,
        police_user: User,
        client_ip: Optional[str] = None,
    ) -> Case:
        """Assign or transfer lead investigator responsibilities."""
        case = await self.case_repo.get_by_id(case_id)
        if not case:
            raise ResourceNotFoundException("Case", case_id)

        investigator = await self.user_repo.get_by_id(req.lead_investigator_id)
        if not investigator or investigator.role != UserRole.POLICE:
            raise BadRequestException("Lead investigator must be a registered Police Officer.")

        old_investigator_id = case.lead_investigator_id
        case.lead_investigator_id = investigator.id

        # If currently OPEN, progress to UNDER_INVESTIGATION
        if case.status == CaseStatus.OPEN:
            case.status = CaseStatus.UNDER_INVESTIGATION

        updated = await self.case_repo.update(case)

        await self.audit_service.log_action(
            action=AuditAction.CASE_ASSIGNED.value,
            resource_type="case",
            resource_id=str(case.id),
            description=f"Officer '{police_user.username}' assigned '{investigator.full_name}' (Badge: {investigator.badge_number}) to Case {case.case_number}",
            user_id=police_user.id,
            old_value={"lead_investigator_id": str(old_investigator_id) if old_investigator_id else None},
            new_value={"lead_investigator_id": str(investigator.id)},
            ip_address=client_ip,
        )

        await self.notification_service.send_notification(
            user_id=investigator.id,
            title="Case Assigned to You",
            message=f"You are the assigned lead investigator for Case {case.case_number}: '{case.title}'.",
            notification_type=NotificationType.ACTION_REQUIRED,
            data={"case_id": str(case.id), "case_number": case.case_number},
        )

        return updated

    async def update_case_status(
        self,
        case_id: uuid.UUID,
        req: CaseStatusUpdateRequest,
        police_user: User,
        client_ip: Optional[str] = None,
    ) -> Case:
        """Update case status following strict state machine transitions."""
        case = await self.case_repo.get_by_id(case_id)
        if not case:
            raise ResourceNotFoundException("Case", case_id)

        target_status = req.status
        validate_case_transition(case.status, target_status)

        old_status = case.status
        case.status = target_status

        if target_status == CaseStatus.CLOSED:
            case.closed_at = datetime.now(timezone.utc)
        elif old_status == CaseStatus.CLOSED and target_status != CaseStatus.CLOSED:
            case.closed_at = None

        updated = await self.case_repo.update(case)

        # If a transition note was provided, save it as a CaseNote
        if req.note and req.note.strip():
            await self.case_repo.add_note(
                case_id=case.id,
                author_id=police_user.id,
                note_text=f"[Status Update -> {target_status.value}]: {req.note.strip()}",
            )

        await self.audit_service.log_action(
            action=AuditAction.CASE_STATUS_CHANGED.value,
            resource_type="case",
            resource_id=str(case.id),
            description=f"Case {case.case_number} status changed from {old_status.value} to {target_status.value}",
            user_id=police_user.id,
            old_value={"status": old_status.value},
            new_value={"status": target_status.value, "note": req.note},
            ip_address=client_ip,
        )

        return updated

    async def update_case(
        self,
        case_id: uuid.UUID,
        data: CaseUpdate,
        police_user: User,
        client_ip: Optional[str] = None,
    ) -> Case:
        """Update editable metadata of a Case."""
        case = await self.case_repo.get_by_id(case_id)
        if not case:
            raise ResourceNotFoundException("Case", case_id)

        if data.title is not None:
            case.title = data.title.strip()
        if data.description is not None:
            case.description = data.description.strip()
        if data.priority is not None:
            case.priority = data.priority

        updated = await self.case_repo.update(case)

        await self.audit_service.log_action(
            action=AuditAction.CASE_UPDATED.value,
            resource_type="case",
            resource_id=str(case.id),
            description=f"Officer '{police_user.username}' updated metadata on Case {case.case_number}",
            user_id=police_user.id,
            ip_address=client_ip,
        )

        return updated

    async def add_note(
        self,
        case_id: uuid.UUID,
        data: CaseNoteCreate,
        police_user: User,
        client_ip: Optional[str] = None,
    ) -> CaseNote:
        """Add an investigative case note."""
        case = await self.case_repo.get_by_id(case_id)
        if not case:
            raise ResourceNotFoundException("Case", case_id)

        note = await self.case_repo.add_note(
            case_id=case.id,
            author_id=police_user.id,
            note_text=data.note.strip(),
        )

        await self.audit_service.log_action(
            action=AuditAction.CASE_NOTE_ADDED.value,
            resource_type="case",
            resource_id=str(case.id),
            description=f"Officer '{police_user.username}' added note to Case {case.case_number}",
            user_id=police_user.id,
            ip_address=client_ip,
        )

        return note

    async def get_timeline(self, case_id: uuid.UUID) -> List[CaseTimelineEventResponse]:
        """Aggregate chronological timeline from Audit Logs and Case Notes."""
        case = await self.case_repo.get_by_id(case_id)
        if not case:
            raise ResourceNotFoundException("Case", case_id)

        timeline: List[CaseTimelineEventResponse] = []

        # 1. Fetch audit logs for this Case
        case_logs = await self.audit_service.get_resource_logs("case", str(case_id))
        for log in case_logs:
            timeline.append(
                CaseTimelineEventResponse(
                    id=f"audit-{log.id}",
                    timestamp=log.created_at,
                    event_type=log.action,
                    title=log.action.replace("_", " ").title(),
                    description=log.description,
                    user_id=log.user_id,
                )
            )

        # 2. If originating FIR exists, fetch FIR audit logs as well
        if case.fir_id:
            fir_logs = await self.audit_service.get_resource_logs("fir", str(case.fir_id))
            for log in fir_logs:
                timeline.append(
                    CaseTimelineEventResponse(
                        id=f"fir-audit-{log.id}",
                        timestamp=log.created_at,
                        event_type=log.action,
                        title=f"FIR: {log.action.replace('_', ' ').title()}",
                        description=log.description,
                        user_id=log.user_id,
                    )
                )

        # 3. Add investigative notes
        notes = await self.case_repo.get_notes_for_case(case_id)
        for n in notes:
            timeline.append(
                CaseTimelineEventResponse(
                    id=f"note-{n.id}",
                    timestamp=n.created_at,
                    event_type="NOTE_ADDED",
                    title="Investigative Note Added",
                    description=n.note,
                    user_id=n.author_id,
                )
            )

        # Sort chronologically ascending
        timeline.sort(key=lambda x: x.timestamp)
        return timeline

    async def list_cases(
        self,
        status: Optional[CaseStatus] = None,
        priority: Optional[CasePriority] = None,
        page: int = 1,
        size: int = 20,
    ) -> Sequence[Case]:
        """Fetch paginated list of cases."""
        offset = (page - 1) * size
        return await self.case_repo.list_cases(
            status=status,
            priority=priority,
            offset=offset,
            limit=size,
        )

    async def count_cases(
        self,
        status: Optional[CaseStatus] = None,
        priority: Optional[CasePriority] = None,
    ) -> int:
        """Count total cases with optional filters."""
        return await self.case_repo.count_cases(status=status, priority=priority)

    async def list_my_cases(
        self,
        police_user: User,
        status: Optional[CaseStatus] = None,
        page: int = 1,
        size: int = 20,
    ) -> Sequence[Case]:
        """List cases assigned to the current officer."""
        offset = (page - 1) * size
        return await self.case_repo.list_for_investigator(
            investigator_id=police_user.id,
            status=status,
            offset=offset,
            limit=size,
        )

    async def count_my_cases(
        self,
        police_user: User,
        status: Optional[CaseStatus] = None,
    ) -> int:
        """Count cases assigned to the current officer."""
        return await self.case_repo.count_for_investigator(
            investigator_id=police_user.id,
            status=status,
        )
