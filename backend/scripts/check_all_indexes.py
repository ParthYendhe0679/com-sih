import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check_all_indexes():
    async with AsyncSessionLocal() as s:
        tables = ['cases', 'entities', 'entity_relationships', 'case_entity_context', 'case_notes']
        for t in tables:
            print(f"\nIndexes on table '{t}':")
            res = await s.execute(text(f"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '{t}'"))
            rows = res.fetchall()
            for r in rows:
                print(" -", r[0])

if __name__ == '__main__':
    asyncio.run(check_all_indexes())
