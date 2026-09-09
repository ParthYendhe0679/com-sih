import asyncio
import time
from app.db.session import AsyncSessionLocal
from sqlalchemy import text, select
from app.models.case import Case

async def test_perf():
    async with AsyncSessionLocal() as session:
        t0 = time.time()
        await session.execute(text('SELECT 1'))
        print(f'Handshake & SELECT 1: {time.time()-t0:.3f}s')

        t1 = time.time()
        r = await session.execute(text('SELECT id, case_number, title, crime_category, status, priority, created_at FROM cases ORDER BY created_at DESC LIMIT 50'))
        rows = r.fetchall()
        print(f'Raw SQL selected 50 columns: {time.time()-t1:.3f}s, rows: {len(rows)}')

        t2 = time.time()
        r2 = await session.execute(text('SELECT * FROM cases ORDER BY created_at DESC LIMIT 50'))
        rows2 = r2.fetchall()
        print(f'Raw SQL SELECT * LIMIT 50: {time.time()-t2:.3f}s, rows: {len(rows2)}')

        t3 = time.time()
        r3 = await session.execute(select(Case).order_by(Case.created_at.desc()).limit(50))
        cases = r3.scalars().all()
        print(f'SQLAlchemy select(Case) default (lazy="selectin"): {time.time()-t3:.3f}s, cases: {len(cases)}')

        # Check indexes
        idx_res = await session.execute(text("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'cases'"))
        print('\nExisting indexes on cases:')
        for row in idx_res.fetchall():
            print(' -', row[0], ':', row[1])

if __name__ == '__main__':
    asyncio.run(test_perf())
