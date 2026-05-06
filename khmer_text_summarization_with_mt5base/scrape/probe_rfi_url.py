"""
Probe a single RFI link using Playwright (real Chromium browser) to bypass
Cloudflare protection and find the correct CSS selector for the article body.

Usage (activate .venv_gpu first):
    python probe_rfi_url.py
    python probe_rfi_url.py --url https://rfi.my/8MAR.g
"""

import argparse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

SAMPLE_URL = "https://rfi.my/8MAR.g"

CANDIDATES = [
    "div.t-content__body",
    "div.article-content__body",
    "div.article__body",
    "div.content-zone",
    "div.m-content",
    "div.article",
    "article",
    "div.body",
    "div.news-content",
    "div.post-content",
    "div.entry-content",
    "div.main-content",
    "div[class*='content']",
    "div[class*='article']",
    "div[class*='body']",
]

parser = argparse.ArgumentParser()
parser.add_argument("--url", default=SAMPLE_URL)
args = parser.parse_args()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
    )

    print(f"Fetching: {args.url}")
    page.goto(args.url, wait_until="networkidle", timeout=30000)
    final_url = page.url
    print(f"Final URL: {final_url}")

    html = page.content()
    browser.close()

soup = BeautifulSoup(html, "html.parser")

# Print all unique div class names
print("\n--- All <div> class attributes (unique) ---")
classes_seen = set()
for tag in soup.find_all("div", class_=True):
    for cls in tag.get("class", []):
        if cls not in classes_seen:
            classes_seen.add(cls)
            print(f"  {cls}")

print("\n--- Selector probe results ---")
for sel in CANDIDATES:
    tag = soup.select_one(sel)
    if tag:
        text = tag.get_text(separator=" ", strip=True)[:300]
        print(f"  MATCH [{sel}]: {text!r}")
    else:
        print(f"  no match: {sel}")
