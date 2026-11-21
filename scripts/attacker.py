#!/usr/bin/env python3
"""
Wèngchéng attacker demonstration CLI.

Fires realistic recon, a novel SQL/API probe (which wakes the configured
NVIDIA NIM / OpenRouter model exactly once), then falls into the slow-drip
tarpit. Uses only the Python standard library.

    python3 scripts/attacker.py
    python3 scripts/attacker.py --host 10.0.0.4 --port 3000 --no-tarpit
"""

from __future__ import annotations

import argparse
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import quote

BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
)
SCANNER_UA = "sqlmap/1.8.3#stable (https://sqlmap.org)"

CYAN = "\033[36m"
AMBER = "\033[33m"
RED = "\033[31m"
MINT = "\033[32m"
DIM = "\033[2m"
RESET = "\033[0m"


def request(base, path, *, headers=None, stream=False, timeout=40):
    url = f"{base}{path}"
    hdrs = {"User-Agent": BROWSER_UA, "Accept": "*/*"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    started = time.perf_counter()
    try:
        response = urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read(), (time.perf_counter() - started) * 1000
    body = b""
    if stream:
        while True:
            chunk = response.read(96)
            if not chunk:
                break
            body += chunk
            print(f"    {AMBER}▸ drip{RESET} {len(body):5d} bytes  (+{len(chunk)})", flush=True)
    else:
        body = response.read()
    return response.status, dict(response.headers), body, (time.perf_counter() - started) * 1000


def preview(body: bytes, limit: int = 500) -> str:
    text = body.decode("utf-8", errors="replace").strip()
    return text[:limit] + ("…" if len(text) > limit else "")


def main() -> int:
    parser = argparse.ArgumentParser(description="Wèngchéng attacker simulation CLI")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=3000)
    parser.add_argument("--no-tarpit", action="store_true", help="skip the slow-drip phase")
    parser.add_argument("--delay", type=float, default=0.5, help="pause between phases")
    args = parser.parse_args()

    base = f"http://{args.host}:{args.port}"
    print(f"\n{CYAN}╔══════════════════════════════════════════════════════════════╗")
    print(f"║  瓮城  WENGCHENG // EXTERNAL ATTACK SIMULATOR                ║")
    print(f"╚══════════════════════════════════════════════════════════════╝{RESET}")
    print(f"{DIM}Target: {base}/portal   •   Watch the SOC dashboard while this runs.{RESET}\n")

    phases: list[tuple[str, str, dict | None]] = [
        ("1/4  BASELINE  — legitimate portal request", "/portal/api/overview", None),
        ("2/4  RECON     — sensitive file + admin probes", "/.env", {"User-Agent": SCANNER_UA}),
        ("2/4  RECON     — sensitive file + admin probes", "/admin", {"User-Agent": SCANNER_UA}),
        ("2/4  RECON     — sensitive file + admin probes", "/wp-admin", {"User-Agent": SCANNER_UA}),
        (
            "3/4  NOVEL     — custom SQL/API probe (AI wakeup)",
            "/portal/api/v2/ledger/reconcile?table=wp_quantum_ledger"
            "&filter=" + quote("id' OR 1=1--") + "&debug=true",
            None,
        ),
    ]

    for label, path, headers in phases:
        print(f"{CYAN}▸ {label}{RESET}")
        print(f"  {DIM}GET {path}{RESET}")
        status, resp_headers, body, elapsed = request(base, path, headers=headers)
        decoy = resp_headers.get("X-Wengcheng-Decoy", "—")
        source = resp_headers.get("X-Wengcheng-Source", "real")
        color = MINT if decoy == "—" else AMBER
        print(
            f"  ← {status}  {elapsed:.0f}ms  decoy={color}{decoy}{RESET}  source={source}"
        )
        print(f"    {DIM}{preview(body)}{RESET}\n")
        time.sleep(args.delay)

    if not args.no_tarpit:
        print(f"{RED}▸ 4/4  TARPIT    — fake CSV export, slow-drip egress{RESET}")
        path = "/portal/api/export?format=csv&page=1&rows=10000"
        print(f"  {DIM}GET {path}{RESET}")
        status, resp_headers, body, elapsed = request(
            base,
            path,
            headers={"X-Wc-Force-Category": "scraping"},
            stream=True,
        )
        print(
            f"  ← {status}  {elapsed / 1000:.1f}s  "
            f"{len(body)} bytes  decoy={resp_headers.get('X-Wengcheng-Decoy')}{RESET}\n"
        )

    print(f"{MINT}✓ Attack sequence complete. Open the dashboard to inspect the captured session.{RESET}")
    print(f"{DIM}  Reports: http://{args.host}:{args.port}/api/reports/<session-id>.md{RESET}\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n[interrupted]")
        sys.exit(130)
