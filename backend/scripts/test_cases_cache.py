import urllib.request
import json
import time

def test_cases():
    t0 = time.time()
    url = "http://127.0.0.1:8000/api/v1/cases"
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read().decode())
            elapsed = time.time() - t0
            print(f"Request 1 took: {elapsed:.3f}s")
            print("Status:", resp.status)
            print("Success:", data.get("success"))
            paginated = data.get("data", {})
            print(f"Total: {paginated.get('total')}, Page items: {len(paginated.get('items', []))}")
            if paginated.get("items"):
                first = paginated["items"][0]
                print(f"First item: {first.get('case_number')} - {first.get('title')}")
    except Exception as e:
        print("Error on request 1:", e)

    # Request 2 (should be cached in Valkey and take <10ms!)
    t1 = time.time()
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read().decode())
            elapsed2 = time.time() - t1
            print(f"Request 2 (cached) took: {elapsed2*1000:.1f}ms")
            print("Message:", data.get("message"))
    except Exception as e:
        print("Error on request 2:", e)

if __name__ == "__main__":
    test_cases()
