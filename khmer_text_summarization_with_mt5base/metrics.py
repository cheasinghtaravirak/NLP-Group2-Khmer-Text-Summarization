"""
evaluate.py — ROUGE evaluation for Khmer text summarisation.
"""

import pandas as pd
import torch
from tqdm import tqdm
import evaluate as hf_evaluate

from config import (
    DEVICE, NUM_BEAMS, LENGTH_PENALTY, NO_REPEAT_NGRAM,
    MAX_INPUT_LEN, MAX_TARGET_LEN, INPUT_PREFIX,
    RESULTS_DIR, PREDS_CSV, METRICS_CSV,
)


def generate_summaries(model, tokenizer, articles: list[str], batch_size: int = 8) -> list[str]:
    model.eval()
    predictions = []

    for i in tqdm(range(0, len(articles), batch_size), desc="Generating"):
        batch = articles[i : i + batch_size]
        inputs = tokenizer(
            [INPUT_PREFIX + a for a in batch],
            max_length=MAX_INPUT_LEN,
            truncation=True,
            padding=True,
            return_tensors="pt",
        ).to(DEVICE)

        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=MAX_TARGET_LEN,
                num_beams=NUM_BEAMS,
                length_penalty=LENGTH_PENALTY,
                no_repeat_ngram_size=NO_REPEAT_NGRAM,
                early_stopping=True,
            )

        predictions.extend(tokenizer.batch_decode(output_ids, skip_special_tokens=True))

    return predictions


def run_full_evaluation(model, tokenizer, val_articles: list[str], val_summaries: list[str]) -> dict:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    rouge = hf_evaluate.load("rouge")

    predictions = generate_summaries(model, tokenizer, val_articles)
    references  = val_summaries

    # use_stemmer=False: English Porter stemmer is meaningless for Khmer
    scores  = rouge.compute(predictions=predictions, references=references, use_stemmer=False)
    metrics = {k: round(v * 100, 2) for k, v in scores.items()}

    print("\n=== ROUGE Scores ===")
    for k, v in metrics.items():
        print(f"  {k}: {v:.2f}")

    pd.DataFrame({
        "article":    val_articles,
        "reference":  references,
        "prediction": predictions,
    }).to_csv(PREDS_CSV, index=False, encoding="utf-8-sig")

    pd.DataFrame([metrics]).to_csv(METRICS_CSV, index=False)

    print(f"\nPredictions -> {PREDS_CSV}")
    print(f"Metrics     -> {METRICS_CSV}")

    return metrics
