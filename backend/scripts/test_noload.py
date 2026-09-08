import asyncio
import time
from sqlalchemy import select
from sqlalchemy.orm import noload
from app.db.session import AsyncSessionLocal
from app.models.case import Case
from app.schemas.case import CaseResponse

async def test_speed():
    async with AsyncSessionLocal() as session:
        # Test 1: with noload('*')
        t0 = time.time()
        stmt = (
            select(Case)
            .options(noload("*"))
            .order_by(Case.created_at.desc())
            .limit(20)
        )
        res = await session.execute(stmt)
        cases = res.scalars().all()
        t1 = time.time()
        print(f"noload('*') returned {len(cases)} cases in {t1 - t0:.3f}s")

if __name__ == "__main__":
    asyncio.run(test_speed())
