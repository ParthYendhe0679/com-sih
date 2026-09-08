import urllib.request
import json
import time

def test():
    t0 = time.time()
    url = 'http://127.0.0.1:8000/api/v1/analytics/overview'
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            elapsed = time.time() - t0
            print(f"HTTP Status: {resp.status} (took {elapsed*1000:.1f}ms)")
            print("Success:", data.get("success"))
            print("Message:", data.get("message"))
            d = data.get("data", {})
            print(f"Total FIRs: {d.get('total_firs')}")
            print(f"KPI Count: {len(d.get('kpis', []))}")
            for k in d.get('kpis', []):
                print(f"  * {k['title']}: {k['count']} ({k['direction']} {k['change']})")
            print(f"Monthly Trends points: {len(d.get('monthly_trends', []))}")
            if d.get('monthly_trends'):
                print(f"  Sample month: {d['monthly_trends'][-1]}")
            print(f"Crime Distribution categories: {len(d.get('crime_distribution', []))}")
            for c in d.get('crime_distribution', [])[:4]:
                print(f"  - {c['name']}: {c['value']}% ({c['count']} cases)")
            print(f"Peak Hours data points: {len(d.get('peak_hours', []))}")
            print(f"City Volumes: {d.get('city_volumes')}")
            print(f"Hotspot clusters: {len(d.get('hotspots', []))}")
            if d.get('hotspots'):
                hs0 = d['hotspots'][0]
                print(f"  Top hotspot: {hs0['area']}, {hs0['city']} - {hs0['crimeCount']} FIRs ({hs0['severity']}) @ {hs0['coordinates']}")
            print(f"AI Emerging Patterns: {len(d.get('emerging_patterns', []))}")
            if d.get('emerging_patterns'):
                p0 = d['emerging_patterns'][0]
                print(f"  Pattern 1: '{p0['title']}' | Confidence: {p0['confidence']}% | Status: {p0['status']}")
    except Exception as err:
        print("Test failed with error:", err)

if __name__ == '__main__':
    test()
