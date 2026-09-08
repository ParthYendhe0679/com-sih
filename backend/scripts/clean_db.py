import asyncio
from app.db.session import AsyncSessionLocal
from app.models.case_note import CaseNote
from app.models.evidence import Evidence
from app.models.case import Case
from app.models.fir import FIR
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from sqlalchemy import delete, select, func

async def clean_database():
    print("Connecting to database...")
    async with AsyncSessionLocal() as session:
        # Delete dummy data in dependency order
        r_note = await session.execute(delete(CaseNote))
        r_ev = await session.execute(delete(Evidence))
        r_case = await session.execute(delete(Case))
        r_fir = await session.execute(delete(FIR))
        r_notif = await session.execute(delete(Notification))
        r_audit = await session.execute(delete(AuditLog))
        await session.commit()

        fir_count = (await session.execute(select(func.count(FIR.id)))).scalar()
        case_count = (await session.execute(select(func.count(Case.id)))).scalar()
        ev_count = (await session.execute(select(func.count(Evidence.id)))).scalar()
        print(f"Cleanup complete! Remaining - FIRs: {fir_count}, Cases: {case_count}, Evidence: {ev_count}")

if __name__ == "__main__":
    asyncio.run(clean_database())
