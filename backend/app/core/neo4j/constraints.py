"""Idempotent Neo4j Schema Constraints and Indexes for KRITAGAS.

Guarantees data integrity, fast node resolution, and instant lookup by ID,
normalized values, and case numbers across criminal network graphs.
"""

from typing import List, Tuple
from app.core.logging import get_logger
from app.core.neo4j.client import Neo4jClient

logger = get_logger("kritagas.neo4j.schema")

# Idempotent uniqueness constraints (Neo4j 5.x compatible syntax)
CONSTRAINTS: List[Tuple[str, str]] = [
    ("constraint_person_id", "CREATE CONSTRAINT constraint_person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE"),
    ("constraint_case_id", "CREATE CONSTRAINT constraint_case_id IF NOT EXISTS FOR (c:Case) REQUIRE c.id IS UNIQUE"),
    ("constraint_phone_id", "CREATE CONSTRAINT constraint_phone_id IF NOT EXISTS FOR (p:Phone) REQUIRE p.id IS UNIQUE"),
    ("constraint_vehicle_id", "CREATE CONSTRAINT constraint_vehicle_id IF NOT EXISTS FOR (v:Vehicle) REQUIRE v.id IS UNIQUE"),
    ("constraint_location_id", "CREATE CONSTRAINT constraint_location_id IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE"),
    ("constraint_organization_id", "CREATE CONSTRAINT constraint_organization_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE"),
    ("constraint_account_id", "CREATE CONSTRAINT constraint_account_id IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE"),
    ("constraint_transaction_id", "CREATE CONSTRAINT constraint_transaction_id IF NOT EXISTS FOR (t:Transaction) REQUIRE t.id IS UNIQUE"),
    ("constraint_fir_id", "CREATE CONSTRAINT constraint_fir_id IF NOT EXISTS FOR (f:FIR) REQUIRE f.id IS UNIQUE"),
    ("constraint_evidence_id", "CREATE CONSTRAINT constraint_evidence_id IF NOT EXISTS FOR (e:Evidence) REQUIRE e.id IS UNIQUE"),
]

# Secondary lookup indexes for high performance traversals
INDEXES: List[Tuple[str, str]] = [
    ("index_person_name", "CREATE INDEX index_person_name IF NOT EXISTS FOR (p:Person) ON (p.name)"),
    ("index_person_normalized", "CREATE INDEX index_person_normalized IF NOT EXISTS FOR (p:Person) ON (p.normalized_name)"),
    ("index_phone_number", "CREATE INDEX index_phone_number IF NOT EXISTS FOR (p:Phone) ON (p.phone_number)"),
    ("index_vehicle_reg", "CREATE INDEX index_vehicle_reg IF NOT EXISTS FOR (v:Vehicle) ON (v.registration_number)"),
    ("index_case_number", "CREATE INDEX index_case_number IF NOT EXISTS FOR (c:Case) ON (c.case_number)"),
]


async def init_neo4j_schema(client: Neo4jClient) -> bool:
    """Initialize all constraints and indexes idempotently on Neo4j."""
    if not client.is_configured:
        logger.debug("Neo4j is not configured; skipping schema constraints initialization.")
        return False

    is_healthy, _, err = await client.verify_connectivity()
    if not is_healthy:
        logger.warning(f"Cannot initialize Neo4j schema: database not reachable ({err}).")
        return False

    logger.info("Initializing KRITAGAS Neo4j uniqueness constraints and indexes...")
    success_count = 0

    for name, cypher in CONSTRAINTS:
        try:
            await client.execute_query(cypher)
            success_count += 1
        except Exception as e:
            logger.warning(f"Constraint creation notice for '{name}': {e}")

    for name, cypher in INDEXES:
        try:
            await client.execute_query(cypher)
            success_count += 1
        except Exception as e:
            logger.warning(f"Index creation notice for '{name}': {e}")

    logger.info(f"Neo4j schema initialization completed. {success_count}/{len(CONSTRAINTS) + len(INDEXES)} applied.")
    return True
