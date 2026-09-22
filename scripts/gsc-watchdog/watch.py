#!/usr/bin/env python3
"""GSC index-status watchdog: inspects watched URLs via the Search Console
URL Inspection API, diffs against the last known state, and alerts on Telegram
only when a URL's indexing status actually changes (deindexed, blocked, etc).
"""
import json
import os
import sys
from pathlib import Path

import requests
import yaml
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

HERE = Path(__file__).parent
URLS_FILE = HERE / "urls.yaml"
STATE_FILE = HERE / "state.json"

GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]


def get_credentials() -> Credentials:
    creds = Credentials(
        token=None,
        refresh_token=os.environ["GSC_REFRESH_TOKEN"],
        client_id=os.environ["GSC_CLIENT_ID"],
        client_secret=os.environ["GSC_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=GSC_SCOPES,
    )
    creds.refresh(Request())
    return creds


def inspect(service, url: str, site_property: str) -> dict:
    body = {"inspectionUrl": url, "siteUrl": site_property, "languageCode": "en"}
    resp = service.urlInspection().index().inspect(body=body).execute()
    idx = resp.get("inspectionResult", {}).get("indexStatusResult", {})
    return {
        "verdict": idx.get("verdict", "VERDICT_UNSPECIFIED"),
        "coverage_state": idx.get("coverageState"),
        "page_fetch_state": idx.get("pageFetchState"),
        "robots_txt_state": idx.get("robotsTxtState"),
        "last_crawl_time": idx.get("lastCrawlTime"),
    }


def notify(text: str) -> None:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data={"chat_id": chat_id, "text": text},
        timeout=15,
    )


def main() -> int:
    watchlist = yaml.safe_load(URLS_FILE.read_text())
    prev_state = json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}

    creds = get_credentials()
    service = build("searchconsole", "v1", credentials=creds)

    new_state = {}
    changes = []

    for entry in watchlist:
        url = entry["url"]
        try:
            result = inspect(service, url, entry["property"])
        except Exception as e:
            changes.append(f"⚠️ inspection failed for {url}: {e}")
            continue

        new_state[url] = result
        prev = prev_state.get(url)

        if prev is None:
            continue  # first run establishes baseline, no alert

        if prev.get("verdict") != result["verdict"] or prev.get("coverage_state") != result["coverage_state"]:
            note = entry.get("note", "")
            changes.append(
                f"🔎 index status changed — {url}"
                f"{' (' + note + ')' if note else ''}\n"
                f"  {prev.get('coverage_state')} → {result['coverage_state']}"
                f"  (verdict: {prev.get('verdict')} → {result['verdict']})"
            )

    STATE_FILE.write_text(json.dumps(new_state, indent=2, sort_keys=True) + "\n")

    if changes:
        notify("GSC watchdog:\n\n" + "\n\n".join(changes))
        print("\n".join(changes))
    else:
        print("No changes.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
