import urllib.request
import json

def test_login():
    url = "http://127.0.0.1:8000/api/v1/auth/login"
    payload = json.dumps({
        "username_or_email": "inspector.sharma@police.gov.in",
        "password": "Police@123456"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print("Status:", resp.status)
            print("Login success:", data.get("success"))
            print("Access token received:", bool(data.get("data", {}).get("access_token")))
            print("Token prefix:", data.get("data", {}).get("access_token", "")[:25])
    except Exception as e:
        print("Login failed:", e)

if __name__ == "__main__":
    test_login()
