"""
train.py — Full fine-tuning loop for google/mt5-base.

Memory strategy for 12 GB VRAM at MAX_INPUT_LEN=1024:
  1. bf16 mixed-precision (AMP)  — halves activation and weight memory.
     NOTE: mt5 layer-norms have very large weights that overflow fp16's
     narrow range (max 65504) → NaN.  bf16 shares fp32's exponent bits
     so it never overflows, and needs no GradScaler.
  2. Gradient checkpointing      — recomputes activations on backward pass
                                   (enabled in model.py).
  3. BATCH_SIZE=2, GRAD_ACCUM=16 — effective batch 32, same as before.
"""

import torch
from torch.amp import autocast
from torch.optim import AdamW
from transformers import get_linear_schedule_with_warmup
import pandas as pd

from config import (
    DEVICE, EPOCHS, LEARNING_RATE, WEIGHT_DECAY,
    GRAD_ACCUM_STEPS, MAX_GRAD_NORM, WARMUP_RATIO,
    RESULTS_DIR, BEST_MODEL_PATH, CHECKPOINT_PATH, USE_AMP,
)

_USE_AMP = USE_AMP and DEVICE.type == "cuda"


def _save_checkpoint(epoch, model, optimizer, scheduler, best_val_loss, history):
    """Save full training state so training can resume after interruption."""
    torch.save({
        "epoch":         epoch,
        "model_state":   model.state_dict(),
        "optim_state":   optimizer.state_dict(),
        "sched_state":   scheduler.state_dict(),
        "best_val_loss": best_val_loss,
        "history":       history,
    }, CHECKPOINT_PATH)


def train(model, train_loader, val_loader, resume: bool = False) -> list[dict]:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    optimizer = AdamW(
        model.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
    )

    total_steps  = len(train_loader) * EPOCHS // GRAD_ACCUM_STEPS
    warmup_steps = int(total_steps * WARMUP_RATIO)
    scheduler    = get_linear_schedule_with_warmup(optimizer, warmup_steps, total_steps)

    best_val_loss = float("inf")
    history       = []
    start_epoch   = 1

    # ── Resume from checkpoint ────────────────────────────────────────────
    if resume and CHECKPOINT_PATH.exists():
        ckpt = torch.load(CHECKPOINT_PATH, map_location=DEVICE)
        model.load_state_dict(ckpt["model_state"])
        optimizer.load_state_dict(ckpt["optim_state"])
        scheduler.load_state_dict(ckpt["sched_state"])
        best_val_loss = ckpt["best_val_loss"]
        history       = ckpt["history"]
        start_epoch   = ckpt["epoch"] + 1
        print(f"Resumed from epoch {ckpt['epoch']}  (best_val_loss={best_val_loss:.4f})")
        del ckpt  # free memory

    for epoch in range(start_epoch, EPOCHS + 1):
        # ── Training ──────────────────────────────────────────────────────
        model.train()
        train_loss = 0.0
        optimizer.zero_grad()

        for step, batch in enumerate(train_loader, 1):
            input_ids      = batch["input_ids"].to(DEVICE)
            attention_mask = batch["attention_mask"].to(DEVICE)
            labels         = batch["labels"].to(DEVICE)

            with autocast('cuda', dtype=torch.bfloat16, enabled=_USE_AMP):
                outputs = model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels,
                )
                loss = outputs.loss / GRAD_ACCUM_STEPS

            loss.backward()
            train_loss += outputs.loss.item()

            if step % GRAD_ACCUM_STEPS == 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), MAX_GRAD_NORM)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()

        avg_train = train_loss / len(train_loader)

        # ── Validation ────────────────────────────────────────────────────
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch in val_loader:
                input_ids      = batch["input_ids"].to(DEVICE)
                attention_mask = batch["attention_mask"].to(DEVICE)
                labels         = batch["labels"].to(DEVICE)
                with autocast('cuda', dtype=torch.bfloat16, enabled=_USE_AMP):
                    outputs = model(
                        input_ids=input_ids,
                        attention_mask=attention_mask,
                        labels=labels,
                    )
                val_loss += outputs.loss.item()

        avg_val = val_loss / len(val_loader)
        history.append({"epoch": epoch, "train_loss": avg_train, "val_loss": avg_val})
        print(f"Epoch {epoch:02d}/{EPOCHS}  train_loss={avg_train:.4f}  val_loss={avg_val:.4f}")

        if avg_val < best_val_loss:
            best_val_loss = avg_val
            torch.save(model.state_dict(), BEST_MODEL_PATH)
            print(f"  -> Saved best model  (val_loss={best_val_loss:.4f})")

        # Save full training state after every epoch for safe resume
        _save_checkpoint(epoch, model, optimizer, scheduler, best_val_loss, history)

    # Persist training history for plot_results.py
    history_csv = RESULTS_DIR / "training_history.csv"
    pd.DataFrame(history).to_csv(history_csv, index=False)
    print(f"Training history -> {history_csv}")

    return history
