import http.cookiejar
import re
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:18080"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

html = opener.open(f"{BASE}/auth/signup").read().decode()
token = re.search(r'name="same-site-authenticity-token" value="([^"]+)"', html).group(1)
data = urllib.parse.urlencode(
    {
        "same-site-authenticity-token": token,
        "email": "homework@plexys.local",
        "password": "Homework!2026",
        "name": "Plexys Reviewer",
    }
).encode()
req = urllib.request.Request(f"{BASE}/auth/signup", data=data, method="POST")
req.add_header("Origin", BASE)
req.add_header("Referer", f"{BASE}/auth/signup")
req.add_header("Content-Type", "application/x-www-form-urlencoded")
try:
    resp = opener.open(req)
    print("status", resp.status, resp.geturl())
    body = resp.read().decode(errors="replace")
except urllib.error.HTTPError as exc:
    print("error", exc.code, exc.reason)
    body = exc.read().decode(errors="replace")
print(body[:1500])
