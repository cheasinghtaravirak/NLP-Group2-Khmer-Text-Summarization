# NLP Group 2 — Khmer Text Summarization

This repository contains the full ecosystem for **abstractive text summarization in the Khmer language**, developed as a group NLP project. It spans model fine-tuning research through to a production-ready web application.

---

## Ecosystem Overview

```
NLP-group-2-submission/
├── khmer_text_summarization_with_mt5base/   # Fine-tuning mT5-base (Python, local GPU)
├── khmer_text_summarization_gemma4/         # Fine-tuning Gemma 4 4B (Google Colab)
└── khmer-text-summarizer-web-app/           # Next.js web app (deployed on Vercel)
```

The three projects are designed to work together:

1. The **fine-tuning projects** produce trained models that are published to Hugging Face Hub.
2. The **web app** calls those Hugging Face Spaces endpoints (alongside Google Gemini) to provide summarization to end users.

### How it fits together

```
User
  │
  ▼
┌─────────────────────────────────┐
│   ខ្លឹម — Khmer Text Summarizer  │  (Next.js, Vercel)
│   khmer-text-summarizer-web-app │
└────────────┬────────────────────┘
             │  API calls (Gradio / Gemini)
     ┌───────┴────────┐
     ▼                ▼
┌──────────┐    ┌───────────┐    ┌────────────────┐
│ mT5-base │    │ Gemma 4   │    │ Gemini 2.0     │
│ (HF      │    │ 4B (HF    │    │ Flash (Google  │
│ Spaces)  │    │ Spaces)   │    │ API)           │
└──────────┘    └───────────┘    └────────────────┘
     ▲                ▲
     │                │
┌──────────────┐  ┌──────────────────────────┐
│ Fine-tuned   │  │ Fine-tuned via QLoRA on  │
│ on ~6,500    │  │ LR-Sum Khmer dataset     │
│ Khmer news   │  │ (Google Colab, A100)     │
│ pairs        │  └──────────────────────────┘
└──────────────┘
```

---

## Projects

### 1. Khmer Text Summarizer — Web App

**Path:** [`khmer-text-summarizer-web-app/`](khmer-text-summarizer-web-app/)

A Next.js 15 web application (deployed on Vercel) that lets users summarize Khmer text through three different models. Users can paste text, enter a URL, upload a PDF, or use OCR on an image.

| Feature | Details |
|---|---|
| **Models** | mT5-base, Gemma 4 4B (streaming), Gemini 2.0 Flash (streaming) |
| **Input sources** | Plain text, URL extraction, PDF upload, image OCR (Tesseract.js) |
| **UI** | Khmer/English i18n, dark/light mode, summary history |
| **Stack** | Next.js 15, React 19, Tailwind v4, shadcn/ui, TanStack Query, Zod |

→ See [`khmer-text-summarizer-web-app/README.md`](khmer-text-summarizer-web-app/README.md) for setup and local development instructions.

---

### 2. Fine-tuning mT5-base for Khmer Summarization

**Path:** [`khmer_text_summarization_with_mt5base/`](khmer_text_summarization_with_mt5base/)

A Python training pipeline that fine-tunes `google/mt5-base` (580M parameters) on approximately 6,500 Khmer news article–summary pairs. Runs locally on a CUDA GPU.

| Detail | Value |
|---|---|
| **Base model** | `google/mt5-base` |
| **Dataset** | ~6,500 Khmer news pairs (scraped + HuggingFace) |
| **Results** | ROUGE-1 13.12 / ROUGE-2 6.85 / ROUGE-L 12.90 |
| **Live demo** | [huggingface.co/spaces/taravirak/khmer-text-summarizer](https://huggingface.co/spaces/taravirak/khmer-text-summarizer) |

→ See [`khmer_text_summarization_with_mt5base/README.md`](khmer_text_summarization_with_mt5base/README.md) for setup, training, and inference instructions.

---

### 3. Fine-tuning Gemma 4 (4B) for Khmer Summarization

**Path:** [`khmer_text_summarization_gemma4/`](khmer_text_summarization_gemma4/)

A Google Colab notebook that fine-tunes `google/gemma-4-E4B-it` using QLoRA (4-bit quantization + LoRA adapters) on the LR-Sum Khmer dataset. Produces a higher-quality summarizer capable of generating structured meeting minutes or article summaries.

| Detail | Value |
|---|---|
| **Base model** | `google/gemma-4-E4B-it` |
| **Dataset** | [bltlab/lr-sum](https://huggingface.co/datasets/bltlab/lr-sum) (Khmer subset) |
| **Method** | QLoRA — 4-bit NF4 quantization + LoRA (r=16) |
| **Platform** | Google Colab (A100 GPU recommended) |
| **Output** | Merged model pushed to Hugging Face Hub |

→ See [`khmer_text_summarization_gemma4/README.md`](khmer_text_summarization_gemma4/README.md) for Colab setup and step-by-step instructions.

---

## Repository Structure

```
NLP-group-2-submission/
│
├── khmer-text-summarizer-web-app/
│   ├── app/                    # Next.js App Router (pages + API routes)
│   ├── components/             # UI components (shadcn + custom)
│   ├── lib/                    # Core logic: summarize, OCR, i18n, history
│   └── README.md
│
├── khmer_text_summarization_with_mt5base/
│   ├── main.py                 # Entry point (train / eval / infer)
│   ├── train.py / model.py     # Training pipeline
│   ├── dataset/                # CSV data files
│   ├── results/                # Checkpoints, metrics, plots
│   └── README.md
│
└── khmer_text_summarization_gemma4/
    ├── Gemma_4_4B_+_LR_Sum_(Khmer).ipynb  # Colab notebook
    └── README.md
```
