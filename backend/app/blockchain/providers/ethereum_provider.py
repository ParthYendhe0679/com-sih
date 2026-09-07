"""Ethereum blockchain provider placeholder.

This module provides the interface stub for a future Ethereum/Polygon integration.
It is NOT functional and will raise NotImplementedError if used without proper configuration.
"""

from typing import Any, Dict, Optional

from app.blockchain.providers.base import (
    BlockchainHealthStatus,
    BlockchainTransaction,
    IBlockchainProvider,
)
from app.core.logging import get_logger

logger = get_logger("kritagas.blockchain.ethereum")


class EthereumBlockchainProvider(IBlockchainProvider):
    """Placeholder for future Ethereum/Polygon blockchain integration.

    Requires:
        - BLOCKCHAIN_RPC_URL
        - BLOCKCHAIN_PRIVATE_KEY
        - BLOCKCHAIN_CONTRACT_ADDRESS

    To enable, set BLOCKCHAIN_MODE=ethereum in .env and provide the required
    configuration values.
    """

    def __init__(self, rpc_url: str, private_key: str, contract_address: str):
        self._rpc_url = rpc_url
        self._private_key = private_key
        self._contract_address = contract_address

    async def initialize(self) -> None:
        raise NotImplementedError(
            "Ethereum blockchain provider is not yet implemented. "
            "Use BLOCKCHAIN_MODE=mock for development. "
            "Production Ethereum integration requires web3.py and a deployed smart contract."
        )

    async def register_hash(
        self,
        data_hash: str,
        entity_type: str,
        entity_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> BlockchainTransaction:
        raise NotImplementedError("Ethereum provider not implemented.")

    async def verify_hash(self, transaction_id: str, expected_hash: str) -> bool:
        raise NotImplementedError("Ethereum provider not implemented.")

    async def get_transaction(self, transaction_id: str) -> Optional[BlockchainTransaction]:
        raise NotImplementedError("Ethereum provider not implemented.")

    async def health_check(self) -> BlockchainHealthStatus:
        return BlockchainHealthStatus(
            provider="ethereum",
            mode="ethereum",
            status="unavailable",
            block_height=0,
            details={"message": "Ethereum provider not yet implemented."},
        )
