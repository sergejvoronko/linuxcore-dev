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


def get_credentials() -> Credentials:
    # No `scopes=` here: the refresh token was granted with a broader scope
    # set (indexing + webmasters + analytics); requesting a narrower/different
    # scope string on refresh makes Google reject it with invalid_scope.
    creds = Credentials(
        token=None,
        refresh_token=os.environ["GSC_REFRESH_TOKEN"],
        client_id=os.environ["GSC_CLIENT_ID"],
        client_secret=os.environ["GSC_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
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


def check_link(url: str, link_target: str) -> dict:
    """For pages we don't own in GSC: just confirm the page is up and still
    links to link_target somewhere in its HTML."""
    resp = requests.get(url, timeout=20, headers={"User-Agent": "linuxcore-dev-watchdog/1.0"})
    return {
        "status_code": resp.status_code,
        "link_present": link_target in resp.text,
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

    new_state = {}
    changes = []

    gsc_entries = watchlist.get("gsc", [])
    if gsc_entries:
        creds = get_credentials()
        service = build("searchconsole", "v1", credentials=creds)

        for entry in gsc_entries:
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

    for entry in watchlist.get("link_check", []):
        url = entry["url"]
        link_target = entry["link_target"]
        try:
            result = check_link(url, link_target)
        except Exception as e:
            changes.append(f"⚠️ link check failed for {url}: {e}")
            continue

        new_state[url] = result
        prev = prev_state.get(url)

        if prev is None:
            continue  # first run establishes baseline, no alert

        if prev.get("status_code") != result["status_code"] or prev.get("link_present") != result["link_present"]:
            note = entry.get("note", "")
            changes.append(
                f"🔗 link check changed — {url}"
                f"{' (' + note + ')' if note else ''}\n"
                f"  status {prev.get('status_code')} → {result['status_code']}"
                f"  | link present: {prev.get('link_present')} → {result['link_present']}"
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
