"""Role-Based Access Control (RBAC) definitions and permission checks."""

from typing import List, Sequence, Union
from app.core.constants import UserRole
from app.core.exceptions import PermissionDeniedException


def check_user_role(user_role: Union[str, UserRole], allowed_roles: Sequence[UserRole]) -> bool:
    """Check if the user's role is in the list of allowed roles."""
    normalized_role = user_role.value if isinstance(user_role, UserRole) else str(user_role)
    allowed_values = [r.value for r in allowed_roles]
    return normalized_role in allowed_values


def enforce_roles(user_role: Union[str, UserRole], allowed_roles: Sequence[UserRole]) -> None:
    """Enforce that a user possesses one of the allowed roles, raising PermissionDeniedException otherwise."""
    if not check_user_role(user_role, allowed_roles):
        roles_str = ", ".join(r.value for r in allowed_roles)
        raise PermissionDeniedException(
            message=f"Access forbidden: requires one of the following roles: [{roles_str}]"
        )
