"""Mock blockchain provider for development and demonstration.

Simulates a blockchain ledger using an in-memory block chain with proper hash
linking. Each 'block' references the previous block's hash, creating a
tamper-evident chain suitable for SIH demo and local development.

No real blockchain infrastructure is required.
"""

import hashlib
import secrets
import time
from typing import Any, Dict, List, Optional

from app.blockchain.providers.base import (
    BlockchainHealthStatus,
    BlockchainTransaction,
    IBlockchainProvider,
)
from app.core.logging import get_logger

logger = get_logger("kritagas.blockchain.mock")

# Genesis block hash — deterministic seed for the mock chain
GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


class MockBlockchainProvider(IBlockchainProvider):
    """Development blockchain provider that maintains an in-memory ledger.

    - Auto-incrementing block numbers
    - Hash chaining: each block references previous block's hash
    - Generates mock_tx_<hex> transaction IDs
    - Full verification support
    """

    def __init__(self):
        self._ledger: Dict[str, BlockchainTransaction] = {}
        self._block_number: int = 0
        self._last_block_hash: str = GENESIS_HASH
        self._initialized: bool = False

    async def initialize(self) -> None:
        """Initialize mock provider."""
        self._initialized = True
        logger.info("MockBlockchainProvider initialized (development ledger mode)")

    async def register_hash(
        self,
        data_hash: str,
        entity_type: str,
        entity_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> BlockchainTransaction:
        """Register a hash by creating a new block in the mock ledger."""
        if not self._initialized:
            await self.initialize()

        self._block_number += 1
        previous_hash = self._last_block_hash

        # Generate a deterministic block hash from the chain
        block_content = f"{self._block_number}:{previous_hash}:{data_hash}:{entity_type}:{entity_id}:{time.time()}"
        current_block_hash = hashlib.sha256(block_content.encode("utf-8")).hexdigest()

        # Generate a unique mock transaction ID
        tx_id = f"mock_tx_{secrets.token_hex(16)}"

        transaction = BlockchainTransaction(
            transaction_id=tx_id,
            block_number=self._block_number,
            data_hash=data_hash,
            previous_hash=previous_hash,
            provider="mock",
            status="REGISTERED",
            metadata={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "block_hash": current_block_hash,
                "registered_at": time.time(),
                **(metadata or {}),
            },
        )

        self._ledger[tx_id] = transaction
        self._last_block_hash = current_block_hash

        logger.info(
            f"Mock block #{self._block_number} created | tx={tx_id[:24]}... | "
            f"entity={entity_type}:{entity_id} | hash={data_hash[:16]}..."
        )

        return transaction

    async def verify_hash(
        self,
        transaction_id: str,
        expected_hash: str,
    ) -> bool:
        """Verify that the hash registered under the given transaction matches."""
        tx = self._ledger.get(transaction_id)
        if tx is None:
            logger.warning(f"Transaction {transaction_id} not found in mock ledger")
            return False

        matches = tx.data_hash == expected_hash
        if not matches:
            logger.warning(
                f"Hash mismatch for tx={transaction_id}: "
                f"registered={tx.data_hash[:16]}... vs expected={expected_hash[:16]}..."
            )
        return matches

    async def get_transaction(
        self,
        transaction_id: str,
    ) -> Optional[BlockchainTransaction]:
        """Retrieve a transaction from the mock ledger."""
        return self._ledger.get(transaction_id)

    async def health_check(self) -> BlockchainHealthStatus:
        """Return mock provider health status."""
        return BlockchainHealthStatus(
            provider="mock",
            mode="mock",
            status="healthy",
            block_height=self._block_number,
            details={
                "total_transactions": len(self._ledger),
                "last_block_hash": self._last_block_hash[:16] + "...",
                "genesis_hash": GENESIS_HASH[:16] + "...",
            },
        )
