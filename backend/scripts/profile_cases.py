import asyncio
import time
from app.db.session import AsyncSessionLocal
from app.repositories.case_repository import CaseRepository
from app.schemas.case import CaseResponse

async def profile_case_list():
    async with AsyncSessionLocal() as session:
        repo = CaseRepository(session)
        t0 = time.time()
        print("Starting list_cases...")
        cases = await repo.list_cases(limit=20)
        t1 = time.time()
        print(f"list_cases query returned {len(cases)} cases in {t1 - t0:.2f}s")
        
        t2 = time.time()
        validated = [CaseResponse.model_validate(c) for c in cases]
        t3 = time.time()
        print(f"model_validate took {t3 - t2:.2f}s")

if __name__ == "__main__":
    asyncio.run(profile_case_list())
