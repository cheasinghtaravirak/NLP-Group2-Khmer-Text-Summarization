# Khmer Abstractive Text Summarization with Fine-tuned mT5-base

Fine-tunes `google/mt5-base` (580 M parameters) on ~6,500 Khmer news article–summary pairs for abstractive text summarization.

**Results:** ROUGE-1 13.12 / ROUGE-2 6.85 / ROUGE-L 12.90

**Live demo:** [huggingface.co/spaces/taravirak/khmer-text-summarizer](https://huggingface.co/spaces/taravirak/khmer-text-summarizer)

## Project Structure

```
khmer_text_summarization/
├── config.py           # Hyperparameters, paths, device settings
├── data_prep.py        # Merge & clean datasets from HuggingFace
├── dataset.py          # KhmerSumDataset + DataLoader construction
├── model.py            # Load mT5-base with gradient checkpointing
├── train.py            # Training loop (bf16 AMP, grad accum, resume)
├── metrics.py          # ROUGE evaluation on validation set
├── infer.py            # Interactive inference CLI
├── plot_results.py     # Generate training curves & result plots
├── main.py             # Entry point (train / eval / resume)
├── dataset/            # CSV data files
├── results/            # Checkpoints, predictions, metrics, plots
├── log/                # Training logs
├── paper/              # Reference papers
├── report/             # Project reports
├── scrape/             # Web scraping scripts for RFI news
└── test/               # Sample Khmer articles for testing
```

## Setup

Create and activate a virtual environment:

```bash
python -m venv venv
```

On Windows:
```bash
venv\Scripts\activate
```

On macOS/Linux:
```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Requires Python 3.10+ and a CUDA-capable GPU (tested on 12 GB VRAM).

## Usage

### Train

```bash
python main.py
```

Resume from checkpoint:

```bash
python main.py --resume
```

### Evaluate only

```bash
python main.py --eval_only
```

### Inference

Interactive REPL (paste article, press Enter twice):

```bash
python infer.py
```

Single text:

```bash
python infer.py --text "អត្ថបទជាភាសាខ្មែរ..."
```

From file:

```bash
python infer.py --file test/article1.txt
```

## Data

Two HuggingFace sources merged via `data_prep.py`:

1. `Zedthecodex/Khmer-Summaries` — article + summary pairs
2. `kimleang123/rfi_news` — RFI Cambodia articles scraped with Playwright

Final dataset: **6,501 pairs** after cleaning (90/10 train/val split).

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Model | `google/mt5-base` (~580 M params) |
| Max input / target tokens | 1,024 / 256 |
| Micro-batch size | 2 |
| Gradient accumulation | 16 (effective batch = 32) |
| Optimizer | AdamW (lr=5e-5, weight_decay=0.01) |
| Mixed precision | bf16 |
| Gradient checkpointing | Enabled |
| Epochs | 10 |
| Decoding | Beam search (4 beams, no_repeat_ngram=3) |
| Hardware | NVIDIA RTX PRO 3000 (12 GB VRAM) |
| Training time | ~10 hours |

## Results

| ROUGE-1 | ROUGE-2 | ROUGE-L | ROUGE-Lsum |
|---------|---------|---------|------------|
| 13.12 | 6.85 | 12.90 | 12.94 |

+35% relative improvement in ROUGE-1 over prior mT5-small baseline (9.71).
