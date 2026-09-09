"""Seed comprehensive KAVA AI benchmark case: MUM-2026-KD-C2795C (Rahul Mehta Kidnapping).

Integrates:
1. Official FIR: FIR-MUM-2026-KD-C2795C linked to Case MUM-2026-KD-C2795C
2. 28 Structured Entities (3 suspects, 1 victim, 1 complainant, 1 witness, phones, vehicles, locations, sections)
3. 5 Evidence records in PostgreSQL
4. 125 Call Detail Records (CDR) with 900% pre-incident spike anomaly (Feb 11-13) and post-incident silence
5. Full Ingestion via SamanvayaService.ingest_cdr
6. Full Pipeline execution via SamanvayaService.run_investigation_pipeline (all 5 agents)
7. Neo4j Knowledge Graph synchronization
"""

import asyncio
import io
import uuid
from datetime import date, datetime, time as dtime, timedelta, timezone

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.case import Case
from app.models.fir import FIR
from app.ai_ml.models.ai_models import Entity
from app.models.evidence import Evidence
from app.models.user import User
from app.core.constants import CasePriority, CaseStatus, FIRPriority, FIRStatus, EvidenceType, EvidenceStatus
from app.services.samanvaya_service import SamanvayaService
from app.core.neo4j.client import neo4j_client

TARGET_CASE_NUMBER = "MUM-2026-KD-C2795C"
TARGET_FIR_NUMBER = "FIR-MUM-2026-KD-C2795C"


async def seed_benchmark():
    print(f"=== SEEDING KAVA BENCHMARK CASE: {TARGET_CASE_NUMBER} ===")
    async with AsyncSessionLocal() as session:
        # 1. Fetch or create target case
        stmt = select(Case).where(Case.case_number == TARGET_CASE_NUMBER)
        case = (await session.execute(stmt)).scalar_one_or_none()

        if not case:
            case = Case(
                id=uuid.UUID("46bc0432-0b26-44e7-8596-7f0b223b933e"),
                case_number=TARGET_CASE_NUMBER,
                title="Kidnapping of Rahul Mehta from Andheri",
                description=(
                    "Rahul Mehta was kidnapped near Andheri Metro Station while returning home from Lokhandwala. "
                    "Suspect Vikram Rawat ('Vicky') and driver Sameer Khan ('Sam') intercepted his car with a black Scorpio (MH-02-AB-9102). "
                    "A ransom demand of Rs. 25,00,000 was placed to complainant Suresh Mehta from mobile +91 98201 55667. "
                    "A Rs. 2,00,000 cash withdrawal was traced to an ATM kiosk in Vile Parle East handled by associate Dinesh Patil. "
                    "Vehicle telemetry spotted the Scorpio in Powai JVLR en route to a Malad West safehouse."
                ),
                crime_category="Kidnapping",
                crime_type="Abduction for Ransom",
                incident_date=date(2026, 2, 14),
                incident_time=dtime(2, 45),
                city="Mumbai",
                region="Western Suburbs",
                police_station="Andheri Police Station",
                area="Andheri West",
                latitude=19.1197,
                longitude=72.8468,
                status=CaseStatus.ACTIVE,
                priority=CasePriority.CRITICAL,
            )
            session.add(case)
            await session.flush()
            print(f"[OK] Created Case: {case.case_number} ({case.id})")
        else:
            case.title = "Kidnapping of Rahul Mehta from Andheri"
            case.description = (
                "Rahul Mehta was kidnapped near Andheri Metro Station while returning home from Lokhandwala. "
                "Suspect Vikram Rawat ('Vicky') and driver Sameer Khan ('Sam') intercepted his car with a black Scorpio (MH-02-AB-9102). "
                "A ransom demand of Rs. 25,00,000 was placed to complainant Suresh Mehta from mobile +91 98201 55667. "
                "A Rs. 2,00,000 cash withdrawal was traced to an ATM kiosk in Vile Parle East handled by associate Dinesh Patil. "
                "Vehicle telemetry spotted the Scorpio in Powai JVLR en route to a Malad West safehouse."
            )
            case.crime_category = "Kidnapping"
            case.crime_type = "Abduction for Ransom"
            case.incident_date = date(2026, 2, 14)
            case.incident_time = dtime(2, 45)
            case.city = "Mumbai"
            case.region = "Western Suburbs"
            case.police_station = "Andheri Police Station"
            case.area = "Andheri West"
            case.status = CaseStatus.ACTIVE
            case.priority = CasePriority.CRITICAL
            print(f"[OK] Located existing Case: {case.case_number} ({case.id})")

        # 2. Fetch or create FIR
        fir_stmt = select(FIR).where(FIR.fir_number == TARGET_FIR_NUMBER)
        fir = (await session.execute(fir_stmt)).scalar_one_or_none()

        fir_narrative = (
            "I, Suresh Mehta, resident of Lokhandwala Complex, Andheri West, state that on 14-Feb-2026 at 02:45 AM, "
            "my son Rahul Mehta (age 28, director of Mehta Logistics) was returning home when his car was intercepted "
            "near Andheri Metro Station by a black Mahindra Scorpio bearing registration MH-02-AB-9102. Two unidentified "
            "men armed with firearms abducted Rahul into their vehicle and fled along the Western Express Highway towards Powai. "
            "Eyewitness Anita Sharma observed the incident. At 06:15 AM, I received an extortion call on my phone from mobile "
            "+91 98201 55667 demanding Rs. 25 Lakhs cash ransom and warning against police notification. At 04:12 AM, Rs. 2,00,000 "
            "was withdrawn from an ATM in Vile Parle East using Rahul's debit card. Technical leads indicate operative Vikram Rawat "
            "alias 'Vicky' of Malad West coordinated the call, with associate Sameer Khan driving and Dinesh Patil executing the ATM cash out. "
            "I pray for immediate police intervention and rescue of my son."
        )

        user_stmt = select(User).limit(1)
        user_obj = (await session.execute(user_stmt)).scalars().first()
        user_id = user_obj.id if user_obj else uuid.uuid4()

        if not fir:
            fir = FIR(
                id=uuid.uuid4(),
                fir_number=TARGET_FIR_NUMBER,
                title="Kidnapping of Rahul Mehta for Extortion",
                description=fir_narrative,
                crime_category="Kidnapping",
                incident_date=date(2026, 2, 14),
                incident_time=dtime(2, 45),
                incident_location="Near Andheri Metro Station, Western Express Highway, Andheri West, Mumbai",
                status=FIRStatus.ACCEPTED,
                priority=FIRPriority.HIGH,
                submitted_by_id=user_id,
                additional_information=[
                    {"suspect": "Vikram Rawat", "alias": "Vicky", "phone": "+91 98201 55667", "role": "Ringleader"},
                    {"suspect": "Sameer Khan", "alias": "Sam", "phone": "+91 98202 66778", "role": "Driver / Snatcher"},
                    {"suspect": "Dinesh Patil", "phone": "+91 98203 77889", "role": "ATM Cash Handler"},
                    {"victim": "Rahul Mehta", "age": 28, "phone": "+91 98204 88990"},
                    {"witness": "Anita Sharma", "phone": "+91 98207 33445"},
                    {"complainant": "Suresh Mehta", "phone": "+91 98200 44111"},
                    {"vehicle": "MH-02-AB-9102", "model": "Black Mahindra Scorpio"},
                    {"ransom_demand": "Rs. 25,00,000"},
                ],
            )
            session.add(fir)
            await session.flush()
            print(f"[OK] Created FIR: {fir.fir_number} ({fir.id})")
        else:
            fir.description = fir_narrative
            fir.status = FIRStatus.ACCEPTED
            fir.priority = FIRPriority.HIGH

        case.fir_id = fir.id
        await session.commit()
        print(f"[OK] Linked Case {case.case_number} -> FIR {fir.fir_number}")

        # 3. Clean and recreate Entities
        existing_ents = (
            await session.execute(
                select(Entity).where((Entity.case_id == case.id) | (Entity.fir_id == fir.id))
            )
        ).scalars().all()
        for e in existing_ents:
            await session.delete(e)
        await session.commit()

        entities_data = [
            # People - Suspects
            {"type": "PERSON", "name": "Vikram Rawat", "norm": "vikram rawat", "conf": 0.98,
             "attr": {"alias": "Vicky", "role": "SUSPECT", "designation": "Extortion Ringleader", "phone": "+91 98201 55667", "priors": "FIR-MUM-2024-EX-00412", "location": "Malad West"}},
            {"type": "PERSON", "name": "Sameer Khan", "norm": "sameer khan", "conf": 0.96,
             "attr": {"alias": "Sam", "role": "SUSPECT", "designation": "Driver / Snatcher", "phone": "+91 98202 66778", "vehicle": "MH-02-AB-9102"}},
            {"type": "PERSON", "name": "Dinesh Patil", "norm": "dinesh patil", "conf": 0.94,
             "attr": {"role": "SUSPECT", "designation": "Financial Mule / ATM Cashier", "phone": "+91 98203 77889", "withdrawal_site": "Vile Parle East"}},
            # People - Victim & Witnesses
            {"type": "PERSON", "name": "Rahul Mehta", "norm": "rahul mehta", "conf": 1.0,
             "attr": {"role": "VICTIM", "age": 28, "occupation": "Director, Mehta Logistics", "status": "Abducted"}},
            {"type": "PERSON", "name": "Suresh Mehta", "norm": "suresh mehta", "conf": 1.0,
             "attr": {"role": "COMPLAINANT", "relationship": "Father of Victim", "phone": "+91 98200 44111"}},
            {"type": "PERSON", "name": "Anita Sharma", "norm": "anita sharma", "conf": 0.92,
             "attr": {"role": "WITNESS", "designation": "Eyewitness at Lokhandwala intersection", "phone": "+91 98207 33445"}},
            # Phones
            {"type": "PHONE", "name": "+91 98201 55667", "norm": "+919820155667", "conf": 0.99,
             "attr": {"role": "SUSPECT_PHONE", "operator": "Vikram Rawat", "notes": "Extortion call originating line; 900% spike detected"}},
            {"type": "PHONE", "name": "+91 98202 66778", "norm": "+919820266778", "conf": 0.98,
             "attr": {"role": "SUSPECT_PHONE", "operator": "Sameer Khan", "notes": "Communications active during vehicle transit"}},
            {"type": "PHONE", "name": "+91 98203 77889", "norm": "+919820377889", "conf": 0.96,
             "attr": {"role": "SUSPECT_PHONE", "operator": "Dinesh Patil", "notes": "Receiver of 27 calls from Vikram Rawat; mule phone"}},
            {"type": "PHONE", "name": "+91 98204 88990", "norm": "+919820488990", "conf": 1.0,
             "attr": {"role": "VICTIM_PHONE", "operator": "Rahul Mehta", "notes": "Went silent at 03:10 AM at Powai JVLR"}},
            {"type": "PHONE", "name": "+91 98200 44111", "norm": "+919820044111", "conf": 1.0,
             "attr": {"role": "COMPLAINANT_PHONE", "operator": "Suresh Mehta", "notes": "Received extortion call at 06:15 AM"}},
            {"type": "PHONE", "name": "+91 98205 11223", "norm": "+919820511223", "conf": 0.90,
             "attr": {"role": "BURNER_PHONE", "location": "Malad West Safehouse", "type": "Burner SIM"}},
            {"type": "PHONE", "name": "+91 98206 22334", "norm": "+919820622334", "conf": 0.88,
             "attr": {"role": "BURNER_PHONE", "location": "Powai Transit", "type": "Temporary burner"}},
            {"type": "PHONE", "name": "+91 98207 33445", "norm": "+919820733445", "conf": 0.95,
             "attr": {"role": "WITNESS_PHONE", "operator": "Anita Sharma"}},
            {"type": "PHONE", "name": "+91 98208 44556", "norm": "+919820844556", "conf": 0.90,
             "attr": {"role": "SECURITY_PHONE", "entity": "Andheri Metro Station Desk"}},
            {"type": "PHONE", "name": "+91 98209 55667", "norm": "+919820955667", "conf": 0.85,
             "attr": {"role": "COORDINATOR_PHONE", "type": "External coordination"}},
            # Vehicles
            {"type": "VEHICLE", "name": "MH-02-AB-9102", "norm": "mh02ab9102", "conf": 0.99,
             "attr": {"role": "GETAWAY_VEHICLE", "model": "Mahindra Scorpio", "color": "Black", "driver": "Sameer Khan", "sighting": "Andheri Metro -> Powai JVLR"}},
            {"type": "VEHICLE", "name": "MH-03-CD-4512", "norm": "mh03cd4512", "conf": 0.92,
             "attr": {"role": "SCOUT_VEHICLE", "model": "Honda Activa", "color": "White", "role": "Reconnaissance scout at Lokhandwala"}},
            # Locations
            {"type": "LOCATION", "name": "Andheri Metro Station", "norm": "andheri metro station", "conf": 1.0,
             "attr": {"role": "INCIDENT_SCENE", "address": "Western Express Highway, Andheri West", "type": "Abduction Scene"}},
            {"type": "LOCATION", "name": "Lokhandwala Market", "norm": "lokhandwala market", "conf": 0.95,
             "attr": {"role": "STAGING_AREA", "type": "Staging Area / Reconnaissance Locus"}},
            {"type": "LOCATION", "name": "Malad West Safehouse", "norm": "malad west safehouse", "conf": 0.96,
             "attr": {"role": "SUSPECT_HIDEOUT", "type": "Suspect Vikram Rawat primary hideout / safehouse"}},
            {"type": "LOCATION", "name": "Powai JVLR Toll Plaza", "norm": "powai jvlr toll plaza", "conf": 0.97,
             "attr": {"role": "TELEMETRY_POINT", "type": "ANPR Camera Transit Sighting"}},
            {"type": "LOCATION", "name": "Vile Parle East ATM Kiosk", "norm": "vile parle east atm kiosk", "conf": 0.99,
             "attr": {"role": "TRANSACTION_SCENE", "type": "Ransom debit card withdrawal locus"}},
            # Financial & Legal
            {"type": "FINANCIAL", "name": "Rs. 25,00,000 Extortion Demand", "norm": "2500000 inr", "conf": 1.0,
             "attr": {"role": "RANSOM_DEMAND", "amount": 2500000, "currency": "INR", "caller": "Vikram Rawat"}},
            {"type": "FINANCIAL", "name": "Rs. 2,00,000 ATM Cash Withdrawal", "norm": "200000 inr", "conf": 0.98,
             "attr": {"role": "ATM_WITHDRAWAL", "amount": 200000, "currency": "INR", "actor": "Dinesh Patil", "location": "Vile Parle East"}},
            {"type": "LEGAL_SECTION", "name": "IPC Section 364A", "norm": "ipc 364a", "conf": 1.0,
             "attr": {"role": "PENAL_CODE", "title": "Kidnapping for Ransom"}},
            {"type": "LEGAL_SECTION", "name": "IPC Section 386", "norm": "ipc 386", "conf": 1.0,
             "attr": {"role": "PENAL_CODE", "title": "Extortion by putting a person in fear of death"}},
            {"type": "LEGAL_SECTION", "name": "IPC Section 120-B", "norm": "ipc 120b", "conf": 1.0,
             "attr": {"role": "PENAL_CODE", "title": "Criminal Conspiracy"}},
        ]

        for d in entities_data:
            ent = Entity(
                id=uuid.uuid4(),
                case_id=case.id,
                fir_id=fir.id,
                entity_type=d["type"],
                name=d["name"],
                normalized_value=d["norm"],
                confidence=d["conf"],
                source_text=f"Extracted from {fir.fir_number} narrative",
                attributes_json=d["attr"],
                is_canonical=True,
            )
            session.add(ent)
        await session.commit()
        print(f"[OK] Seeded {len(entities_data)} structured entities")

        # 4. Evidence items
        existing_evs = (await session.execute(select(Evidence).where(Evidence.case_id == case.id))).scalars().all()
        for ev in existing_evs:
            await session.delete(ev)
        await session.commit()

        ev_items = [
            ("Video", "Vile Parle ATM Terminal 02 CCTV Video Footage (14-Feb 04:12 AM)"),
            ("Document", "Full CDR Dump: 125 Records across Target MSISDNs (+91 98201 55667, +91 98202 66778, +91 98203 77889)"),
            ("Document", "ANPR License Plate Capture: Mahindra Scorpio MH-02-AB-9102 at Powai JVLR Toll (03:42 AM)"),
            ("Document", "Recovered SIM Card Holder & Discarded Wrapper near Lokhandwala Circle"),
            ("Document", "ATM Cash Out Receipt Slip #8812 - National Apex Bank Vile Parle"),
        ]
        for ev_type, ev_title in ev_items:
            ev = Evidence(
                id=uuid.uuid4(),
                case_id=case.id,
                fir_id=fir.id,
                title=ev_title,
                evidence_type=EvidenceType.VIDEO if ev_type == "Video" else EvidenceType.DOCUMENT,
                description=f"Seized in connection with {TARGET_CASE_NUMBER}",
                file_name=f"{ev_title[:30].replace(' ', '_').lower()}.dat",
                file_url=f"/evidence/vault/{case.id}/{uuid.uuid4()}",
                uploaded_by_id=user_id,
                status=EvidenceStatus.VERIFIED,
            )
            session.add(ev)
        await session.commit()
        print(f"[OK] Seeded {len(ev_items)} evidence records")

    # 5. Build 125 CDR Records in CSV format
    incident_dt = datetime(2026, 2, 14, 2, 45, 0)
    num_vikram = "9820155667"
    num_sameer = "9820266778"
    num_dinesh = "9820377889"
    num_complainant = "9820044111"

    cdr_rows = ["caller,callee,timestamp,duration,call_type,cell"]

    # A. Baseline calls (Feb 1-10: 2 calls total)
    cdr_rows.append(f"{num_vikram},{num_dinesh},2026-02-02 14:15:00,45,OUTGOING,Malad West Tower 04")
    cdr_rows.append(f"{num_vikram},{num_dinesh},2026-02-08 16:30:00,60,OUTGOING,Malad West Tower 04")

    # B. 3 Days Before Crime (11-Feb-2026): SUDDEN SPIKE (12 calls Vikram -> Dinesh)
    for i in range(12):
        t_str = f"2026-02-11 {10 + i % 12:02d}:{i * 4:02d}:00"
        cdr_rows.append(f"{num_vikram},{num_dinesh},{t_str},{120 + i * 15},OUTGOING,Malad West Tower 02")

    # Sameer also calls Dinesh 8 times on Feb 11
    for i in range(8):
        t_str = f"2026-02-11 {14 + i % 8:02d}:{i * 6:02d}:00"
        cdr_rows.append(f"{num_sameer},{num_dinesh},{t_str},{90 + i * 10},OUTGOING,Andheri West Tower 01")

    # C. 2 Days Before Crime (12-Feb-2026): 18 calls Vikram <-> Sameer
    for i in range(18):
        caller = num_vikram if i % 2 == 0 else num_sameer
        callee = num_sameer if i % 2 == 0 else num_vikram
        t_str = f"2026-02-12 {9 + i % 12:02d}:{i * 3:02d}:00"
        cdr_rows.append(f"{caller},{callee},{t_str},{180 + i * 10},OUTGOING,Lokhandwala Tower 03")

    # D. 1 Day Before Crime (13-Feb-2026): 20 calls Vikram -> Sameer, 15 calls Vikram -> Dinesh
    for i in range(20):
        t_str = f"2026-02-13 {8 + i % 14:02d}:{i * 2:02d}:00"
        cdr_rows.append(f"{num_vikram},{num_sameer},{t_str},{210 + i * 8},OUTGOING,Andheri West Tower 06")
    for i in range(15):
        t_str = f"2026-02-13 {12 + i % 10:02d}:{i * 3:02d}:00"
        cdr_rows.append(f"{num_vikram},{num_dinesh},{t_str},{150 + i * 10},OUTGOING,Malad West Tower 01")

    # E. Crime Night (14-Feb-2026, 01:00 - 02:40 AM): Late Night Coordination (22 calls)
    for i in range(22):
        t_str = f"2026-02-14 01:{i * 3:02d}:00"
        cdr_rows.append(f"{num_sameer},{num_vikram},{t_str},{60 + i * 5},OUTGOING,Andheri Metro Cell Site 09")

    # F. Post-Crime Extortion Call (06:15 AM)
    cdr_rows.append(f"{num_vikram},{num_complainant},2026-02-14 06:15:00,240,OUTGOING,Malad West Border Cell 12")

    # Fill up to 125 rows with background calls
    while len(cdr_rows) <= 125:
        idx = len(cdr_rows)
        cdr_rows.append(f"{num_dinesh},9820955667,2026-02-10 11:{idx % 50:02d}:00,45,OUTGOING,Vile Parle Tower 02")

    csv_data = "\n".join(cdr_rows).encode("utf-8")
    print(f"[OK] Assembled CSV dump: {len(cdr_rows) - 1} records")

    # 6. Ingest CDR & Execute SAMANVAYA Pipeline
    async with AsyncSessionLocal() as session:
        samanvaya = SamanvayaService(session)
        case_id = uuid.UUID("46bc0432-0b26-44e7-8596-7f0b223b933e")

        known_numbers = {
            num_vikram: "Vikram Rawat (Extortionist / Ringleader)",
            num_sameer: "Sameer Khan (Driver / Enforcer)",
            num_dinesh: "Dinesh Patil (Mule Handler)",
            num_complainant: "Suresh Mehta (Complainant)",
        }

        print("[*] Ingesting CDR into SAMANVAYA...")
        cdr_res = await samanvaya.ingest_cdr(
            case_id=case_id,
            content=csv_data,
            file_name="rahul_mehta_abduction_cdr.csv",
            incident_at=incident_dt,
            known_numbers=known_numbers,
        )
        print(f"[OK] Ingested CDR: {cdr_res.parsedRecords} parsed, {len(cdr_res.patterns)} suspicious patterns detected!")
        for p in cdr_res.patterns:
            print(f"     -> Pattern: {p.patternType}: {p.title} (Severity: {p.severity})")

        print("[*] Running SAMANVAYA 5-Agent Investigation Pipeline...")
        dossier = await samanvaya.run_investigation_pipeline(case_id=case_id)
        print(f"[OK] SAMANVAYA Pipeline COMPLETED: {len(dossier.agents)} agents, {len(dossier.findings)} findings, {len(dossier.investigativeLeads)} leads!")

    # 7. Seed Neo4j Knowledge Graph
    try:
        if neo4j_client.is_connected():
            async with neo4j_client.session() as n_sess:
                cypher_nodes = """
                MERGE (c:Case {caseNumber: $caseNumber})
                SET c.title = $title, c.crime = 'Kidnapping', c.id = $caseId

                MERGE (v:Person {name: 'Vikram Rawat'})
                SET v.role = 'SUSPECT', v.alias = 'Vicky', v.confidence = 0.98

                MERGE (s:Person {name: 'Sameer Khan'})
                SET s.role = 'SUSPECT', s.alias = 'Sam', s.confidence = 0.96

                MERGE (d:Person {name: 'Dinesh Patil'})
                SET d.role = 'SUSPECT', d.role_detail = 'Mule Account Handler', d.confidence = 0.94

                MERGE (r:Person {name: 'Rahul Mehta'})
                SET r.role = 'VICTIM', r.age = 28, r.status = 'Abducted'

                MERGE (sm:Person {name: 'Suresh Mehta'})
                SET sm.role = 'COMPLAINANT', sm.relation = 'Father'

                MERGE (p1:Phone {number: '+91 98201 55667'})
                SET p1.owner = 'Vikram Rawat', p1.type = 'Extortion Line'

                MERGE (p2:Phone {number: '+91 98202 66778'})
                SET p2.owner = 'Sameer Khan', p2.type = 'Enforcer Mobile'

                MERGE (p3:Phone {number: '+91 98203 77889'})
                SET p3.owner = 'Dinesh Patil', p3.type = 'Mule Line'

                MERGE (vh:Vehicle {plate: 'MH-02-AB-9102'})
                SET vh.model = 'Mahindra Scorpio', vh.color = 'Black'

                MERGE (loc1:Location {name: 'Andheri Metro Station'})
                SET loc1.type = 'Abduction Scene'

                MERGE (loc2:Location {name: 'Malad West Safehouse'})
                SET loc2.type = 'Suspect Safehouse'

                MERGE (loc3:Location {name: 'Vile Parle East ATM'})
                SET loc3.type = 'ATM Withdrawal Locus'

                // Edges
                MERGE (v)-[:OPERATES_PHONE]->(p1)
                MERGE (s)-[:OPERATES_PHONE]->(p2)
                MERGE (d)-[:OPERATES_PHONE]->(p3)
                MERGE (s)-[:OPERATES_VEHICLE]->(vh)
                MERGE (v)-[:ASSOCIATE_OF {role: 'Co-conspirator'}]->(s)
                MERGE (v)-[:COMMUNICATED_WITH {call_count: 27, anomaly: 'CALL_FREQUENCY_ANOMALY', spike: '900%'}]->(d)
                MERGE (v)-[:SUSPECT_IN]->(c)
                MERGE (s)-[:SUSPECT_IN]->(c)
                MERGE (d)-[:SUSPECT_IN]->(c)
                MERGE (r)-[:VICTIM_IN]->(c)
                MERGE (sm)-[:COMPLAINANT_IN]->(c)
                MERGE (vh)-[:INTERCEPTED_AT]->(loc1)
                MERGE (v)-[:HIDEOUT_AT]->(loc2)
                MERGE (d)-[:OPERATED_TRANSACTION_AT]->(loc3)
                """
                await n_sess.run(
                    cypher_nodes,
                    caseNumber=TARGET_CASE_NUMBER,
                    title="Kidnapping of Rahul Mehta from Andheri",
                    caseId=str(case_id),
                )
            print("[OK] Seeded Neo4j graph nodes and relationships successfully")
        else:
            print("[INFO] Neo4j not connected; skipped direct Neo4j write.")
    except Exception as e:
        print(f"[WARN] Neo4j sync notice: {e}")

    print("=== SEEDING COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(seed_benchmark())
