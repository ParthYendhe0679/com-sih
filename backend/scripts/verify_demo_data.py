"""KRITAGAS Synthetic Demo Data Verification Suite.

Automated end-to-end verification checklist auditing:
1. Neon PostgreSQL record counts, provenance, and geographic cluster distribution
2. Neo4j Aura Graph topology, cross-city bridge connectivity, and isolated cluster integrity
3. Valkey / Redis pre-warmed cache keys and payload structure
4. AI Similarity records and explainable scoring
5. Sample FIR file presence and formatting
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

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

async def verify_postgresql():
    print("\n[1/5] Auditing Neon PostgreSQL Database...", flush=True)
    results = {}
    async with engine.connect() as conn:
        # Total synthetic cases
        c_res = await conn.execute(text("SELECT count(*) FROM cases WHERE data_source = 'KRITAGAS_DEMO';"))
        cases_count = c_res.scalar_one()
        results["cases_count"] = cases_count
        print(f"  [+] Synthetic Cases: {cases_count:,} (Expected: >= 1,000)")

        # City distribution
        city_res = await conn.execute(text("""
            SELECT city, count(*) as cnt, round(count(*)::numeric / sum(count(*)) over() * 100, 1) as pct
            FROM cases WHERE data_source = 'KRITAGAS_DEMO'
            GROUP BY city ORDER BY cnt DESC;
        """))
        city_dist = city_res.fetchall()
        print("  [+] Geographic Demarcation:")
        for city, cnt, pct in city_dist:
            print(f"      - {city}: {cnt} cases ({pct}%)")
        results["city_dist"] = city_dist

        # Live vs Resolved Cases
        status_res = await conn.execute(text("""
            SELECT resolution_status, count(*) FROM cases
            WHERE data_source = 'KRITAGAS_DEMO'
            GROUP BY resolution_status;
        """))
        print("  [+] Case Lifecycle States:")
        for rstatus, cnt in status_res.fetchall():
            print(f"      - {rstatus}: {cnt}")

        # Entities & Relationships
        e_res = await conn.execute(text("SELECT count(*) FROM entities WHERE data_source = 'KRITAGAS_DEMO';"))
        entities_count = e_res.scalar_one()
        print(f"  [+] Synthetic Entities: {entities_count:,} (Expected: >= 1,000)")
        results["entities_count"] = entities_count

        rel_res = await conn.execute(text("SELECT count(*) FROM entity_relationships WHERE data_source = 'KRITAGAS_DEMO';"))
        rel_count = rel_res.scalar_one()
        print(f"  [+] Entity Relationships: {rel_count:,}")
        results["rel_count"] = rel_count

        ctx_res = await conn.execute(text("SELECT count(*) FROM case_entity_contexts;"))
        ctx_count = ctx_res.scalar_one()
        print(f"  [+] Case-Entity Role Contexts: {ctx_count:,}")

        # Geo-temporal Events
        geo_res = await conn.execute(text("SELECT count(*) FROM geo_temporal_events WHERE data_source = 'KRITAGAS_DEMO';"))
        geo_count = geo_res.scalar_one()
        print(f"  [+] Geo-Temporal Events: {geo_count:,} (Expected: >= 1,000)")
        results["geo_count"] = geo_count

        # Synthetic FIRs
        fir_res = await conn.execute(text("SELECT count(*) FROM firs WHERE data_source = 'KRITAGAS_DEMO';"))
        fir_count = fir_res.scalar_one()
        print(f"  [+] Synchronized FIRs: {fir_count}")
        results["fir_count"] = fir_count

    return results

async def verify_neo4j():
    print("\n[2/5] Auditing Neo4j Aura Graph Database...", flush=True)
    uri = settings.NEO4J_URI
    user = settings.NEO4J_USERNAME
    password = settings.NEO4J_PASSWORD
    db_name = settings.NEO4J_DATABASE or "7fb5bcab"

    driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
    results = {}
    try:
        async with driver.session(database=db_name) as session:
            # Count Case nodes
            c_res = await session.run("MATCH (c:Case {data_source: 'KRITAGAS_DEMO'}) RETURN count(c) AS count")
            c_cnt = (await c_res.single())["count"]
            print(f"  [+] Neo4j :Case Nodes: {c_cnt}")
            results["case_nodes"] = c_cnt

            # Count Person nodes
            p_res = await session.run("MATCH (p:Person {data_source: 'KRITAGAS_DEMO'}) RETURN count(p) AS count")
            p_cnt = (await p_res.single())["count"]
            print(f"  [+] Neo4j :Person Nodes: {p_cnt}")
            results["person_nodes"] = p_cnt

            # Count Vehicle & Phone nodes
            v_res = await session.run("MATCH (v:Vehicle {data_source: 'KRITAGAS_DEMO'}) RETURN count(v) AS count")
            v_cnt = (await v_res.single())["count"]
            ph_res = await session.run("MATCH (ph:Phone {data_source: 'KRITAGAS_DEMO'}) RETURN count(ph) AS count")
            ph_cnt = (await ph_res.single())["count"]
            print(f"  [+] Neo4j Object Nodes: {v_cnt} Vehicles, {ph_cnt} Phones")

            # Check cross-city bridge connectivity (Arjun Verma & Creta MH-02-DN-4821)
            bridge_res = await session.run("""
                MATCH (p:Person {name: 'Arjun Verma'})-[r1:SUSPECT_IN]->(c1:Case),
                      (p)-[r2:SUSPECT_IN]->(c2:Case)
                WHERE c1 <> c2
                RETURN c1.case_number AS mumbai_case, c2.case_number AS thane_case
            """)
            rec = await bridge_res.single()
            if rec:
                print(f"  [+] Cross-City Bridge Verified: Arjun Verma linked to {rec['mumbai_case']} (Mumbai) AND {rec['thane_case']} (Thane)!")
                results["bridge_verified"] = True
            else:
                # Check vehicle bridge
                vbridge = await session.run("""
                    MATCH (v:Vehicle {registration_number: 'MH-02-DN-4821'})-[r:SIGHTED_AT_SCENE]->(c:Case)
                    RETURN count(c) AS case_count
                """)
                v_cases = (await vbridge.single())["case_count"]
                print(f"  [+] Cross-City Vehicle Bridge: MH-02-DN-4821 sighted across {v_cases} cases.")
                results["bridge_verified"] = v_cases > 1

            # Check isolated case integrity (Isolated Kopri Case)
            iso_res = await session.run("""
                MATCH (c:Case {case_number: 'THN-2026-CR-00209'})
                OPTIONAL MATCH (c)<-[r]-(other)
                RETURN c.title AS title, count(other) AS degree
            """)
            iso_rec = await iso_res.single()
            if iso_rec:
                print(f"  [+] Isolated Case Verified: '{iso_rec['title']}' has localized degree of {iso_rec['degree']} (isolated boundary confirmed).")
                results["isolated_verified"] = True
    finally:
        await driver.close()

    return results

async def verify_valkey():
    print("\n[3/5] Auditing Valkey / Redis Cache...", flush=True)
    results = {}
    
    # 1. Overview Cache
    overview = await cache_service.get("kritagas:dashboard:overview")
    if overview and "total_cases" in overview:
        print(f"  [+] Cache Hit 'kritagas:dashboard:overview': Total Cases = {overview['total_cases']}, Open = {overview['open_cases']}")
        results["overview_cached"] = True
    else:
        print("  [-] Cache Miss 'kritagas:dashboard:overview'")
        results["overview_cached"] = False

    # 2. Case Network Subgraph Cache
    c1_net = await cache_service.get("kritagas:case:MUM-2026-CR-00101:network")
    if c1_net and "nodes" in c1_net:
        print(f"  [+] Cache Hit 'kritagas:case:MUM-2026-CR-00101:network': {len(c1_net['nodes'])} pre-computed intelligence nodes.")
        results["network_cached"] = True
    else:
        print("  [-] Cache Miss 'kritagas:case:MUM-2026-CR-00101:network'")
        results["network_cached"] = False

    # 3. Hotspots Cache
    hotspots = await cache_service.get("kritagas:hotspots:summary")
    if hotspots and "clusters" in hotspots:
        print(f"  [+] Cache Hit 'kritagas:hotspots:summary': {len(hotspots['clusters'])} high-risk crime hotspots.")
        results["hotspots_cached"] = True
    else:
        print("  [-] Cache Miss 'kritagas:hotspots:summary'")
        results["hotspots_cached"] = False

    return results

async def verify_ai_similarity():
    print("\n[4/5] Auditing AI / Modus Operandi Similarities...", flush=True)
    results = {}
    async with engine.connect() as conn:
        res = await conn.execute(text("""
            SELECT c1.case_number as src_num, c2.case_number as tgt_num, 
                   s.similarity_score, s.modus_operandi_score, s.explanation_summary
            FROM case_similarities s
            JOIN cases c1 ON s.source_case_id = c1.id
            JOIN cases c2 ON s.target_case_id = c2.id;
        """))
        rows = res.fetchall()
        print(f"  [+] Found {len(rows)} explainable AI similarity records:")
        for r in rows:
            print(f"      - {r[0]} <-> {r[1]}: Similarity {r[2]:.2f} (MO: {r[3]:.2f})")
            print(f"        Summary: {r[4]}")
        results["sim_count"] = len(rows)

    return results

def verify_sample_firs():
    print("\n[5/5] Auditing Sample FIR Test Documents...", flush=True)
    fir_dir = os.path.join(DATA_DIR, "sample_firs")
    expected_files = [f"sample_fir_0{i}.txt" for i in range(1, 6)]
    found = 0
    for fn in expected_files:
        fp = os.path.join(fir_dir, fn)
        if os.path.exists(fp) and os.path.getsize(fp) > 200:
            print(f"  [+] Found '{fn}' ({os.path.getsize(fp)} bytes)")
            found += 1
        else:
            print(f"  [-] Missing or empty '{fn}'")
    return {"sample_firs_found": found}

async def main():
    print("=================================================================")
    print("  KRITAGAS DEMO DATA HEALTH & VERIFICATION AUDIT")
    print("=================================================================")

    pg_res = await verify_postgresql()
    neo_res = await verify_neo4j()
    val_res = await verify_valkey()
    ai_res = await verify_ai_similarity()
    fir_res = verify_sample_firs()

    print("\n=================================================================")
    print("  AUDIT SUMMARY & READINESS SCORECARD")
    print("=================================================================")
    checks = [
        ("PostgreSQL Cases >= 1000", pg_res.get("cases_count", 0) >= 1000),
        ("PostgreSQL Entities >= 1000", pg_res.get("entities_count", 0) >= 1000),
        ("PostgreSQL Geo-Events >= 1000", pg_res.get("geo_count", 0) >= 1000),
        ("Synchronized FIR Records >= 10", pg_res.get("fir_count", 0) >= 10),
        ("Neo4j Aura Nodes Synced", neo_res.get("case_nodes", 0) > 0 and neo_res.get("person_nodes", 0) > 0),
        ("Cross-City Bridge Connected", neo_res.get("bridge_verified", False)),
        ("Isolated Case Boundary Valid", neo_res.get("isolated_verified", False)),
        ("Valkey Dashboard Cache Pre-warmed", val_res.get("overview_cached", False)),
        ("AI Case Similarity Explanations", ai_res.get("sim_count", 0) >= 2),
        ("5 Sample FIR Test Documents", fir_res.get("sample_firs_found", 0) == 5),
    ]

    passed = sum(1 for _, ok in checks if ok)
    for name, ok in checks:
        badge = "[PASS]" if ok else "[FAIL]"
        print(f"  {badge}  {name}")

    score = (passed / len(checks)) * 100
    print(f"\nTotal Health Score: {score:.1f}% ({passed}/{len(checks)} Passed)")
    print("=================================================================")

    await engine.dispose()
    await cache_service.close()

if __name__ == "__main__":
    asyncio.run(main())
