"""State transition validation and domain business logic tests."""

import pytest
from app.core.constants import CaseStatus, FIRStatus
from app.core.exceptions import InvalidStateTransitionException, ValidationException
from app.utils.validators import (
    validate_case_transition,
    validate_fir_transition,
    validate_password_strength,
)


def test_fir_valid_state_transitions():
    # Valid transitions
    validate_fir_transition(FIRStatus.DRAFT, FIRStatus.SUBMITTED)
    validate_fir_transition(FIRStatus.SUBMITTED, FIRStatus.UNDER_REVIEW)
    validate_fir_transition(FIRStatus.UNDER_REVIEW, FIRStatus.ACCEPTED)
    validate_fir_transition(FIRStatus.UNDER_REVIEW, FIRStatus.REJECTED)
    validate_fir_transition(FIRStatus.UNDER_REVIEW, FIRStatus.MORE_INFORMATION_REQUIRED)
    validate_fir_transition(FIRStatus.MORE_INFORMATION_REQUIRED, FIRStatus.UNDER_REVIEW)
    validate_fir_transition(FIRStatus.ACCEPTED, FIRStatus.CONVERTED_TO_CASE)


def test_fir_invalid_state_transitions():
    # Attempting to jump directly from DRAFT to ACCEPTED
    with pytest.raises(InvalidStateTransitionException):
        validate_fir_transition(FIRStatus.DRAFT, FIRStatus.ACCEPTED)

    # Attempting to revive a REJECTED FIR
    with pytest.raises(InvalidStateTransitionException):
        validate_fir_transition(FIRStatus.REJECTED, FIRStatus.ACCEPTED)


def test_case_valid_state_transitions():
    validate_case_transition(CaseStatus.OPEN, CaseStatus.UNDER_INVESTIGATION)
    validate_case_transition(CaseStatus.UNDER_INVESTIGATION, CaseStatus.ACTIVE)
    validate_case_transition(CaseStatus.ACTIVE, CaseStatus.ON_HOLD)
    validate_case_transition(CaseStatus.ON_HOLD, CaseStatus.ACTIVE)
    validate_case_transition(CaseStatus.ACTIVE, CaseStatus.CLOSED)


def test_case_invalid_state_transitions():
    # Direct jump from OPEN to CLOSED
    with pytest.raises(InvalidStateTransitionException):
        validate_case_transition(CaseStatus.OPEN, CaseStatus.CLOSED)


def test_password_strength():
    # Valid password
    validate_password_strength("StrongP@ss123")

    # Too short
    with pytest.raises(ValidationException):
        validate_password_strength("Short1")

    # Missing uppercase
    with pytest.raises(ValidationException):
        validate_password_strength("lowercase123")

    # Missing digits
    with pytest.raises(ValidationException):
        validate_password_strength("OnlyLettersHere")
