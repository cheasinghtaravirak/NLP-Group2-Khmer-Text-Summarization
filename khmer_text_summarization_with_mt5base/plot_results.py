"""
plot_results.py — Training and evaluation plots for the Khmer summarisation report.

Generates:
  1. training_curves.png   — Train vs Val loss per epoch
  2. rouge_bar.png         — Bar chart of ROUGE-1 / ROUGE-2 / ROUGE-L / ROUGE-Lsum
  3. length_scatter.png    — Reference vs Predicted summary lengths (chars)
"""

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use("Agg")            # non-interactive backend (no GUI needed)

from config import RESULTS_DIR, PREDS_CSV, METRICS_CSV

PLOTS_DIR   = RESULTS_DIR / "plots"
HISTORY_CSV = RESULTS_DIR / "training_history.csv"


def plot_training_curves(history_csv=None) -> None:
    """Train vs Validation loss across epochs."""
    csv = history_csv or HISTORY_CSV
    df  = pd.read_csv(csv)

    fig, ax = plt.subplots(figsize=(7, 4))
    ax.plot(df["epoch"], df["train_loss"], "o-", label="Train Loss")
    ax.plot(df["epoch"], df["val_loss"],   "s-", label="Val Loss")
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Loss")
    ax.set_title("Training vs Validation Loss")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()

    out = PLOTS_DIR / "training_curves.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"Saved {out}")


def plot_rouge_bar(metrics_csv=None) -> None:
    """Horizontal bar chart of ROUGE scores."""
    csv = metrics_csv or METRICS_CSV
    df  = pd.read_csv(csv)
    metrics = df.iloc[0].to_dict()

    names  = list(metrics.keys())
    values = list(metrics.values())

    fig, ax = plt.subplots(figsize=(6, 3))
    bars = ax.barh(names, values, color=["#4C72B0", "#55A868", "#C44E52", "#8172B2"])
    ax.set_xlabel("Score (%)")
    ax.set_title("ROUGE Scores (mt5-base)")
    ax.set_xlim(0, max(values) * 1.15)

    for bar, v in zip(bars, values):
        ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height() / 2,
                f"{v:.1f}", va="center", fontsize=9)

    fig.tight_layout()
    out = PLOTS_DIR / "rouge_bar.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"Saved {out}")


def plot_length_scatter(preds_csv=None) -> None:
    """Scatter plot: reference summary length vs predicted summary length (chars)."""
    csv = preds_csv or PREDS_CSV
    df  = pd.read_csv(csv)
    df["ref_len"]  = df["reference"].astype(str).str.len()
    df["pred_len"] = df["prediction"].astype(str).str.len()

    fig, ax = plt.subplots(figsize=(5, 5))
    ax.scatter(df["ref_len"], df["pred_len"], alpha=0.3, s=10)

    lo = 0
    hi = max(df["ref_len"].max(), df["pred_len"].max()) * 1.05
    ax.plot([lo, hi], [lo, hi], "r--", linewidth=1, label="y = x")

    ax.set_xlabel("Reference Length (chars)")
    ax.set_ylabel("Predicted Length (chars)")
    ax.set_title("Summary Length: Reference vs Prediction")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()

    out = PLOTS_DIR / "length_scatter.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"Saved {out}")


def generate_all_plots() -> None:
    """Generate every report plot. Called from main.py after evaluation."""
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)

    if HISTORY_CSV.exists():
        plot_training_curves()
    else:
        print(f"Skipping training curves — {HISTORY_CSV} not found (eval_only mode?).")

    if METRICS_CSV.exists():
        plot_rouge_bar()
    else:
        print(f"Skipping ROUGE bar — {METRICS_CSV} not found.")

    if PREDS_CSV.exists():
        plot_length_scatter()
    else:
        print(f"Skipping length scatter — {PREDS_CSV} not found.")


if __name__ == "__main__":
    generate_all_plots()
