"""
main.py — Full fine-tuning of google/mt5-small for Khmer text summarisation.

Usage:
    From the khmer_text_summarization/ directory:
        python main.py
        python main.py --data /path/to/merged.csv
        python main.py --eval_only   # skip training; evaluate best checkpoint
"""

import argparse
import random

import numpy as np
import torch

from config   import DEVICE, SEED, MODEL_NAME
from dataset  import get_dataloaders
from model    import load_model
from train    import train
from metrics  import run_full_evaluation
from plot_results import generate_all_plots


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fine-tune mt5-base for Khmer summarisation.")
    parser.add_argument("--data",      default=None,  help="Path to merged CSV (overrides config)")
    parser.add_argument("--eval_only", action="store_true", help="Skip training; evaluate best checkpoint")
    parser.add_argument("--resume",    action="store_true", help="Resume training from last checkpoint")
    args = parser.parse_args()

    set_seed(SEED)
    print(f"Device : {DEVICE}")
    print(f"Model  : {MODEL_NAME}")

    train_loader, val_loader, tokenizer, val_arts, val_sums = get_dataloaders(args.data)
    print(f"Train batches: {len(train_loader)}  |  Val batches: {len(val_loader)}")

    if args.eval_only:
        model = load_model(from_checkpoint=True)
        print("Loaded best checkpoint. Running evaluation only.")
    else:
        model = load_model(from_checkpoint=False)
        print("\nStarting full fine-tuning ...")
        train(model, train_loader, val_loader, resume=args.resume)
        # Reload best checkpoint weights for evaluation
        model = load_model(from_checkpoint=True)

    run_full_evaluation(model, tokenizer, val_arts, val_sums)

    # Generate all report plots (training curves, ROUGE bar, length scatter)
    print("\nGenerating report plots ...")
    generate_all_plots()


if __name__ == "__main__":
    main()
