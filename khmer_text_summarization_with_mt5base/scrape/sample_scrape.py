"""
Scrape the first 3 rows from kimleang123/rfi_news and save to results/rfi_sample.csv.

Usage (activate .venv_gpu first):
    python sample_scrape.py --hf_token <token>
    HF_TOKEN=<token> python sample_scrape.py
"""

import argparse
import os
import sys
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup
from huggingface_hub import login
from playwright.sync_api import sync_playwright

RESULTS_DIR = Path(__file__).parent.parent / "results"
OUTPUT_CSV = RESULTS_DIR / "rfi_sample.csv"

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

parser = argparse.ArgumentParser()
parser.add_argument("--hf_token", default=os.environ.get("HF_TOKEN"))
parser.add_argument("--n", type=int, default=3, help="Number of rows to sample")
args = parser.parse_args()

if args.hf_token:
    login(token=args.hf_token, add_to_git_credential=False)

# Load first n rows
df_raw = pd.read_csv("hf://datasets/kimleang123/rfi_news/train.csv").head(args.n)
print(f"Loaded {len(df_raw)} rows from rfi_news")
print(df_raw[["link", "title", "summary"]].to_string())
print()

# Scrape article bodies
rows = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    for i, row in df_raw.iterrows():
        url = str(row["link"])
        print(f"[{i+1}/{len(df_raw)}] Fetching: {url}")
        try:
            page = browser.new_page(user_agent=UA)
            page.goto(url, wait_until="networkidle", timeout=30000)
            html = page.content()
            page.close()
        except Exception as exc:
            print(f"  ERROR: {exc}")
            rows.append({"link": url, "title": row["title"], "summary": row["summary"], "article": ""})
            continue

        soup = BeautifulSoup(html, "html.parser")
        article_text = ""
        for sel in RFI_BODY_SELECTORS:
            tag = soup.select_one(sel)
            if tag:
                for noise in tag.find_all(["script", "style", "figure", "figcaption"]):
                    noise.decompose()
                article_text = tag.get_text(separator="\n", strip=True)
                if article_text:
                    break

        print(f"  Body: {len(article_text)} chars — {article_text[:120]!r}")
        rows.append({
            "link": url,
            "title": row["title"],
            "summary": row["summary"],
            "article": article_text,
        })
    browser.close()

RESULTS_DIR.mkdir(parents=True, exist_ok=True)
df_out = pd.DataFrame(rows, columns=["link", "title", "summary", "article"])
df_out.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
print(f"\nSaved {len(df_out)} rows → {OUTPUT_CSV}")
