import asyncio
import time
import uuid
import logging
from app.db.session import AsyncSessionLocal
from sqlalchemy import select
from sqlalchemy.orm import selectinload, noload
from app.models.case import Case

logging.basicConfig()
logger = logging.getLogger("sqlalchemy.engine")
logger.setLevel(logging.INFO)

async def test():
    case_id = uuid.UUID('5fea0f1c-e639-4782-9a41-35a6037bda1b')
    async with AsyncSessionLocal() as session:
        print("\n--- TEST 1: Default select(Case) ---")
        t0 = time.time()
        res1 = await session.execute(select(Case).where(Case.id == case_id))
        c1 = res1.scalars().first()
        print(f"Test 1 took: {time.time()-t0:.3f}s")

        print("\n--- TEST 2: select(Case).options(noload('*')) ---")
        t1 = time.time()
        res2 = await session.execute(select(Case).options(noload("*")).where(Case.id == case_id))
        c2 = res2.scalars().first()
        print(f"Test 2 took: {time.time()-t1:.3f}s")

if __name__ == '__main__':
    asyncio.run(test())
