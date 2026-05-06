"""
infer.py — Interactive inference with the fine-tuned mt5-small Khmer summariser.

Modes:
  1. Interactive REPL  : python infer.py
  2. Single text arg   : python infer.py --text "អត្ថបទ..."
  3. From a text file  : python infer.py --file article.txt
"""

import argparse
import sys
import torch
from pathlib import Path
from transformers import AutoTokenizer

from config import (
    MODEL_NAME, BEST_MODEL_PATH, DEVICE,
    INPUT_PREFIX, MAX_INPUT_LEN, MAX_TARGET_LEN,
    NUM_BEAMS, LENGTH_PENALTY, NO_REPEAT_NGRAM,
)
from model import load_model


def summarize(text: str, model, tokenizer) -> str:
    src = INPUT_PREFIX + text.strip()
    inputs = tokenizer(
        src,
        max_length=MAX_INPUT_LEN,
        truncation=True,
        return_tensors="pt",
    ).to(DEVICE)

    model.eval()
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=MAX_TARGET_LEN,
            num_beams=NUM_BEAMS,
            length_penalty=LENGTH_PENALTY,
            no_repeat_ngram_size=NO_REPEAT_NGRAM,
            early_stopping=True,
        )

    return tokenizer.decode(output_ids[0], skip_special_tokens=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Khmer text summarisation inference.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--text", type=str, help="Khmer article text (quoted string)")
    group.add_argument("--file", type=str, help="Path to a .txt file containing the article")
    args = parser.parse_args()

    print(f"Loading model from {BEST_MODEL_PATH} ...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model     = load_model(from_checkpoint=True)
    print(f"Model loaded on {DEVICE}\n")

    # ── Single-shot modes ─────────────────────────────────────────────────
    if args.text:
        summary = summarize(args.text, model, tokenizer)
        print("=== Summary ===")
        print(summary)
        return

    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"ERROR: file not found: {path}")
            sys.exit(1)
        text    = path.read_text(encoding="utf-8").strip()
        summary = summarize(text, model, tokenizer)
        print(f"=== Article ({len(text)} chars) ===")
        print(text[:300], "..." if len(text) > 300 else "")
        print("\n=== Summary ===")
        print(summary)
        return

    # ── Interactive REPL ──────────────────────────────────────────────────
    print("Interactive mode — paste a Khmer article and press Enter twice to summarise.")
    print("Type 'quit' or 'exit' to stop.\n")

    while True:
        print("─" * 60)
        print("Article (blank line to submit):")
        lines = []
        while True:
            try:
                line = input()
            except EOFError:
                break
            if line.lower() in ("quit", "exit"):
                print("Goodbye.")
                return
            if line == "" and lines:
                break
            lines.append(line)

        if not lines:
            continue

        text    = "\n".join(lines)
        summary = summarize(text, model, tokenizer)
        print("\n=== Summary ===")
        print(summary)
        print()


if __name__ == "__main__":
    main()
