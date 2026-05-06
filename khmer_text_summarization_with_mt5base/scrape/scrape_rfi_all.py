"""
Scrape all rows from kimleang123/rfi_news and save raw results to dataset/rfi_data.csv.
Writes incrementally (checkpoint every 100 rows) so it can be resumed if interrupted.

Usage (activate .venv_gpu first):
    python scrape_rfi_all.py --hf_token <token>
    python scrape_rfi_all.py --hf_token <token> --resume   # skip already-scraped rows

Output: ../dataset/rfi_data.csv  (columns: link, title, summary, article)
"""

import argparse
import os
import time
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup
from huggingface_hub import login
from playwright.sync_api import sync_playwright
from tqdm import tqdm

DATASET_DIR = Path(__file__).parent.parent / "dataset"
OUTPUT_CSV = DATASET_DIR / "rfi_data.csv"

RFI_BODY_SELECTORS = [
    "div.t-content__body",
    "div.article-content__body",
    "div.article__body",
    "div.content-zone",
    "div.m-content",
]

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

CHECKPOINT_EVERY = 100  # save to disk every N rows
PAGE_TIMEOUT = 30000    # ms
SCRAPE_DELAY = 0.5      # seconds between requests


def scrape_article(page, url: str) -> str:
    """Fetch URL with Playwright and extract article body. Returns empty string on failure."""
    try:
        page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT)
        html = page.content()
    except Exception:
        return ""

    soup = BeautifulSoup(html, "html.parser")
    for sel in RFI_BODY_SELECTORS:
        tag = soup.select_one(sel)
        if tag:
            for noise in tag.find_all(["script", "style", "figure", "figcaption"]):
                noise.decompose()
            text = tag.get_text(separator="\n", strip=True)
            if text:
                return text
    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hf_token", default=os.environ.get("HF_TOKEN"))
    parser.add_argument("--resume", action="store_true",
                        help="Skip rows whose link already appears in the output CSV")
    parser.add_argument("--delay", type=float, default=SCRAPE_DELAY)
    args = parser.parse_args()

    if args.hf_token:
        login(token=args.hf_token, add_to_git_credential=False)

    # Load full dataset
    print("Loading rfi_news from HuggingFace ...")
    df_raw = pd.read_csv("hf://datasets/kimleang123/rfi_news/train.csv")
    print(f"Total rows: {len(df_raw)}")

    DATASET_DIR.mkdir(parents=True, exist_ok=True)

    # Resume: load already-scraped links
    already_scraped = set()
    existing_rows = []
    if args.resume and OUTPUT_CSV.exists():
        df_existing = pd.read_csv(OUTPUT_CSV, encoding="utf-8-sig")
        already_scraped = set(df_existing["link"].dropna().tolist())
        existing_rows = df_existing.to_dict("records")
        print(f"Resuming: {len(already_scraped)} rows already scraped, {len(df_raw) - len(already_scraped)} remaining")

    rows_to_scrape = df_raw[~df_raw["link"].isin(already_scraped)].reset_index(drop=True)

    if rows_to_scrape.empty:
        print("Nothing to scrape — all rows already done.")
        return

    all_rows = existing_rows.copy()
    buffer = []

    def flush(force=False):
        nonlocal buffer
        if buffer and (force or len(buffer) >= CHECKPOINT_EVERY):
            all_rows.extend(buffer)
            buffer = []
            df_out = pd.DataFrame(all_rows, columns=["link", "title", "summary", "article"])
            df_out.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(user_agent=UA)

        for _, row in tqdm(rows_to_scrape.iterrows(), total=len(rows_to_scrape), desc="Scraping RFI"):
            url = str(row["link"])
            article = scrape_article(page, url)
            buffer.append({
                "link": url,
                "title": row.get("title", ""),
                "summary": row.get("summary", ""),
                "article": article,
            })
            flush()
            time.sleep(args.delay)

        page.close()
        browser.close()

    flush(force=True)
    print(f"\nDone. {len(all_rows)} rows saved → {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
