"""KRITAGAS Demo Data Reset Utility.

Safely purges ONLY synthetic demo data tagged with data_source = 'KRITAGAS_DEMO'
across PostgreSQL, Neo4j Aura Graph Database, and Valkey / Redis Cache.
Leaves all real cases, authentic FIRs, users, and audit logs 100% untouched.
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from sqlalchemy import text
from neo4j import AsyncGraphDatabase

from app.core.config import settings
from app.db.session import engine
from app.services.cache_service import cache_service

async def reset_postgresql():
    print("Resetting synthetic demo data in PostgreSQL...", flush=True)
    async with engine.connect() as conn:
        # Delete dependent child tables first
        r1 = await conn.execute(text("DELETE FROM entity_relationships WHERE data_source = 'KRITAGAS_DEMO' OR case_id IN (SELECT id FROM cases WHERE data_source = 'KRITAGAS_DEMO');"))
        r2 = await conn.execute(text("DELETE FROM case_entity_contexts WHERE case_id IN (SELECT id FROM cases WHERE data_source = 'KRITAGAS_DEMO');"))
        r3 = await conn.execute(text("DELETE FROM case_similarities WHERE source_case_id IN (SELECT id FROM cases WHERE data_source = 'KRITAGAS_DEMO');"))
        r4 = await conn.execute(text("DELETE FROM geo_temporal_events WHERE data_source = 'KRITAGAS_DEMO';"))
        r5 = await conn.execute(text("DELETE FROM cases WHERE data_source = 'KRITAGAS_DEMO';"))
        r6 = await conn.execute(text("DELETE FROM firs WHERE data_source = 'KRITAGAS_DEMO';"))
        r7 = await conn.execute(text("DELETE FROM entities WHERE data_source = 'KRITAGAS_DEMO';"))
        await conn.commit()

        print(f"  -> Deleted {r1.rowcount} demo entity relationships.")
        print(f"  -> Deleted {r2.rowcount} demo case-entity role contexts.")
        print(f"  -> Deleted {r3.rowcount} demo case similarities.")
        print(f"  -> Deleted {r4.rowcount} demo geo-temporal events.")
        print(f"  -> Deleted {r5.rowcount} demo cases.")
        print(f"  -> Deleted {r6.rowcount} demo FIRs.")
        print(f"  -> Deleted {r7.rowcount} demo entities.")

async def reset_neo4j():
    print("\nResetting synthetic demo data in Neo4j Aura...", flush=True)
    uri = settings.NEO4J_URI
    user = settings.NEO4J_USERNAME
    password = settings.NEO4J_PASSWORD
    db_name = settings.NEO4J_DATABASE or "7fb5bcab"

    driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
    try:
        async with driver.session(database=db_name) as session:
            res = await session.run("MATCH (n {data_source: 'KRITAGAS_DEMO'}) DETACH DELETE n RETURN count(n) AS deleted_nodes")
            rec = await res.single()
            deleted = rec["deleted_nodes"] if rec else 0
            print(f"  -> Deleted {deleted} demo nodes and all incident relationships in Neo4j Aura.")
    finally:
        await driver.close()

async def reset_valkey():
    print("\nInvalidating demo cache namespaces in Valkey / Redis...", flush=True)
    keys_to_delete = [
        "kritagas:dashboard:overview",
        "kritagas:case:MUM-2026-CR-00101:network",
        "kritagas:case:THN-2026-CR-00204:network",
        "kritagas:case:NAV-2026-CR-00307:network",
        "kritagas:hotspots:summary",
    ]
    for key in keys_to_delete:
        await cache_service.delete(key)
        print(f"  -> Cleared cache key: {key}")

async def main():
    print("=================================================================")
    print("  KRITAGAS SYNTHETIC DEMO DATA RESET UTILITY")
    print("=================================================================")
    try:
        await reset_postgresql()
        await reset_neo4j()
        await reset_valkey()
        print("\nDemo Data Reset Completed Successfully!")
    finally:
        await engine.dispose()
        await cache_service.close()

if __name__ == "__main__":
    asyncio.run(main())
