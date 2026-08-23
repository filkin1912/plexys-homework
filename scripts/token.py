import http.cookiejar
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:18080"
EMAIL = "homework@plexys.local"
PASSWORD = "Homework!2026"
CALLBACK = f"{BASE}/tickets/auth/callback"


class CaptureRedirect(urllib.request.HTTPRedirectHandler):
    last = None

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        CaptureRedirect.last = newurl
        if "code=" in newurl or "/auth/callback" in newurl:
            raise urllib.error.HTTPError(newurl, code, "captured", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cj),
    CaptureRedirect(),
)


def csrf(html: str) -> str:
    match = re.search(r'name="same-site-authenticity-token" value="([^"]+)"', html)
    if not match:
        raise SystemExit("CSRF field missing")
    return match.group(1)


def post_form(path: str, fields: dict):
    html = opener.open(f"{BASE}{path}").read().decode()
    fields = {"same-site-authenticity-token": csrf(html), **fields}
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=urllib.parse.urlencode(fields).encode(),
        method="POST",
        headers={
            "Origin": BASE,
            "Referer": f"{BASE}{path}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    return opener.open(req)


post_form("/auth/login", {"email": EMAIL, "password": PASSWORD})

params = urllib.parse.urlencode(
    {"redirect_uri": CALLBACK, "scope": "profile api", "state": "provision"}
)
try:
    opener.open(f"{BASE}/auth/oauth2/default-client?{params}")
    landing = CaptureRedirect.last or ""
except urllib.error.HTTPError as exc:
    landing = exc.url

query = urllib.parse.parse_qs(urllib.parse.urlparse(landing).query)
if "code" not in query:
    raise SystemExit(f"no auth code, landed on {landing}")

body = urllib.parse.urlencode(
    {"code": query["code"][0], "scope": "profile api", "redirect_uri": CALLBACK}
).encode()
req = urllib.request.Request(
    f"{BASE}/auth/oauth2/default-client",
    data=body,
    method="POST",
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
payload = json.loads(opener.open(req).read().decode())
Path(__file__).with_name("access.jwt").write_text(payload["access_token"], encoding="utf-8")
print(payload["access_token"])
