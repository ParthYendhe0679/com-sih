import asyncio
import time
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as s:
        print("1. Index check:")
        res = await s.execute(text("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'cases'"))
        for r in res.fetchall():
            print(" -", r[0], "-->", r[1])

        print("\n2. EXPLAIN ANALYZE on ORDER BY created_at DESC LIMIT 50:")
        t0 = time.time()
        plan = await s.execute(text("EXPLAIN ANALYZE SELECT id, case_number, title, crime_category, status, priority, created_at FROM cases ORDER BY created_at DESC LIMIT 50"))
        print(f"Explain query took: {time.time()-t0:.3f}s")
        for row in plan.fetchall():
            print("  ", row[0])

if __name__ == '__main__':
    asyncio.run(check())
