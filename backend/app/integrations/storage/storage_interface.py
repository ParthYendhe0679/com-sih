"""Storage abstraction interface and local filesystem provider."""

from abc import ABC, abstractmethod
import os
import uuid
from typing import Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("kritagas.storage")


class StorageService(ABC):
    """Abstract interface for storing and retrieving binary file evidence and document scans."""

    @abstractmethod
    async def upload(
        self,
        file_content: bytes,
        file_name: str,
        mime_type: Optional[str] = None,
    ) -> str:
        """Upload file bytes and return the canonical access URL or path."""
        pass

    @abstractmethod
    async def download(self, file_url: str) -> bytes:
        """Download and return raw file bytes from storage."""
        pass

    @abstractmethod
    async def delete(self, file_url: str) -> bool:
        """Remove a file from storage."""
        pass


class LocalStorageService(StorageService):
    """Local filesystem storage implementation for development and testing environments."""

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or settings.LOCAL_STORAGE_DIR
        os.makedirs(self.base_dir, exist_ok=True)

    async def upload(
        self,
        file_content: bytes,
        file_name: str,
        mime_type: Optional[str] = None,
    ) -> str:
        unique_prefix = uuid.uuid4().hex[:8]
        safe_name = f"{unique_prefix}_{file_name}"
        destination = os.path.join(self.base_dir, safe_name)

        with open(destination, "wb") as f:
            f.write(file_content)

        logger.info(f"Stored file '{file_name}' locally at '{destination}'")
        # Return normalized URL path
        return f"/uploads/{safe_name}"

    async def download(self, file_url: str) -> bytes:
        file_name = os.path.basename(file_url)
        target_path = os.path.join(self.base_dir, file_name)
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Storage file not found: {file_url}")
        with open(target_path, "rb") as f:
            return f.read()

    async def delete(self, file_url: str) -> bool:
        file_name = os.path.basename(file_url)
        target_path = os.path.join(self.base_dir, file_name)
        if os.path.exists(target_path):
            os.remove(target_path)
            logger.info(f"Deleted local file '{target_path}'")
            return True
        return False


def get_storage_service() -> StorageService:
    """Dependency factory returning the active StorageService implementation."""
    return LocalStorageService()
