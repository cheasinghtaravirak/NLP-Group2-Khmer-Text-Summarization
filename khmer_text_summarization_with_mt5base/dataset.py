"""
dataset.py — Tokenisation and DataLoader for Khmer summarisation.
"""

import pandas as pd
import torch
from pathlib import Path
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer

from config import (
    DATA_CSV, MODEL_NAME, INPUT_PREFIX,
    MAX_INPUT_LEN, MAX_TARGET_LEN,
    TRAIN_RATIO, BATCH_SIZE, SEED,
)


class KhmerSumDataset(Dataset):
    def __init__(self, articles: list[str], summaries: list[str], tokenizer):
        self.articles  = articles
        self.summaries = summaries
        self.tokenizer = tokenizer

    def __len__(self) -> int:
        return len(self.articles)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        src = INPUT_PREFIX + str(self.articles[idx])
        tgt = str(self.summaries[idx])

        model_inputs = self.tokenizer(
            src,
            max_length=MAX_INPUT_LEN,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )

        label_enc = self.tokenizer(
            text_target=tgt,
            max_length=MAX_TARGET_LEN,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )

        label_ids = label_enc["input_ids"].squeeze(0)
        # Mask padding tokens so they don't contribute to the loss
        label_ids[label_ids == self.tokenizer.pad_token_id] = -100

        return {
            "input_ids":      model_inputs["input_ids"].squeeze(0),
            "attention_mask": model_inputs["attention_mask"].squeeze(0),
            "labels":         label_ids,
        }


def load_and_split(data_csv: Path | str | None = None):
    """Load merged CSV and return (train_articles, train_summaries, val_articles, val_summaries)."""
    csv_path = Path(data_csv) if data_csv else DATA_CSV
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    df = df.dropna(subset=["article", "summary"]).reset_index(drop=True)

    train_df, val_df = train_test_split(
        df, train_size=TRAIN_RATIO, random_state=SEED, shuffle=True,
    )
    return (
        train_df["article"].tolist(), train_df["summary"].tolist(),
        val_df["article"].tolist(),   val_df["summary"].tolist(),
    )


def get_dataloaders(data_csv=None):
    """Return (train_loader, val_loader, tokenizer, val_articles, val_summaries)."""
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    train_arts, train_sums, val_arts, val_sums = load_and_split(data_csv)

    train_ds = KhmerSumDataset(train_arts, train_sums, tokenizer)
    val_ds   = KhmerSumDataset(val_arts,   val_sums,   tokenizer)

    train_loader = DataLoader(
        train_ds, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=2, pin_memory=True,
    )
    val_loader = DataLoader(
        val_ds, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=2, pin_memory=True,
    )

    return train_loader, val_loader, tokenizer, val_arts, val_sums
