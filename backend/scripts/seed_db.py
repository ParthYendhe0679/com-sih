"""Development database seed script for KRITAGAS backend.

Creates:
- 1 System Administrator
- 1 Law Enforcement Police Officer
- 1 Public Citizen Complainant
- Sample lodged FIRs, converted Case, and Evidence for immediate UI & API exploration.
"""

import asyncio
from datetime import date, datetime, time, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AuditAction,
    CasePriority,
    CaseStatus,
    DocumentProcessingStatus,
    EvidenceStatus,
    EvidenceType,
    FIRPriority,
    FIRStatus,
    UserRole,
)
from app.core.logging import get_logger, setup_logging
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.db.base import Base
from app.models.audit_log import AuditLog
from app.models.case import Case
from app.models.case_note import CaseNote
from app.models.evidence import Evidence
from app.models.fir import FIR
from app.models.notification import Notification
from app.models.user import User

logger = get_logger("kritagas.seed")


async def seed_data():
    setup_logging(debug=True)
    logger.info("=== Starting KRITAGAS Development Database Seed ===")

    async with AsyncSessionLocal() as session:
        # Ensure schema tables exist
        async with session.bind.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # 1. Admin Account
        admin_email = "admin@kritagas.gov.in"
        stmt = select(User).where(User.email == admin_email)
        admin = (await session.execute(stmt)).scalars().first()

        if not admin:
            admin = User(
                email=admin_email,
                username="admin",
                full_name="Chief Administrator",
                phone_number="+91-11-23092011",
                password_hash=hash_password("Admin@123456"),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            session.add(admin)
            await session.flush()
            logger.info(f"Created Admin account: {admin.email}")
        else:
            logger.info(f"Admin account already exists: {admin.email}")

        # 2. Police Account
        police_email = "inspector.sharma@police.gov.in"
        stmt = select(User).where(User.email == police_email)
        police = (await session.execute(stmt)).scalars().first()

        if not police:
            police = User(
                email=police_email,
                username="inspector_sharma",
                full_name="Inspector Vikram Sharma",
                phone_number="+91-9811002233",
                password_hash=hash_password("Police@123456"),
                role=UserRole.POLICE,
                is_active=True,
                is_verified=True,
                badge_number="DL-POL-8042",
                department="Cybercrime & Intelligence Division",
                rank="Inspector / SHO",
            )
            session.add(police)
            await session.flush()
            logger.info(f"Created Police account: {police.email} (Badge: {police.badge_number})")
        else:
            logger.info(f"Police account already exists: {police.email}")

        # 3. Citizen Account
        citizen_email = "citizen.rahul@example.com"
        stmt = select(User).where(User.email == citizen_email)
        citizen = (await session.execute(stmt)).scalars().first()

        if not citizen:
            citizen = User(
                email=citizen_email,
                username="citizen_rahul",
                full_name="Rahul Verma",
                phone_number="+91-9876543210",
                password_hash=hash_password("Citizen@123456"),
                role=UserRole.CITIZEN,
                is_active=True,
                is_verified=True,
            )
            session.add(citizen)
            await session.flush()
            logger.info(f"Created Citizen account: {citizen.email}")
        else:
            logger.info(f"Citizen account already exists: {citizen.email}")

        # 4. Sample FIR 1: Accepted & Converted to Case
        fir1_num = "FIR-2026-1042"
        stmt = select(FIR).where(FIR.fir_number == fir1_num)
        fir1 = (await session.execute(stmt)).scalars().first()

        if not fir1:
            fir1 = FIR(
                fir_number=fir1_num,
                title="Commercial Banking Authorization Fraud & Phishing Syndicate",
                description="Unauthorized RTGS transfer of INR 45,00,000 from company payroll account through cloned SIM card and spear-phishing attack on finance executive.",
                crime_category="Cybercrime",
                incident_date=date(2026, 2, 14),
                incident_time=time(14, 30),
                incident_location="Connaught Place Financial District, New Delhi",
                status=FIRStatus.CONVERTED_TO_CASE,
                priority=FIRPriority.HIGH,
                submitted_by_id=citizen.id,
                reviewed_by_id=police.id,
                reviewed_at=datetime.now(timezone.utc),
                is_offline=False,
                processing_status=DocumentProcessingStatus.COMPLETED,
            )
            session.add(fir1)
            await session.flush()
            logger.info(f"Created sample FIR: {fir1.fir_number}")

        # 5. Sample Case originating from FIR 1
        case1_num = "CASE-2026-9014"
        stmt = select(Case).where(Case.case_number == case1_num)
        case1 = (await session.execute(stmt)).scalars().first()

        if not case1:
            case1 = Case(
                case_number=case1_num,
                title="Operation PhishGuard: Syndicate RTGS Fraud Investigation",
                description="Multi-state cyber forensic inquiry tracing mule bank accounts, IMEI numbers, and offshore VPN nodes linked to the unauthorized transfer.",
                crime_category="Cybercrime",
                status=CaseStatus.UNDER_INVESTIGATION,
                priority=CasePriority.HIGH,
                fir_id=fir1.id,
                lead_investigator_id=police.id,
                created_by_id=police.id,
                opened_at=datetime.now(timezone.utc),
            )
            session.add(case1)
            await session.flush()

            # Case Note
            note1 = CaseNote(
                case_id=case1.id,
                author_id=police.id,
                note="Notices under Sec 91 CrPC issued to telecom operator for CDR and IPDR analysis on suspect MSISDNs.",
            )
            session.add(note1)

            # Evidence
            ev1 = Evidence(
                case_id=case1.id,
                fir_id=fir1.id,
                title="Bank Account Statement & Transfer Audit Log",
                description="Certified bank transaction trail proving transfer to beneficiary account in Kolkata branch.",
                evidence_type=EvidenceType.DOCUMENT,
                file_name="bank_audit_trail_statement.pdf",
                file_url="/uploads/sample_bank_statement.pdf",
                file_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                file_size=2048576,
                mime_type="application/pdf",
                uploaded_by_id=police.id,
                status=EvidenceStatus.VERIFIED,
            )
            session.add(ev1)
            logger.info(f"Created sample Case: {case1.case_number}")

        # 6. Sample FIR 2: Submitted (In Triage Queue)
        fir2_num = "FIR-2026-2089"
        stmt = select(FIR).where(FIR.fir_number == fir2_num)
        fir2 = (await session.execute(stmt)).scalars().first()

        if not fir2:
            fir2 = FIR(
                fir_number=fir2_num,
                title="Armed Robbery at Jewelry Store in Sector 18 Market",
                description="Three unidentified masked perpetrators entered with firearms at 19:45 hrs, looted display ornaments worth approx 35 lakhs and fled on two black motorcycles.",
                crime_category="Robbery",
                incident_date=date(2026, 3, 2),
                incident_time=time(19, 45),
                incident_location="Sector 18 Commercial Market, Noida",
                status=FIRStatus.SUBMITTED,
                priority=FIRPriority.CRITICAL,
                submitted_by_id=citizen.id,
                is_offline=False,
                processing_status=DocumentProcessingStatus.NOT_PROCESSED,
            )
            session.add(fir2)
            await session.flush()
            logger.info(f"Created sample submitted FIR: {fir2.fir_number}")

        # 7. Audit Log Sample Entries
        audit_sample = AuditLog(
            user_id=admin.id,
            action=AuditAction.SYSTEM_CONFIG_CHANGED.value,
            resource_type="system",
            resource_id="config-01",
            description="System initialization completed and development seed verified.",
            old_value={"status": "uninitialized"},
            new_value={"status": "ready"},
            ip_address="127.0.0.1",
        )
        session.add(audit_sample)

        await session.commit()
        logger.info("=== Database Seed Completed Successfully ===")
        logger.info("Default Credentials:")
        logger.info("  Admin:   admin@kritagas.gov.in / Admin@123456")
        logger.info("  Police:  inspector.sharma@police.gov.in / Police@123456")
        logger.info("  Citizen: citizen.rahul@example.com / Citizen@123456")


if __name__ == "__main__":
    asyncio.run(seed_data())
