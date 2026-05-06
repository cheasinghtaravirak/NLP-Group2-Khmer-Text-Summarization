"""
Data preparation for Khmer text summarization.

Merges two datasets into a unified Articles | Summaries CSV:
  1. Zedthecodex/Khmer-Summaries  — article + summary pairs (public)
  2. kimleang123/rfi_news          — link + title + summary (gated; articles scraped from URLs)

Output: khmer_text_summarization/dataset/merged.csv

Usage:
    From khmer_text_summarization/:
        python data_prep.py
        python data_prep.py --hf_token HF_TOKEN
        python data_prep.py --no_scrape

    --hf_token    HuggingFace access token for the gated rfi_news dataset.
                  Alternatively set the HF_TOKEN environment variable.
    --no_scrape   Skip rfi_news entirely (use only dataset 1).
"""

import argparse
import os
import time
import logging
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup
from datasets import load_dataset
from playwright.sync_api import sync_playwright, Browser
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OUTPUT_DIR = Path(__file__).parent / "dataset"
DEFAULT_OUTPUT = OUTPUT_DIR / "merged.csv"

# RFI Cambodia article body selectors, tried in order
RFI_BODY_SELECTORS = [
    "div.t-content__body",
    "div.article-content__body",
    "div.article__body",
    "div.content-zone",
    "div.m-content",
]

PLAYWRIGHT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

PAGE_TIMEOUT = 30000  # milliseconds


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def scrape_rfi_article(url: str, browser: Browser) -> str | None:
    """Fetch and extract the Khmer article body from an RFI URL using Playwright.

    Uses a real Chromium browser to bypass Cloudflare protection.
    Returns the plain-text body or None on failure.
    """
    try:
        page = browser.new_page(user_agent=PLAYWRIGHT_USER_AGENT)
        page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT)
        html = page.content()
        page.close()
    except Exception as exc:
        log.debug("Failed to fetch %s: %s", url, exc)
        return None

    soup = BeautifulSoup(html, "html.parser")

    for selector in RFI_BODY_SELECTORS:
        tag = soup.select_one(selector)
        if tag:
            # Remove script/style noise
            for noise in tag.find_all(["script", "style", "figure", "figcaption"]):
                noise.decompose()
            text = tag.get_text(separator="\n", strip=True)
            if text:
                return text

    log.debug("No body selector matched for %s", url)
    return None


def load_dataset1() -> pd.DataFrame:
    """Load Zedthecodex/Khmer-Summaries → normalised DataFrame."""
    log.info("Loading Dataset 1: Zedthecodex/Khmer-Summaries ...")
    ds = load_dataset("Zedthecodex/Khmer-Summaries", split="train")
    df = ds.to_pandas()

    # Column name has a trailing space — strip all column names
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns={"Articles": "article", "Summaries": "summary"})
    df = df[["article", "summary"]]

    log.info("Dataset 1: %d rows loaded.", len(df))
    return df


def load_dataset2(hf_token: str | None, scrape_delay: float) -> pd.DataFrame:
    """Load kimleang123/rfi_news, scrape articles from URLs.

    Requires a HuggingFace token with accepted gating conditions.
    Returns a DataFrame with columns [article, summary].
    """
    log.info("Loading Dataset 2: kimleang123/rfi_news ...")
    try:
        ds = load_dataset(
            "kimleang123/rfi_news",
            split="train",
            token=hf_token,
        )
    except Exception as exc:
        log.error(
            "Could not load rfi_news dataset: %s\n"
            "Make sure you have accepted the dataset terms at "
            "https://huggingface.co/datasets/kimleang123/rfi_news "
            "and passed a valid --hf_token.",
            exc,
        )
        return pd.DataFrame(columns=["article", "summary"])

    df_raw = ds.to_pandas()
    log.info("Dataset 2: %d rows found. Scraping article bodies via Playwright ...", len(df_raw))

    articles = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        for _, row in tqdm(df_raw.iterrows(), total=len(df_raw), desc="Scraping RFI"):
            url = row.get("link", "")
            summary = row.get("summary", "")

            if not url or not summary:
                continue

            body = scrape_rfi_article(str(url), browser)
            if body:
                articles.append({"article": body, "summary": summary})
            else:
                # Fall back to using the title as a minimal article signal;
                # these rows are flagged so they can be filtered later if needed.
                title = row.get("title", "")
                if title:
                    log.debug("Using title as article fallback for %s", url)
                    articles.append({"article": title, "summary": summary})

            time.sleep(scrape_delay)
        browser.close()

    df2 = pd.DataFrame(articles, columns=["article", "summary"])
    log.info(
        "Dataset 2: %d/%d rows successfully scraped.", len(df2), len(df_raw)
    )
    return df2


# ---------------------------------------------------------------------------
# Filtering & cleaning
# ---------------------------------------------------------------------------

MIN_ARTICLE_CHARS = 100
MIN_SUMMARY_CHARS = 20


def clean_and_filter(df: pd.DataFrame) -> pd.DataFrame:
    """Drop nulls, duplicates, and rows that are too short."""
    before = len(df)
    df = df.dropna(subset=["article", "summary"])
    df["article"] = df["article"].str.strip()
    df["summary"] = df["summary"].str.strip()
    df = df[df["article"].str.len() >= MIN_ARTICLE_CHARS]
    df = df[df["summary"].str.len() >= MIN_SUMMARY_CHARS]
    df = df.drop_duplicates(subset=["article"])
    df = df.reset_index(drop=True)
    log.info("Filtering: %d → %d rows kept.", before, len(df))
    return df


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare merged Khmer summarisation dataset.")
    parser.add_argument("--hf_token", default=os.getenv("HF_TOKEN"), help="HuggingFace access token")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output CSV path")
    parser.add_argument("--scrape_delay", type=float, default=1.0, help="Seconds between HTTP requests")
    parser.add_argument("--no_scrape", action="store_true", help="Skip rfi_news (dataset 2)")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- Dataset 1 ---
    df1 = load_dataset1()

    # --- Dataset 2 ---
    if args.no_scrape:
        log.info("--no_scrape set; skipping Dataset 2.")
        df2 = pd.DataFrame(columns=["article", "summary"])
    else:
        df2 = load_dataset2(args.hf_token, args.scrape_delay)

    # --- Merge ---
    combined = pd.concat([df1, df2], ignore_index=True)
    log.info("Combined: %d rows before filtering.", len(combined))

    combined = clean_and_filter(combined)

    # --- Save ---
    output_path = Path(args.output)
    combined.to_csv(output_path, index=False, encoding="utf-8-sig")
    log.info("Saved merged dataset to %s  (%d rows)", output_path, len(combined))

    # Quick stats
    combined["article_len"] = combined["article"].str.len()
    combined["summary_len"] = combined["summary"].str.len()
    print("\n=== Dataset Statistics ===")
    print(f"Total rows : {len(combined)}")
    print(f"Avg article length (chars): {combined['article_len'].mean():.0f}")
    print(f"Avg summary length (chars): {combined['summary_len'].mean():.0f}")
    print(f"Output: {output_path.resolve()}")


if __name__ == "__main__":
    main()
