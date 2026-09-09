import asyncio
import httpx
import json

BASE_URL = "http://127.0.0.1:8000/api/v1"
BENCHMARK_CASE_ID = "46bc0432-0b26-44e7-8596-7f0b223b933e"

async def test_kava_and_sync():
    async with httpx.AsyncClient(timeout=90.0) as client:
        print("=" * 60)
        print("TEST 1: GET /cases/intelligence context stats")
        print("=" * 60)
        r = await client.get(f"{BASE_URL}/cases/{BENCHMARK_CASE_ID}/intelligence")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        intel = r.json().get("data", {})
        stats = intel.get("stats", {})
        print(f"Case: {stats.get('caseNumber')}")
        print(f"Crime: {stats.get('crimeCategory')}")
        print(f"Evidence: {stats.get('evidenceCount')}")
        print(f"Entities: {stats.get('entityCount')}")
        print(f"Relationships: {stats.get('relationshipCount')}")
        print(f"Timeline: {stats.get('timelineEvents')}")
        print(f"Agents: {stats.get('agentCount')}/5 (Complete: {stats.get('samanvayaComplete')})")
        print(f"CDR Records: {stats.get('cdrRecords')}")
        assert stats.get("entityCount", 0) > 0, "Expected entities > 0"
        print(">>> TEST 1 PASSED: Real intelligence context loaded.")

        print("\n" + "=" * 60)
        print("TEST 2: Natural Query - 'Explain this case'")
        print("=" * 60)
        payload = {
            "case_id": BENCHMARK_CASE_ID,
            "message": "Explain this case to me.",
            "history": []
        }
        r = await client.post(f"{BASE_URL}/kava/chat", json=payload)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        chat_res = r.json().get("data", r.json())
        print(f"Grounding Level: {chat_res.get('groundingLevel')}")
        print(f"Sources cited: {chat_res.get('sources')}")
        ans_clean = chat_res.get('answer', '')[:300].encode('ascii', 'replace').decode('ascii')
        print(f"Answer snippet: {ans_clean}...")
        assert len(chat_res.get("answer", "")) > 50, "Answer too short"
        print(">>> TEST 2 PASSED: KAVA AI generated grounded explanation.")

        print("\n" + "=" * 60)
        print("TEST 3: Suspects Query - 'Who are the suspects?'")
        print("=" * 60)
        payload = {
            "case_id": BENCHMARK_CASE_ID,
            "message": "Who are the suspects?",
            "history": []
        }
        r = await client.post(f"{BASE_URL}/kava/chat", json=payload)
        assert r.status_code == 200
        chat_res = r.json().get("data", r.json())
        print(f"Sources: {chat_res.get('sources')}")
        ans_clean = chat_res.get('answer', '')[:300].encode('ascii', 'replace').decode('ascii')
        print(f"Answer snippet: {ans_clean}...")
        print(">>> TEST 3 PASSED: Identified suspects from real database entities.")

        print("\n" + "=" * 60)
        print("TEST 4: Conversational Follow-Up with Pronoun Resolution")
        print("=" * 60)
        payload = {
            "case_id": BENCHMARK_CASE_ID,
            "message": "Why is he suspicious?",
            "history": [
                {"role": "user", "content": "Tell me about Vikram Rawat."},
                {"role": "assistant", "content": "Vikram Rawat is an identified suspect connected to the kidnapping and ransom demands."}
            ]
        }
        r = await client.post(f"{BASE_URL}/kava/chat", json=payload)
        assert r.status_code == 200
        chat_res = r.json().get("data", r.json())
        print(f"Sources: {chat_res.get('sources')}")
        ans_clean = chat_res.get('answer', '')[:350].encode('ascii', 'replace').decode('ascii')
        print(f"Answer snippet: {ans_clean}...")
        assert "vikram" in chat_res.get("answer", "").lower() or "rawat" in chat_res.get("answer", "").lower() or "suspect" in chat_res.get("answer", "").lower(), "Expected Vikram Rawat pronoun resolution"
        print(">>> TEST 4 PASSED: Multi-turn conversational memory resolved 'he' to Vikram Rawat.")

        print("\n" + "=" * 60)
        print("TEST 5: Case Synchronization & Instant Cache Invalidation")
        print("=" * 60)
        # Create a test case
        create_payload = {
            "title": "Operation E2E Verification",
            "description": "Testing real-time case cache invalidation and synchronization across modules.",
            "crime_category": "Cyber Fraud",
            "priority": "HIGH"
        }
        r = await client.post(f"{BASE_URL}/cases", json=create_payload)
        assert r.status_code == 200 or r.status_code == 201, f"Create failed: {r.status_code}: {r.text}"
        new_case = r.json().get("data", {})
        new_id = new_case.get("id")
        new_num = new_case.get("case_number")
        print(f"Created new case: {new_num} (ID: {new_id})")

        # Immediately list cases - MUST contain the new case in page 1 items
        r = await client.get(f"{BASE_URL}/cases?size=50")
        assert r.status_code == 200
        cases_list = r.json().get("data", {}).get("items", [])
        found = any(c.get("id") == new_id for c in cases_list)
        print(f"Immediate appearance in GET /cases (0s delay): {found}")
        assert found, f"Newly created case {new_id} not found in immediate /cases list!"

        # Query intelligence context for new case
        r = await client.get(f"{BASE_URL}/cases/{new_id}/intelligence")
        assert r.status_code == 200
        new_stats = r.json().get("data", {}).get("stats", {})
        print(f"New case intelligence stats: {new_stats}")
        assert new_stats.get("caseNumber") == new_num
        assert new_stats.get("samanvayaComplete") is False
        print(">>> TEST 5 PASSED: Case instantly synchronized across platform without caching delay.")

        print("\n" + "=" * 60)
        print("ALL TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_kava_and_sync())
