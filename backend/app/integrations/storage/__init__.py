"""Storage integration package."""

from app.integrations.storage.storage_interface import (
    LocalStorageService,
    StorageService,
    get_storage_service,
)

__all__ = ["StorageService", "LocalStorageService", "get_storage_service"]
