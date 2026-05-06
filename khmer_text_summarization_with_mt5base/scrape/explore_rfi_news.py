"""
Explore the kimleang123/rfi_news HuggingFace dataset.
Loads the dataset directly via the HF URL and prints column info.

Usage:
    python explore_rfi_news.py --hf_token <token>
    HF_TOKEN=<token> python explore_rfi_news.py
"""

import argparse
import os

import pandas as pd
from huggingface_hub import login

parser = argparse.ArgumentParser()
parser.add_argument("--hf_token", default=os.environ.get("HF_TOKEN"), help="HuggingFace access token")
args = parser.parse_args()

if args.hf_token:
    login(token=args.hf_token, add_to_git_credential=False)

df = pd.read_csv("hf://datasets/kimleang123/rfi_news/train.csv")

print("Shape:", df.shape)
print("\nColumns:", df.columns.tolist())
print("\nDtypes:\n", df.dtypes)
print("\nFirst 3 rows:\n", df.head(3).to_string())
print("\nNull counts:\n", df.isnull().sum())
