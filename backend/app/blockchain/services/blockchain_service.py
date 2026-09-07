"""Core blockchain service — orchestrates provider selection and record persistence.

Bridges the abstract blockchain provider interface with the PostgreSQL-backed
BlockchainRecord table for a complete integrity registration workflow.
"""

import uuid
from typing import Any, Dict, Optional

from app.blockchain.constants import BlockchainMode, BlockchainRecordStatus, RecordType
from app.blockchain.models import BlockchainRecord
from app.blockchain.providers.base import (
    BlockchainHealthStatus,
    BlockchainTransaction,
    IBlockchainProvider,
)
from app.blockchain.providers.mock_provider import MockBlockchainProvider
from app.blockchain.repository import BlockchainRepository
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("kritagas.blockchain.service")

# Module-level singleton mock provider (shared across requests)
_mock_provider: Optional[MockBlockchainProvider] = None


def _get_provider() -> IBlockchainProvider:
    """Resolve the blockchain provider based on configuration."""
    global _mock_provider

    mode = getattr(settings, "BLOCKCHAIN_MODE", "mock").lower()

    if mode == BlockchainMode.ETHEREUM.value:
        rpc = getattr(settings, "BLOCKCHAIN_RPC_URL", None)
        pk = getattr(settings, "BLOCKCHAIN_PRIVATE_KEY", None)
        addr = getattr(settings, "BLOCKCHAIN_CONTRACT_ADDRESS", None)
        if not all([rpc, pk, addr]):
            logger.warning("Ethereum config incomplete — falling back to mock provider")
            mode = "mock"
        else:
            from app.blockchain.providers.ethereum_provider import EthereumBlockchainProvider
            return EthereumBlockchainProvider(rpc_url=rpc, private_key=pk, contract_address=addr)

    # Default: mock
    if _mock_provider is None:
        _mock_provider = MockBlockchainProvider()
    return _mock_provider


class BlockchainService:
    """High-level blockchain operations combining provider calls with DB persistence."""

    def __init__(self, repo: BlockchainRepository):
        self.repo = repo
        self.provider: IBlockchainProvider = _get_provider()

    def _is_enabled(self) -> bool:
        """Check if blockchain features are enabled."""
        return getattr(settings, "BLOCKCHAIN_ENABLED", False) or \
               getattr(settings, "ENABLE_BLOCKCHAIN", False)

    async def register_hash(
        self,
        data_hash: str,
        record_type: str,
        entity_type: str,
        entity_id: str,
        case_id: Optional[uuid.UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[BlockchainRecord]:
        """Register a hash with the blockchain provider and persist the record.

        If blockchain is disabled, returns None (non-blocking).
        """
        if not self._is_enabled():
            logger.debug(f"Blockchain disabled — skipping registration for {entity_type}:{entity_id}")
            return None

        try:
            tx: BlockchainTransaction = await self.provider.register_hash(
                data_hash=data_hash,
                entity_type=entity_type,
                entity_id=entity_id,
                metadata=metadata,
            )

            # Persist to PostgreSQL
            record = BlockchainRecord(
                record_type=record_type,
                entity_type=entity_type,
                entity_id=entity_id,
                case_id=case_id,
                data_hash=data_hash,
                previous_hash=tx.previous_hash,
                block_number=tx.block_number,
                transaction_id=tx.transaction_id,
                provider=tx.provider,
                status=BlockchainRecordStatus.REGISTERED.value,
                metadata_json=tx.metadata,
            )
            record = await self.repo.create_blockchain_record(record)

            logger.info(
                f"Blockchain record created: {record_type} | entity={entity_type}:{entity_id} | "
                f"tx={tx.transaction_id[:24]}... | block={tx.block_number}"
            )
            return record

        except Exception as e:
            logger.error(f"Blockchain registration failed for {entity_type}:{entity_id}: {e}")
            return None

    async def verify_hash(
        self,
        transaction_id: str,
        current_hash: str,
    ) -> bool:
        """Verify a hash against its blockchain-registered value."""
        if not self._is_enabled():
            return True  # Pass-through when disabled

        try:
            # First try provider verification
            result = await self.provider.verify_hash(transaction_id, current_hash)

            # Fallback: verify against DB record
            if not result:
                db_record = await self.repo.get_by_transaction_id(transaction_id)
                if db_record:
                    result = db_record.data_hash == current_hash

            return result
        except Exception as e:
            logger.error(f"Blockchain verification failed for tx={transaction_id}: {e}")
            return False

    async def get_record(self, record_id: uuid.UUID) -> Optional[BlockchainRecord]:
        """Retrieve a blockchain record by ID."""
        return await self.repo.get_blockchain_record(record_id)

    async def get_record_by_tx(self, transaction_id: str) -> Optional[BlockchainRecord]:
        """Retrieve a blockchain record by transaction ID."""
        return await self.repo.get_by_transaction_id(transaction_id)

    async def health_check(self) -> BlockchainHealthStatus:
        """Check blockchain provider health."""
        if not self._is_enabled():
            return BlockchainHealthStatus(
                provider="none",
                mode="disabled",
                status="disabled",
                block_height=0,
                details={"message": "Blockchain features are disabled."},
            )
        try:
            return await self.provider.health_check()
        except Exception as e:
            return BlockchainHealthStatus(
                provider="unknown",
                mode=getattr(settings, "BLOCKCHAIN_MODE", "mock"),
                status="unavailable",
                block_height=0,
                details={"error": str(e)},
            )
