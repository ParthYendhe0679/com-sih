"""Abstract blockchain provider interface.

All blockchain providers (mock, Ethereum, Polygon, Hyperledger) must implement
this interface to ensure clean swappability.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class BlockchainTransaction:
    """Result of a blockchain registration operation."""
    transaction_id: str
    block_number: int
    data_hash: str
    previous_hash: Optional[str]
    provider: str
    status: str
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class BlockchainHealthStatus:
    """Provider health check result."""
    provider: str
    mode: str
    status: str  # "healthy" | "degraded" | "unavailable"
    block_height: int
    details: Optional[Dict[str, Any]] = None


class IBlockchainProvider(ABC):
    """Abstract interface for blockchain providers.

    Any concrete provider (MockBlockchainProvider, EthereumBlockchainProvider, etc.)
    must implement all methods below.
    """

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the provider connection/state."""
        ...

    @abstractmethod
    async def register_hash(
        self,
        data_hash: str,
        entity_type: str,
        entity_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> BlockchainTransaction:
        """Register a cryptographic hash on the blockchain.

        Args:
            data_hash: SHA-256 hex digest of the evidence/entity data.
            entity_type: Type of entity being registered (e.g. 'EVIDENCE', 'FIR').
            entity_id: Unique identifier of the entity.
            metadata: Optional additional metadata to store alongside.

        Returns:
            BlockchainTransaction with transaction details.
        """
        ...

    @abstractmethod
    async def verify_hash(
        self,
        transaction_id: str,
        expected_hash: str,
    ) -> bool:
        """Verify that a previously registered hash matches the expected value.

        Args:
            transaction_id: The blockchain transaction reference.
            expected_hash: The hash to verify against.

        Returns:
            True if the hash matches, False otherwise.
        """
        ...

    @abstractmethod
    async def get_transaction(
        self,
        transaction_id: str,
    ) -> Optional[BlockchainTransaction]:
        """Retrieve details of a specific blockchain transaction.

        Args:
            transaction_id: The blockchain transaction reference.

        Returns:
            BlockchainTransaction if found, None otherwise.
        """
        ...

    @abstractmethod
    async def health_check(self) -> BlockchainHealthStatus:
        """Check provider connectivity and health.

        Returns:
            BlockchainHealthStatus with current status information.
        """
        ...
