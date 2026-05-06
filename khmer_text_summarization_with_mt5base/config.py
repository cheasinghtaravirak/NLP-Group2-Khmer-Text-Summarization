"""
config.py — Hyperparameters and paths for mt5-base Khmer text summarisation.
"""

import torch
from pathlib import Path

# ── Paths ───────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent

# Properly scraped dataset (article longer than summary; no title fallbacks)
# DATA_CSV = PROJECT_ROOT / "dataset" / "proper_scraped.csv"
DATA_CSV = PROJECT_ROOT / "dataset" / "proper_scraped_clean.csv"

RESULTS_DIR     = PROJECT_ROOT / "results"
BEST_MODEL_PATH = RESULTS_DIR / "best_mt5base_khmer.pt"
CHECKPOINT_PATH = RESULTS_DIR / "checkpoint.pt"            # full training state for resume
PREDS_CSV       = RESULTS_DIR / "mt5base_predictions.csv"
METRICS_CSV     = RESULTS_DIR / "mt5base_results.csv"

# ── Model ────────────────────────────────────────────────────────────────────
# mt5-base (~580M params) vs mt5-small (~300M params):
#   - Same SentencePiece tokenizer (zero code changes needed)
#   - Better Khmer coverage due to larger capacity
#   - With fp16 + gradient checkpointing + batch=2: fits in 12GB VRAM
MODEL_NAME   = "google/mt5-base"
INPUT_PREFIX = "summarize: "        # task prefix prepended to each article

# ── Tokenisation ─────────────────────────────────────────────────────────────
# Dataset analysis on proper_scraped_clean.csv (n=6501, tokenizer: mt5 SentencePiece):
#
#   Articles:  mean=592 tokens; 65.5% exceed 512 tokens; only 3.3% exceed 1024 tokens.
#              → MAX_INPUT_LEN=1024 covers 96.7% of articles fully.
#              mt5 uses T5 relative position biases; 1024 is the practical safe upper limit.
#              At BATCH_SIZE=2 + fp16 + gradient checkpointing this fits in 12GB VRAM.
#
#   Summaries: mean=130 tokens; 43.3% exceed 128 tokens; only 0.9% exceed 256 tokens.
#              → MAX_TARGET_LEN=256 covers 99.1% of references without overflow.
#              NOTE: the mt5-small checkpoint trained at 128 MUST be retrained from
#              scratch at 256 — running inference with the old checkpoint at 256
#              tokens causes repetition because the model was never trained beyond 128.
MAX_INPUT_LEN  = 1024
MAX_TARGET_LEN = 256

# ── Training ─────────────────────────────────────────────────────────────────
# VRAM budget at MAX_INPUT_LEN=1024 on 12GB:
#   BATCH_SIZE=2 + fp16 + gradient checkpointing → ~6-7GB; safe headroom.
#   GRAD_ACCUM_STEPS=16 keeps effective batch size = 32 (same as before).
TRAIN_RATIO      = 0.9
BATCH_SIZE       = 2
GRAD_ACCUM_STEPS = 16               # effective batch size = 32
LEARNING_RATE    = 5e-5
WEIGHT_DECAY     = 0.01
EPOCHS           = 10
WARMUP_RATIO     = 0.06
MAX_GRAD_NORM    = 1.0
USE_AMP          = True             # bf16 mixed-precision — same memory as fp16, no NaN overflow

# ── Generation ───────────────────────────────────────────────────────────────
NUM_BEAMS          = 4
LENGTH_PENALTY     = 1.0
NO_REPEAT_NGRAM    = 3

# ── Misc ─────────────────────────────────────────────────────────────────────
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SEED   = 42