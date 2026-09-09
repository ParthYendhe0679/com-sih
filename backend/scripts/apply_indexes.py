import asyncio
import time
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

INDEXES_SQL = [
    "CREATE INDEX IF NOT EXISTS ix_cases_created_at_desc ON cases (created_at DESC);",
    "CREATE INDEX IF NOT EXISTS ix_cases_status_created_at ON cases (status, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS ix_cases_priority_created_at ON cases (priority, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS ix_entities_fir_id ON entities (fir_id);",
    "CREATE INDEX IF NOT EXISTS ix_case_entity_contexts_case_id ON case_entity_contexts (case_id);",
    "CREATE INDEX IF NOT EXISTS ix_case_entity_contexts_entity_id ON case_entity_contexts (entity_id);",
]

async def apply_indexes():
    async with AsyncSessionLocal() as session:
        for sql in INDEXES_SQL:
            t0 = time.time()
            clean_name = sql.split('ON')[0].strip()
            print(f"Applying: {clean_name}...")
            await session.execute(text(sql))
            await session.commit()
            print(f" -> Done in {time.time()-t0:.3f}s")
    print("All optimization indexes created successfully.")

if __name__ == '__main__':
    asyncio.run(apply_indexes())
