"""KRITAGAS Synthetic Demo Data Seeder.

Synchronizes 5,000+ synthetic demo records across:
1. Neon PostgreSQL (Cases, FIRs, Entities, Contexts, Relationships, Geo-Events, Similarities)
2. Neo4j Aura Cloud (Multi-cluster Graph Network with Cross-City Bridge & Isolated Cases)
3. Valkey / Redis Cache (Pre-warmed dashboard metrics and case network subgraphs)

All records are tagged with is_synthetic=True and data_source="KRITAGAS_DEMO".
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import json
import uuid
from datetime import date, datetime, time, timezone
from sqlalchemy import text
from neo4j import AsyncGraphDatabase

from app.core.config import settings
from app.db.session import engine
from app.services.cache_service import cache_service

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "synthetic")

def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

async def seed_postgresql():
    print("\n--- [1/3] Seeding Neon PostgreSQL Database ---", flush=True)
    
    # 1. Load datasets
    cases_data = load_json("dataset_1_cases.json")
    persons_data = load_json("dataset_2_persons.json")
    objects_data = load_json("dataset_3_objects.json")
    relationships_data = load_json("dataset_4_relationships.json")
    geo_events_data = load_json("dataset_5_geo_events.json")
    
    async with engine.connect() as conn:
        # Get Admin & Police User IDs for foreign keys
        user_res = await conn.execute(text("SELECT id, role FROM users WHERE role IN ('ADMIN', 'POLICE') ORDER BY role;"))
        users = {r[1]: r[0] for r in user_res.fetchall()}
        
        admin_id = users.get("ADMIN")
        police_id = users.get("POLICE")
        if not admin_id:
            # Fallback to first available user
            any_user = await conn.execute(text("SELECT id FROM users LIMIT 1;"))
            admin_id = any_user.scalar_one()
            police_id = admin_id
        if not police_id:
            police_id = admin_id

        print(f"Assigning created_by_id: {admin_id}, lead_investigator_id: {police_id}", flush=True)

        # 2. Clean prior demo data
        print("Cleaning prior demo records (data_source = 'KRITAGAS_DEMO')...", flush=True)
        await conn.execute(text("DELETE FROM entity_relationships WHERE case_id IN (SELECT id FROM cases WHERE data_source = 'KRITAGAS_DEMO');"))
        await conn.execute(text("DELETE FROM case_entity_contexts WHERE case_id IN (SELECT id FROM cases WHERE data_source = 'KRITAGAS_DEMO');"))
        await conn.execute(text("DELETE FROM case_similarities WHERE source_case_id IN (SELECT id FROM cases WHERE data_source = 'KRITAGAS_DEMO');"))
        await conn.execute(text("DELETE FROM geo_temporal_events WHERE data_source = 'KRITAGAS_DEMO';"))
        await conn.execute(text("DELETE FROM cases WHERE data_source = 'KRITAGAS_DEMO';"))
        await conn.execute(text("DELETE FROM firs WHERE data_source = 'KRITAGAS_DEMO';"))
        await conn.execute(text("DELETE FROM entities WHERE data_source = 'KRITAGAS_DEMO';"))
        await conn.commit()
        print("Prior demo records cleaned.", flush=True)

        # 3. Seed Cases (batch size 200)
        print(f"Seeding {len(cases_data)} Cases into PostgreSQL...", flush=True)
        case_stmt = text("""
            INSERT INTO cases (
                id, case_number, title, description, crime_category, crime_type,
                priority, status, incident_date, incident_time, city, region,
                police_station, area, latitude, longitude, source,
                is_synthetic, data_source, resolution_status, case_outcome,
                created_by_id, lead_investigator_id, opened_at, created_at, updated_at
            ) VALUES (
                :id, :case_number, :title, :description, :crime_category, :crime_type,
                :priority, :status, :incident_date, :incident_time, :city, :region,
                :police_station, :area, :latitude, :longitude, :source,
                :is_synthetic, :data_source, :resolution_status, :case_outcome,
                :created_by_id, :lead_investigator_id, NOW(), NOW(), NOW()
            ) ON CONFLICT (case_number) DO NOTHING;
        """)

        batch_size = 200
        for i in range(0, len(cases_data), batch_size):
            chunk = cases_data[i:i + batch_size]
            params = []
            for c in chunk:
                # parse date and time
                id_date = datetime.strptime(c["incident_date"], "%Y-%m-%d").date() if c.get("incident_date") else None
                id_time = datetime.strptime(c["incident_time"], "%H:%M:%S").time() if c.get("incident_time") else None
                params.append({
                    "id": uuid.UUID(c["id"]),
                    "case_number": c["case_number"],
                    "title": c["title"],
                    "description": c["description"],
                    "crime_category": c["crime_category"],
                    "crime_type": c.get("crime_type"),
                    "priority": c["priority"],
                    "status": c["status"],
                    "incident_date": id_date,
                    "incident_time": id_time,
                    "city": c.get("city"),
                    "region": c.get("region"),
                    "police_station": c.get("police_station"),
                    "area": c.get("area"),
                    "latitude": c.get("latitude"),
                    "longitude": c.get("longitude"),
                    "source": c.get("source"),
                    "is_synthetic": True,
                    "data_source": "KRITAGAS_DEMO",
                    "resolution_status": c.get("resolution_status"),
                    "case_outcome": c.get("case_outcome"),
                    "created_by_id": admin_id,
                    "lead_investigator_id": police_id,
                })
            await conn.execute(case_stmt, params)
            await conn.commit()
            print(f"  -> Inserted cases batch {i + len(chunk)}/{len(cases_data)}", flush=True)

        # 4. Seed Matching FIRs for Live Cases (10 live cases)
        print("Seeding synchronized FIR records for the 10 live cases...", flush=True)
        fir_stmt = text("""
            INSERT INTO firs (
                id, fir_number, title, description, crime_category,
                incident_date, incident_time, incident_location, priority,
                status, submitted_by_id, reviewed_by_id, is_offline, processing_status,
                is_synthetic, data_source,
                created_at, updated_at
            ) VALUES (
                :id, :fir_number, :title, :description, :crime_category,
                :incident_date, :incident_time, :incident_location, :priority,
                :status, :submitted_by_id, :reviewed_by_id, :is_offline, :processing_status,
                :is_synthetic, :data_source,
                NOW(), NOW()
            ) ON CONFLICT (fir_number) DO NOTHING;
        """)

        fir_params = []
        for c in cases_data[:10]:
            c_date = datetime.strptime(c["incident_date"], "%Y-%m-%d").date() if c.get("incident_date") else None
            c_time = datetime.strptime(c["incident_time"], "%H:%M:%S").time() if c.get("incident_time") else None
            fir_params.append({
                "id": uuid.uuid4(),
                "fir_number": f"FIR-{c['case_number']}",
                "title": c["title"],
                "description": c["description"],
                "crime_category": c["crime_category"],
                "incident_date": c_date,
                "incident_time": c_time,
                "incident_location": f"{c.get('area')}, {c.get('city')}",
                "priority": c["priority"],
                "status": "CONVERTED_TO_CASE",
                "submitted_by_id": admin_id,
                "reviewed_by_id": police_id,
                "is_offline": False,
                "processing_status": "COMPLETED",
                "is_synthetic": True,
                "data_source": "KRITAGAS_DEMO",
            })
        await conn.execute(fir_stmt, fir_params)
        await conn.commit()
        print("  -> Inserted 10 synchronized FIR records.", flush=True)

        # 5. Seed Entities (Persons and Vehicles/Objects)
        all_entities = persons_data + objects_data
        print(f"Seeding {len(all_entities)} Entities into PostgreSQL...", flush=True)
        entity_stmt = text("""
            INSERT INTO entities (
                id, entity_type, name, normalized_value, confidence,
                source_text, attributes_json, is_canonical, is_synthetic, data_source,
                created_at, updated_at
            ) VALUES (
                :id, :entity_type, :name, :normalized_value, :confidence,
                :source_text, :attributes_json, :is_canonical, :is_synthetic, :data_source,
                NOW(), NOW()
            ) ON CONFLICT (id) DO NOTHING;
        """)

        for i in range(0, len(all_entities), batch_size):
            chunk = all_entities[i:i + batch_size]
            params = []
            for e in chunk:
                attrs = {k: v for k, v in e.items() if k not in ["id", "entity_type", "name", "normalized_value", "notes"]}
                params.append({
                    "id": uuid.UUID(e["id"]),
                    "entity_type": e["entity_type"],
                    "name": e["name"],
                    "normalized_value": e["normalized_value"],
                    "confidence": 1.0,
                    "source_text": e.get("notes"),
                    "attributes_json": json.dumps(attrs),
                    "is_canonical": True,
                    "is_synthetic": True,
                    "data_source": "KRITAGAS_DEMO",
                })
            await conn.execute(entity_stmt, params)
            await conn.commit()
            print(f"  -> Inserted entities batch {i + len(chunk)}/{len(all_entities)}", flush=True)

        # 6. Seed Entity Relationships
        print(f"Seeding {len(relationships_data)} Entity Relationships...", flush=True)
        rel_stmt = text("""
            INSERT INTO entity_relationships (
                id, source_entity_id, target_entity_id, relationship_type,
                case_id, confidence, extraction_method, status, is_synthetic, data_source,
                created_at, updated_at
            ) VALUES (
                :id, :source_entity_id, :target_entity_id, :relationship_type,
                :case_id, :confidence, 'SYNTHETIC_INTELLIGENCE_PIPELINE', 'CONFIRMED', :is_synthetic, :data_source,
                NOW(), NOW()
            ) ON CONFLICT (id) DO NOTHING;
        """)

        # Filter relationships where both source and target are entities (not CASE target)
        # For relationships targeting a Case, we create CaseEntityContext instead!
        entity_ids_set = {uuid.UUID(e["id"]) for e in all_entities}
        case_ids_set = {uuid.UUID(c["id"]) for c in cases_data}

        rel_params = []
        context_params = []
        for r in relationships_data:
            s_id = uuid.UUID(r["source_id"])
            t_id = uuid.UUID(r["target_id"])
            c_id = uuid.UUID(r["case_id"]) if r.get("case_id") else None

            if t_id in case_ids_set:
                # Entity linked to a Case
                context_params.append({
                    "id": uuid.UUID(r["id"]),
                    "case_id": t_id,
                    "entity_id": s_id,
                    "role": r["relationship_type"],
                    "confidence": r.get("confidence", 1.0),
                    "extraction_method": "MANUAL_ENTRY",
                    "original_text": r.get("notes"),
                    "status": "CONFIRMED",
                })
            elif s_id in entity_ids_set and t_id in entity_ids_set:
                # Entity to Entity
                rel_params.append({
                    "id": uuid.UUID(r["id"]),
                    "source_entity_id": s_id,
                    "target_entity_id": t_id,
                    "relationship_type": r["relationship_type"],
                    "case_id": c_id,
                    "confidence": r.get("confidence", 1.0),
                    "is_synthetic": True,
                    "data_source": "KRITAGAS_DEMO",
                })

        if rel_params:
            for i in range(0, len(rel_params), batch_size):
                chunk = rel_params[i:i + batch_size]
                await conn.execute(rel_stmt, chunk)
                await conn.commit()
            print(f"  -> Inserted {len(rel_params)} Entity-to-Entity relationships.", flush=True)

        if context_params:
            ctx_stmt = text("""
                INSERT INTO case_entity_contexts (
                    id, case_id, entity_id, role, confidence,
                    extraction_method, original_text, status,
                    created_at, updated_at
                ) VALUES (
                    :id, :case_id, :entity_id, :role, :confidence,
                    :extraction_method, :original_text, :status,
                    NOW(), NOW()
                ) ON CONFLICT ON CONSTRAINT uq_case_entity_role DO NOTHING;
            """)
            for i in range(0, len(context_params), batch_size):
                chunk = context_params[i:i + batch_size]
                await conn.execute(ctx_stmt, chunk)
                await conn.commit()
            print(f"  -> Inserted {len(context_params)} CaseEntityContext role bindings.", flush=True)

        # 7. Seed Geo-Temporal Events (1,000 events)
        print(f"Seeding {len(geo_events_data)} Geo-temporal Events...", flush=True)
        geo_stmt = text("""
            INSERT INTO geo_temporal_events (
                id, event_id, case_id, city, region, area,
                latitude, longitude, incident_date, incident_time,
                crime_type, time_bucket, location_cluster, risk_level,
                related_case_number, pattern_identifier, metadata_json,
                is_synthetic, data_source, created_at, updated_at
            ) VALUES (
                :id, :event_id, :case_id, :city, :region, :area,
                :latitude, :longitude, :incident_date, :incident_time,
                :crime_type, :time_bucket, :location_cluster, :risk_level,
                :related_case_number, :pattern_identifier, :metadata_json,
                :is_synthetic, :data_source, NOW(), NOW()
            ) ON CONFLICT (event_id) DO NOTHING;
        """)

        for i in range(0, len(geo_events_data), batch_size):
            chunk = geo_events_data[i:i + batch_size]
            params = []
            for g in chunk:
                g_date = datetime.strptime(g["incident_date"], "%Y-%m-%d").date() if g.get("incident_date") else None
                g_time = datetime.strptime(g["incident_time"], "%H:%M:%S").time() if g.get("incident_time") else None
                params.append({
                    "id": uuid.uuid4(),
                    "event_id": g["event_id"],
                    "case_id": uuid.UUID(g["case_id"]) if g.get("case_id") else None,
                    "city": g["city"],
                    "region": g["region"],
                    "area": g["area"],
                    "latitude": g["latitude"],
                    "longitude": g["longitude"],
                    "incident_date": g_date,
                    "incident_time": g_time,
                    "crime_type": g["crime_type"],
                    "time_bucket": g["time_bucket"],
                    "location_cluster": g["location_cluster"],
                    "risk_level": g["risk_level"],
                    "related_case_number": g.get("related_case_number"),
                    "pattern_identifier": g.get("pattern_identifier"),
                    "metadata_json": json.dumps(g.get("metadata_json", {})),
                    "is_synthetic": True,
                    "data_source": "KRITAGAS_DEMO",
                })
            await conn.execute(geo_stmt, params)
            await conn.commit()
            print(f"  -> Inserted geo-events batch {i + len(chunk)}/{len(geo_events_data)}", flush=True)

        # 8. Seed Case Similarities (Historical AI Correlation)
        print("Seeding explainable Case Similarities...", flush=True)
        sim_stmt = text("""
            INSERT INTO case_similarities (
                id, source_case_id, target_case_id, similarity_score,
                semantic_score, modus_operandi_score, entity_overlap_score,
                location_score, temporal_score, common_features,
                explanation_summary, created_at, updated_at
            ) VALUES (
                :id, :source_case_id, :target_case_id, :similarity_score,
                :semantic_score, :modus_operandi_score, :entity_overlap_score,
                :location_score, :temporal_score, :common_features,
                :explanation_summary, NOW(), NOW()
            ) ON CONFLICT (id) DO NOTHING;
        """)

        # Pair 1: Live Case 1 (Operation Deep Skim) <-> Precedent Case 8 (Seawoods POS Skimming)
        c1_id = uuid.UUID(cases_data[0]["id"])
        c8_id = uuid.UUID(cases_data[7]["id"])
        # Pair 2: Live Case 2 (Naupada Cyber Hawala) <-> Live Case 3 (Vashi Phishing)
        c2_id = uuid.UUID(cases_data[1]["id"])
        c3_id = uuid.UUID(cases_data[2]["id"])

        sim_params = [
            {
                "id": uuid.uuid4(),
                "source_case_id": c1_id,
                "target_case_id": c8_id,
                "similarity_score": 0.89,
                "semantic_score": 0.86,
                "modus_operandi_score": 0.94,
                "entity_overlap_score": 0.72,
                "location_score": 0.65,
                "temporal_score": 0.78,
                "common_features": json.dumps(["POS/ATM Deep-Insert Skimming", "Magnetic Stripe Cloned Dump", "NCR Terminal Target"]),
                "explanation_summary": "High correlation detected: Shared micro-skimmer hardware insertion technique and magnetic stripe track-2 dumping.",
            },
            {
                "id": uuid.uuid4(),
                "source_case_id": c2_id,
                "target_case_id": c3_id,
                "similarity_score": 0.84,
                "semantic_score": 0.81,
                "modus_operandi_score": 0.88,
                "entity_overlap_score": 0.91,
                "location_score": 0.70,
                "temporal_score": 0.85,
                "common_features": json.dumps(["Burner Mobile +91-98201-44912", "USDT Escrow Laundering", "Majiwada-Vashi Corridor"]),
                "explanation_summary": "Cross-city syndicate link: Shared money mule infrastructure, co-occurring burner contact +91-98201-44912, and USDT ledger settlements.",
            }
        ]
        await conn.execute(sim_stmt, sim_params)
        await conn.commit()
        print("  -> Inserted 2 high-confidence Case Similarities.", flush=True)

    print("PostgreSQL Seeding Complete!\n", flush=True)


async def seed_neo4j():
    print("\n--- [2/3] Seeding Neo4j Aura Cloud Graph Database ---", flush=True)
    uri = settings.NEO4J_URI
    user = settings.NEO4J_USERNAME
    password = settings.NEO4J_PASSWORD
    db_name = settings.NEO4J_DATABASE or "7fb5bcab"

    print(f"Connecting to Neo4j Aura at {uri} (Database: '{db_name}')...", flush=True)
    driver = AsyncGraphDatabase.driver(uri, auth=(user, password))

    try:
        async with driver.session(database=db_name) as session:
            # 1. Clear existing demo nodes
            print("Purging existing synthetic demo graph nodes (data_source = 'KRITAGAS_DEMO')...", flush=True)
            await session.run("MATCH (n {data_source: 'KRITAGAS_DEMO'}) DETACH DELETE n")
            print("Graph purge complete.", flush=True)

            # 2. Create constraints/indexes if missing
            await session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (c:Case) REQUIRE c.id IS UNIQUE")
            await session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE")
            await session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (v:Vehicle) REQUIRE v.id IS UNIQUE")
            await session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (ph:Phone) REQUIRE ph.id IS UNIQUE")

            # 3. Seed Case Nodes (top 50 cases for fast graph responsiveness, including all 10 live cases)
            cases_data = load_json("dataset_1_cases.json")[:50]
            print(f"Syncing {len(cases_data)} :Case nodes to Neo4j...", flush=True)
            case_batch = []
            for c in cases_data:
                case_batch.append({
                    "id": c["id"],
                    "case_number": c["case_number"],
                    "title": c["title"],
                    "crime_category": c["crime_category"],
                    "city": c.get("city", "Mumbai"),
                    "region": c.get("region", "Mumbai Metropolitan"),
                    "priority": c["priority"],
                    "status": c["status"],
                    "data_source": "KRITAGAS_DEMO",
                })
            
            await session.run("""
                UNWIND $batch AS row
                MERGE (c:Case {id: row.id})
                SET c.case_number = row.case_number,
                    c.title = row.title,
                    c.crime_category = row.crime_category,
                    c.city = row.city,
                    c.region = row.region,
                    c.priority = row.priority,
                    c.status = row.status,
                    c.data_source = row.data_source
            """, batch=case_batch)
            print("  -> :Case nodes synced.", flush=True)

            # 4. Seed Person Nodes (first 100 persons including syndicate leaders)
            persons_data = load_json("dataset_2_persons.json")[:100]
            print(f"Syncing {len(persons_data)} :Person nodes to Neo4j...", flush=True)
            person_batch = []
            for p in persons_data:
                person_batch.append({
                    "id": p["id"],
                    "name": p["name"],
                    "normalized_value": p["normalized_value"],
                    "role": p.get("role", "SUSPECT"),
                    "phone": p.get("phone", ""),
                    "residence_city": p.get("residence_city", ""),
                    "risk_score": float(p.get("risk_score", 0.5)),
                    "data_source": "KRITAGAS_DEMO",
                })
            
            await session.run("""
                UNWIND $batch AS row
                MERGE (p:Person {id: row.id})
                SET p.name = row.name,
                    p.normalized_value = row.normalized_value,
                    p.role = row.role,
                    p.phone = row.phone,
                    p.residence_city = row.residence_city,
                    p.risk_score = row.risk_score,
                    p.data_source = row.data_source
            """, batch=person_batch)
            print("  -> :Person nodes synced.", flush=True)

            # 5. Seed Vehicles & Phones
            objects_data = load_json("dataset_3_objects.json")[:100]
            print(f"Syncing {len(objects_data)} Object nodes to Neo4j...", flush=True)
            vehicles = [o for o in objects_data if o["entity_type"] == "VEHICLE"]
            phones = [o for o in objects_data if o["entity_type"] == "PHONE"]
            others = [o for o in objects_data if o["entity_type"] not in ["VEHICLE", "PHONE"]]

            if vehicles:
                v_batch = [{
                    "id": v["id"],
                    "name": v["name"],
                    "registration_number": v.get("registration_number", ""),
                    "make_model": v.get("make_model", ""),
                    "color": v.get("color", ""),
                    "data_source": "KRITAGAS_DEMO",
                } for v in vehicles]
                await session.run("""
                    UNWIND $batch AS row
                    MERGE (v:Vehicle {id: row.id})
                    SET v.name = row.name,
                        v.registration_number = row.registration_number,
                        v.make_model = row.make_model,
                        v.color = row.color,
                        v.data_source = row.data_source
                """, batch=v_batch)
                print(f"  -> {len(vehicles)} :Vehicle nodes synced.", flush=True)

            if phones:
                p_batch = [{
                    "id": ph["id"],
                    "name": ph["name"],
                    "phone_number": ph.get("phone_number", ""),
                    "imei": ph.get("imei", ""),
                    "data_source": "KRITAGAS_DEMO",
                } for ph in phones]
                await session.run("""
                    UNWIND $batch AS row
                    MERGE (ph:Phone {id: row.id})
                    SET ph.name = row.name,
                        ph.phone_number = row.phone_number,
                        ph.imei = row.imei,
                        ph.data_source = row.data_source
                """, batch=p_batch)
                print(f"  -> {len(phones)} :Phone nodes synced.", flush=True)

            # 6. Seed Relationships / Edges (Core syndicate cross-city bridge + clusters)
            relationships_data = load_json("dataset_4_relationships.json")[:150]
            print(f"Syncing {len(relationships_data)} Graph Relationships to Neo4j in batched UNWIND transactions...", flush=True)
            
            # Group edges by relationship type for clean, fast Cypher execution
            rels_by_type = {}
            for r in relationships_data:
                rtype = r["relationship_type"]
                rels_by_type.setdefault(rtype, []).append({
                    "src_id": r["source_id"],
                    "tgt_id": r["target_id"],
                    "conf": float(r.get("confidence", 1.0)),
                    "notes": r.get("notes", "")
                })

            for rtype, batch in rels_by_type.items():
                query = f"""
                    UNWIND $batch AS r
                    MATCH (s {{id: r.src_id}}), (t {{id: r.tgt_id}})
                    MERGE (s)-[rel:{rtype}]->(t)
                    SET rel.confidence = r.conf,
                        rel.notes = r.notes,
                        rel.data_source = 'KRITAGAS_DEMO'
                """
                res = await session.run(query, batch=batch)
                await res.consume()
                    
            print("  -> Graph relationships synchronized successfully.", flush=True)

    finally:
        await driver.close()
    print("Neo4j Aura Seeding Complete!\n", flush=True)


async def warm_valkey_cache():
    print("\n--- [3/3] Pre-warming Valkey / Redis Cache ---", flush=True)
    cases_data = load_json("dataset_1_cases.json")
    
    # 1. Dashboard Overview Metrics
    total_cases = len(cases_data)
    open_cases = len([c for c in cases_data if c["status"] in ["OPEN", "UNDER_INVESTIGATION"]])
    closed_cases = len([c for c in cases_data if c["status"] == "CLOSED"])
    
    dashboard_overview = {
        "total_cases": total_cases,
        "open_cases": open_cases,
        "closed_cases": closed_cases,
        "active_syndicates": 3,
        "mumbai_cluster_count": len([c for c in cases_data if c.get("city") == "Mumbai"]),
        "thane_cluster_count": len([c for c in cases_data if c.get("city") == "Thane"]),
        "navi_mumbai_cluster_count": len([c for c in cases_data if c.get("city") == "Navi Mumbai"]),
        "last_synced": datetime.now(timezone.utc).isoformat(),
        "is_synthetic": True,
    }
    
    await cache_service.set("kritagas:dashboard:overview", dashboard_overview, ttl=86400)
    print("  -> Cached 'kritagas:dashboard:overview'", flush=True)

    # 2. Case 1 Subgraph Cache (BKC ATM Deep Skim)
    c1_network = {
        "case_number": "MUM-2026-CR-00101",
        "title": "Operation Deep Skim: BKC Financial Kiosk Firmware Hijack",
        "nodes": [
            {"id": "00000002-0000-4000-8000-000000000001", "name": "Arjun Verma", "role": "PRIME_SUSPECT", "type": "Person"},
            {"id": "00000003-0000-4000-8000-000000000001", "name": "MH-02-DN-4821", "type": "Vehicle"},
            {"id": "00000003-0000-4000-8000-000000000002", "name": "+91-98201-44912", "type": "Phone"},
            {"id": "00000003-0000-4000-8000-000000000004", "name": "Deep-Insert Micro-Skimmer", "type": "Device"},
            {"id": "00000002-0000-4000-8000-000000000010", "name": "Inspector Devendra Patil", "role": "LEAD_IO", "type": "Person"},
        ],
        "cross_city_bridge": {
            "connected_cases": ["THN-2026-CR-00204", "NAV-2026-CR-00307"],
            "shared_identifiers": ["MH-02-DN-4821", "+91-98201-44912"],
        }
    }
    await cache_service.set("kritagas:case:MUM-2026-CR-00101:network", c1_network, ttl=86400)
    print("  -> Cached 'kritagas:case:MUM-2026-CR-00101:network'", flush=True)

    # 3. Hotspots Summary Cache
    hotspots_summary = {
        "total_hotspots": 18,
        "clusters": [
            {"name": "Bandra Kurla Complex", "city": "Mumbai", "risk": "CRITICAL", "count": 142},
            {"name": "Naupada Bullion Corridor", "city": "Thane", "risk": "HIGH", "count": 118},
            {"name": "Vashi Sector 17 Logistics", "city": "Navi Mumbai", "risk": "HIGH", "count": 96},
            {"name": "Kurla West Industrial", "city": "Mumbai", "risk": "MEDIUM", "count": 84},
            {"name": "Ghodbunder Road", "city": "Thane", "risk": "MEDIUM", "count": 72},
        ]
    }
    await cache_service.set("kritagas:hotspots:summary", hotspots_summary, ttl=86400)
    print("  -> Cached 'kritagas:hotspots:summary'", flush=True)

    print("Valkey / Redis Pre-warming Complete!\n", flush=True)


async def main():
    print("=================================================================", flush=True)
    print("  KRITAGAS PROFESSIONAL SYNTHETIC DEMO SEEDER", flush=True)
    print("=================================================================", flush=True)
    
    start_time = datetime.now()
    try:
        await seed_postgresql()
        await seed_neo4j()
        await warm_valkey_cache()
        elapsed = (datetime.now() - start_time).total_seconds()
        print("=================================================================", flush=True)
        print(f"  SUCCESS! Demo Data Synchronization Finished in {elapsed:.2f}s", flush=True)
        print("=================================================================", flush=True)
    finally:
        await engine.dispose()
        await cache_service.close()

if __name__ == "__main__":
    asyncio.run(main())
