"""
model.py — Load and configure the mt5-base seq2seq model.
"""

import torch
from transformers import AutoModelForSeq2SeqLM

from config import MODEL_NAME, BEST_MODEL_PATH, DEVICE


def load_model(from_checkpoint: bool = False) -> AutoModelForSeq2SeqLM:
    """Load google/mt5-base. If from_checkpoint, restore fine-tuned weights.

    Gradient checkpointing is always enabled so that activations are
    recomputed on the backward pass rather than stored.  This trades a
    ~20 % speed penalty for a large reduction in peak VRAM, allowing
    MAX_INPUT_LEN=1024 to fit in 12 GB alongside fp16 training.
    """
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
    # Recompute activations during backward pass instead of caching them.
    # Essential for seq_len=1024 on a 12 GB GPU with mt5-base.
    model.gradient_checkpointing_enable()
    if from_checkpoint:
        if not BEST_MODEL_PATH.exists():
            raise FileNotFoundError(
                f"No checkpoint found at {BEST_MODEL_PATH}. Train first."
            )
        state = torch.load(BEST_MODEL_PATH, map_location=DEVICE)
        model.load_state_dict(state)
    return model.to(DEVICE)
