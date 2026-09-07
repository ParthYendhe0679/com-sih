"""Domain validation rules and state machine transition checkers."""

import re
from typing import Dict, Set
from app.core.constants import CaseStatus, FIRStatus
from app.core.exceptions import InvalidStateTransitionException, ValidationException

# Valid state machine transitions for FIRs
FIR_STATE_TRANSITIONS: Dict[FIRStatus, Set[FIRStatus]] = {
    FIRStatus.DRAFT: {FIRStatus.SUBMITTED},
    FIRStatus.SUBMITTED: {
        FIRStatus.UNDER_REVIEW,
        FIRStatus.ACCEPTED,
        FIRStatus.REJECTED,
        FIRStatus.MORE_INFORMATION_REQUIRED,
    },
    FIRStatus.UNDER_REVIEW: {
        FIRStatus.ACCEPTED,
        FIRStatus.REJECTED,
        FIRStatus.MORE_INFORMATION_REQUIRED,
    },
    FIRStatus.MORE_INFORMATION_REQUIRED: {
        FIRStatus.SUBMITTED,
        FIRStatus.UNDER_REVIEW,
    },
    FIRStatus.ACCEPTED: {FIRStatus.CONVERTED_TO_CASE},
    FIRStatus.REJECTED: set(),
    FIRStatus.CONVERTED_TO_CASE: set(),
}

# Valid state machine transitions for Cases
CASE_STATE_TRANSITIONS: Dict[CaseStatus, Set[CaseStatus]] = {
    CaseStatus.OPEN: {CaseStatus.UNDER_INVESTIGATION},
    CaseStatus.UNDER_INVESTIGATION: {
        CaseStatus.ACTIVE,
        CaseStatus.ON_HOLD,
        CaseStatus.CLOSED,
    },
    CaseStatus.ACTIVE: {
        CaseStatus.UNDER_INVESTIGATION,
        CaseStatus.ON_HOLD,
        CaseStatus.CLOSED,
    },
    CaseStatus.ON_HOLD: {
        CaseStatus.UNDER_INVESTIGATION,
        CaseStatus.ACTIVE,
        CaseStatus.CLOSED,
    },
    CaseStatus.CLOSED: {
        CaseStatus.ACTIVE,  # Reopened under specific administrative review
    },
}


def validate_fir_transition(current_status: FIRStatus, target_status: FIRStatus) -> None:
    """Validate whether an FIR status transition is permitted by the workflow state machine."""
    if current_status == target_status:
        return

    allowed = FIR_STATE_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise InvalidStateTransitionException(
            entity_name="FIR",
            current_state=current_status.value,
            target_state=target_status.value,
            details={
                "allowed_next_states": [s.value for s in allowed],
            },
        )


def validate_case_transition(current_status: CaseStatus, target_status: CaseStatus) -> None:
    """Validate whether a Case status transition is permitted by the workflow state machine."""
    if current_status == target_status:
        return

    allowed = CASE_STATE_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise InvalidStateTransitionException(
            entity_name="Case",
            current_state=current_status.value,
            target_state=target_status.value,
            details={
                "allowed_next_states": [s.value for s in allowed],
            },
        )


def validate_password_strength(password: str) -> None:
    """Validate password length and character complexity requirements."""
    if len(password) < 8:
        raise ValidationException("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise ValidationException("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValidationException("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        raise ValidationException("Password must contain at least one digit.")
